/**
 * ModelManager - Main manager class for AI model configuration
 */

import { ModelDatabase } from './Database';
import { EncryptionManager } from './EncryptionManager';
import { UsageTracker } from './UsageTracker';
import { BUILTIN_PROVIDERS } from './ProviderRegistry';
import { APIKeyValidator, type APIKeyValidationResult } from './APIKeyValidator';
import type {
  AIProvider,
  APIKey,
  CreateProviderInput,
  EncryptedKeyData,
  LogUsageInput,
  ModelConfig,
  ModelExportData,
  ModelInfo,
  ModelManagerOptions,
  SetAPIKeyInput,
  UpdateProviderInput,
  UsageLog,
  UsageLogFilters,
  UsageSummary,
} from './types';

/**
 * Provider selection options
 */
export interface ProviderSelectionOptions {
  /** Filter by provider type */
  type?: string;
  /** Select specific provider by ID */
  providerId?: string;
  /** Select provider that has this model */
  modelId?: string;
}

/**
 * Convert provider database row to AIProvider type
 */
function rowToProvider(row: any): AIProvider {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    enabled: row.enabled === 1,
    priority: row.priority,
    config: row.config ? JSON.parse(row.config) : {},
    models: row.models ? JSON.parse(row.models) : [],
    defaultModel: row.default_model || undefined,
    baseUrl: row.base_url || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert API key database row to APIKey type
 */
function rowToAPIKey(row: any): APIKey {
  return {
    id: row.id,
    providerId: row.provider_id,
    keyName: row.key_name,
    isValid: row.is_valid === 1,
    lastValidated: row.last_validated || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * ModelManager - Central manager for AI model configuration
 *
 * Provides a unified interface for managing:
 * - AI providers (OpenAI, Anthropic, etc.)
 * - API keys (encrypted storage)
 * - Model configurations
 * - Usage tracking
 */
export class ModelManager {
  private db: ModelDatabase;
  private encryption: EncryptionManager;
  private usageTracker: UsageTracker;
  private initialized: boolean = false;

  /**
   * Create a new ModelManager instance
   * @param dbOrOptions - Database instance or configuration options
   * @param encryption - Encryption manager (required if dbOrOptions is a database)
   */
  constructor(dbOrOptions?: ModelDatabase | ModelManagerOptions, encryption?: EncryptionManager) {
    if (dbOrOptions instanceof ModelDatabase) {
      // Constructor called with (db, encryption)
      this.db = dbOrOptions;
      this.encryption = encryption || new EncryptionManager();
    } else {
      // Constructor called with options or nothing
      this.db = new ModelDatabase(dbOrOptions?.dbPath);
      this.encryption = new EncryptionManager();
      if (dbOrOptions?.encryptionKey) {
        this.encryption.setFallbackKey(dbOrOptions.encryptionKey);
      }
    }
    this.usageTracker = new UsageTracker(this.db);
  }

  /**
   * Initialize the manager (must be called before using)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.db.initialize();
    await this.initializeDefaults();
    this.initialized = true;
  }

  /**
   * Ensure the manager is initialized (auto-initialize if needed)
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Initialize default providers if database is empty
   */
  private async initializeDefaults(): Promise<void> {
    const providers = await this.db.all('SELECT id FROM providers');

    if (providers.length === 0) {
      // Insert built-in providers
      for (const provider of BUILTIN_PROVIDERS) {
        await this.createProviderInternal(provider);
      }
    }
  }

  /**
   * Internal method to create a provider (used during initialization)
   */
  private async createProviderInternal(
    input: Omit<AIProvider, 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    const stmt = this.db.getStatement('provider_insert');
    stmt.run({
      id: input.id,
      name: input.name,
      type: input.type,
      enabled: input.enabled ? 1 : 0,
      priority: input.priority,
      config: JSON.stringify(input.config || {}),
      models: JSON.stringify(input.models || []),
      defaultModel: input.defaultModel || null,
      baseUrl: input.baseUrl || null,
    });

    // Insert models into model_configs table
    for (const model of input.models || []) {
      const modelId = `${input.id}:${model.id}`;
      const modelStmt = this.db.getStatement('model_config_insert');
      modelStmt.run({
        id: modelId,
        providerId: input.id,
        modelId: model.id,
        displayName: model.displayName || model.id,
        contextWindow: model.contextWindow || 4096,
        maxOutputTokens: model.maxOutputTokens || 4096,
        pricingInput: model.pricing?.inputPerK || 0,
        pricingOutput: model.pricing?.outputPerK || 0,
        enabled: 1,
        config: JSON.stringify(model.config || {}),
      });
    }
  }

  // ============================================
  // Provider Management
  // ============================================

  /**
   * List all providers
   * @returns Array of providers sorted by priority (descending)
   */
  async listProviders(): Promise<AIProvider[]> {
    await this.ensureInitialized();

    const rows = await this.db.all<any>(
      'SELECT * FROM providers ORDER BY priority DESC, name ASC'
    );

    return rows.map(rowToProvider);
  }

  /**
   * Get a provider by ID
   * @param id - Provider ID
   * @returns Provider or null if not found
   */
  async getProvider(id: string): Promise<AIProvider | null> {
    await this.ensureInitialized();

    const row = await this.db.get<any>(
      'SELECT * FROM providers WHERE id = ?',
      [id]
    );

    return row ? rowToProvider(row) : null;
  }

  /**
   * Create a new provider
   * @param input - Provider creation input
   * @returns Created provider
   */
  async createProvider(input: CreateProviderInput): Promise<AIProvider> {
    await this.ensureInitialized();

    // Check if provider already exists
    const existing = await this.getProvider(input.id);
    if (existing) {
      throw new Error(`Provider with ID '${input.id}' already exists`);
    }

    const stmt = this.db.getStatement('provider_insert');
    stmt.run({
      id: input.id,
      name: input.name,
      type: input.type,
      enabled: 1,
      priority: 0,
      config: JSON.stringify(input.config || {}),
      models: JSON.stringify(input.models || []),
      defaultModel: input.defaultModel || null,
      baseUrl: input.baseUrl || null,
    });

    // Insert models into model_configs table
    for (const model of input.models || []) {
      const modelId = `${input.id}:${model.id}`;
      const modelStmt = this.db.getStatement('model_config_insert');
      modelStmt.run({
        id: modelId,
        providerId: input.id,
        modelId: model.id,
        displayName: model.displayName || model.id,
        contextWindow: model.contextWindow || 4096,
        maxOutputTokens: model.maxOutputTokens || 4096,
        pricingInput: model.pricing?.inputPerK || 0,
        pricingOutput: model.pricing?.outputPerK || 0,
        enabled: 1,
        config: JSON.stringify(model.config || {}),
      });
    }

    const provider = await this.getProvider(input.id);
    if (!provider) {
      throw new Error('Failed to create provider');
    }

    return provider;
  }

  /**
   * Update a provider
   * @param id - Provider ID
   * @param input - Update input
   * @returns Updated provider
   */
  async updateProvider(
    id: string,
    input: UpdateProviderInput
  ): Promise<AIProvider> {
    await this.ensureInitialized();

    const existing = await this.getProvider(id);
    if (!existing) {
      throw new Error(`Provider with ID '${id}' not found`);
    }

    const stmt = this.db.getStatement('provider_update');
    stmt.run({
      id,
      name: input.name ?? existing.name,
      type: existing.type,
      enabled: input.enabled !== undefined ? (input.enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
      priority: input.priority ?? existing.priority,
      config: JSON.stringify(input.config ?? existing.config),
      models: JSON.stringify(input.models ?? existing.models),
      defaultModel: input.defaultModel ?? existing.defaultModel ?? null,
      baseUrl: input.baseUrl ?? existing.baseUrl ?? null,
    });

    const provider = await this.getProvider(id);
    if (!provider) {
      throw new Error('Failed to update provider');
    }

    return provider;
  }

  /**
   * Delete a provider
   * @param id - Provider ID
   */
  async deleteProvider(id: string): Promise<void> {
    await this.ensureInitialized();

    const existing = await this.getProvider(id);
    if (!existing) {
      throw new Error(`Provider with ID '${id}' not found`);
    }

    // Delete related model_configs first (no CASCADE in schema)
    await this.db.run('DELETE FROM model_configs WHERE provider_id = ?', [id]);

    // Delete associated API keys (no CASCADE in schema)
    await this.db.run('DELETE FROM api_keys WHERE provider_id = ?', [id]);

    // Invalidate all cached API keys for this provider
    this.encryption.invalidateProviderCache(id);

    const stmt = this.db.getStatement('provider_delete');
    stmt.run(id);
  }

  /**
   * Set provider enabled status
   * @param id - Provider ID
   * @param enabled - Enabled status
   */
  async setProviderEnabled(id: string, enabled: boolean): Promise<void> {
    await this.ensureInitialized();

    const existing = await this.getProvider(id);
    if (!existing) {
      throw new Error(`Provider with ID '${id}' not found`);
    }

    await this.db.run(
      'UPDATE providers SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [enabled ? 1 : 0, id]
    );
  }

  /**
   * Set provider priority
   * @param id - Provider ID
   * @param priority - Priority value (higher = preferred)
   */
  async setProviderPriority(id: string, priority: number): Promise<void> {
    await this.ensureInitialized();

    const existing = await this.getProvider(id);
    if (!existing) {
      throw new Error(`Provider with ID '${id}' not found`);
    }

    await this.db.run(
      'UPDATE providers SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [priority, id]
    );
  }

  // ============================================
  // API Key Management
  // ============================================

  /**
   * Set an API key for a provider
   * @param input - API key input
   * @returns API key metadata (not the actual key)
   */
  async setAPIKey(input: SetAPIKeyInput): Promise<APIKey> {
    await this.ensureInitialized();

    // Verify provider exists
    const provider = await this.getProvider(input.providerId);
    if (!provider) {
      throw new Error(`Provider with ID '${input.providerId}' not found`);
    }

    const keyName = input.keyName || 'primary';
    const keyId = `${input.providerId}:${keyName}`;

    // Encrypt the API key
    const encryptedData = await this.encryption.encrypt(input.key);

    // Check if key already exists
    const existing = await this.db.get<any>(
      'SELECT id FROM api_keys WHERE provider_id = ? AND key_name = ?',
      [input.providerId, keyName]
    );

    if (existing) {
      // Update existing key
      await this.db.run(
        `UPDATE api_keys
         SET encrypted_key = ?, iv = ?, auth_tag = ?, is_valid = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          encryptedData.encrypted,
          encryptedData.iv || null,
          encryptedData.authTag || null,
          existing.id,
        ]
      );

      // Invalidate cache when key is updated
      this.encryption.invalidateCachedAPIKey(input.providerId, keyName);

      const apiKey = await this.getAPIKeyRecord(input.providerId, keyName);
      if (!apiKey) {
        throw new Error('Failed to update API key');
      }
      return apiKey;
    } else {
      // Insert new key
      const stmt = this.db.getStatement('api_key_insert');
      stmt.run({
        id: keyId,
        providerId: input.providerId,
        keyName,
        encryptedKey: encryptedData.encrypted,
        iv: encryptedData.iv || null,
        authTag: encryptedData.authTag || null,
        isValid: 0,
      });

      // Cache the new API key
      this.encryption.setCachedAPIKey(input.providerId, keyName, input.key);

      const apiKey = await this.getAPIKeyRecord(input.providerId, keyName);
      if (!apiKey) {
        throw new Error('Failed to create API key');
      }
      return apiKey;
    }
  }

  /**
   * Get API key record (internal helper)
   */
  private async getAPIKeyRecord(
    providerId: string,
    keyName: string
  ): Promise<APIKey | null> {
    const row = await this.db.get<any>(
      'SELECT * FROM api_keys WHERE provider_id = ? AND key_name = ?',
      [providerId, keyName]
    );

    return row ? rowToAPIKey(row) : null;
  }

  /**
   * Get the decrypted API key for a provider
   * @param providerId - Provider ID
   * @param keyName - Key name (default: 'primary')
   * @returns Decrypted API key or null
   */
  async getAPIKey(providerId: string, keyName?: string): Promise<string | null> {
    await this.ensureInitialized();

    const name = keyName || 'primary';

    // Check cache first
    const cachedKey = this.encryption.getCachedAPIKey(providerId, name);
    if (cachedKey !== undefined) {
      return cachedKey;
    }

    const row = await this.db.get<any>(
      'SELECT encrypted_key, iv, auth_tag FROM api_keys WHERE provider_id = ? AND key_name = ?',
      [providerId, name]
    );

    if (!row) {
      return null;
    }

    const encryptedData: EncryptedKeyData = {
      encrypted: row.encrypted_key,
      iv: row.iv || undefined,
      authTag: row.auth_tag || undefined,
    };

    const decrypted = await this.encryption.decrypt(encryptedData);

    // Cache the decrypted key for future use
    this.encryption.setCachedAPIKey(providerId, name, decrypted);

    return decrypted;
  }

  /**
   * Validate an API key without saving it
   * This method validates the key by making an actual API call
   *
   * @param providerId - Provider ID
   * @param apiKey - The API key to validate
   * @param options - Validation options (timeout, custom baseUrl)
   * @returns Validation result with detailed error info
   */
  async validateAPIKeyWithoutSaving(
    providerId: string,
    apiKey: string,
    options?: { timeout?: number; baseUrl?: string }
  ): Promise<APIKeyValidationResult> {
    await this.ensureInitialized();

    const provider = await this.getProvider(providerId);
    if (!provider) {
      return {
        valid: false,
        error: `Provider with ID '${providerId}' not found`,
        errorType: 'invalid_key',
      };
    }

    return APIKeyValidator.validate(providerId, apiKey, provider, options);
  }

  /**
   * Validate an API key by making a test API call
   * @param providerId - Provider ID
   * @returns True if key is valid
   */
  async validateAPIKey(providerId: string): Promise<boolean> {
    await this.ensureInitialized();

    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider with ID '${providerId}' not found`);
    }

    const apiKey = await this.getAPIKey(providerId);
    if (!apiKey) {
      return false;
    }

    try {
      const result = await APIKeyValidator.validate(providerId, apiKey, provider);

      // Update validation status in database
      await this.db.run(
        `UPDATE api_keys
         SET is_valid = ?, last_validated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE provider_id = ? AND key_name = 'primary'`,
        [result.valid ? 1 : 0, providerId]
      );

      return result.valid;
    } catch (_error) {
      // Mark as invalid on error
      await this.db.run(
        `UPDATE api_keys
         SET is_valid = 0, last_validated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE provider_id = ? AND key_name = 'primary'`,
        [providerId]
      );

      return false;
    }
  }

  /**
   * Delete an API key
   * @param providerId - Provider ID
   * @param keyName - Key name (default: 'primary')
   */
  async deleteAPIKey(providerId: string, keyName?: string): Promise<void> {
    await this.ensureInitialized();

    const name = keyName || 'primary';

    await this.db.run(
      'DELETE FROM api_keys WHERE provider_id = ? AND key_name = ?',
      [providerId, name]
    );

    // Invalidate cache when key is deleted
    this.encryption.invalidateCachedAPIKey(providerId, name);
  }

  /**
   * Check if a provider has a valid API key
   * @param providerId - Provider ID
   * @returns True if provider has a valid key
   */
  async hasValidAPIKey(providerId: string): Promise<boolean> {
    await this.ensureInitialized();

    const row = await this.db.get<any>(
      'SELECT is_valid FROM api_keys WHERE provider_id = ? AND is_valid = 1',
      [providerId]
    );

    return row !== undefined;
  }

  // ============================================
  // Model Management
  // ============================================

  /**
   * Convert model config database row to ModelInfo type
   */
  private rowToModelInfo(row: any): ModelInfo {
    return {
      id: row.model_id,
      providerId: row.provider_id,
      displayName: row.display_name,
      contextWindow: row.context_window,
      maxOutputTokens: row.max_output_tokens,
      pricing: {
        inputPerK: row.pricing_input,
        outputPerK: row.pricing_output,
      },
      enabled: row.enabled === 1,
      config: row.config ? JSON.parse(row.config) : undefined,
    };
  }

  /**
   * List models (optionally filtered by provider)
   * @param providerId - Provider ID (optional, lists all if not provided)
   * @returns Array of models
   */
  async listModels(providerId?: string): Promise<ModelInfo[]> {
    await this.ensureInitialized();

    let sql = 'SELECT * FROM model_configs';
    const params: string[] = [];

    if (providerId) {
      sql += ' WHERE provider_id = ?';
      params.push(providerId);
    }

    sql += ' ORDER BY display_name ASC';

    const rows = await this.db.all<any>(sql, params);
    return rows.map((row) => this.rowToModelInfo(row));
  }

  /**
   * Get models for a provider (alias for listModels with providerId)
   * @param providerId - Provider ID
   * @returns Array of models
   */
  async getModels(providerId: string): Promise<ModelInfo[]> {
    return this.listModels(providerId);
  }

  /**
   * Get model info
   * @param providerId - Provider ID
   * @param modelId - Model ID
   * @returns Model info or null if not found
   */
  async getModel(providerId: string, modelId: string): Promise<ModelInfo | null> {
    await this.ensureInitialized();

    const row = await this.db.get<any>(
      'SELECT * FROM model_configs WHERE provider_id = ? AND model_id = ?',
      [providerId, modelId]
    );

    return row ? this.rowToModelInfo(row) : null;
  }

  /**
   * Get default model for provider
   * @param providerId - Provider ID
   * @returns Default model info or null
   */
  async getDefaultModel(providerId: string): Promise<ModelInfo | null> {
    await this.ensureInitialized();

    const provider = await this.getProvider(providerId);
    if (!provider || !provider.defaultModel) {
      return null;
    }

    return this.getModel(providerId, provider.defaultModel);
  }

  /**
   * Set default model for provider
   * @param providerId - Provider ID
   * @param modelId - Model ID to set as default
   */
  async setDefaultModel(providerId: string, modelId: string): Promise<void> {
    await this.ensureInitialized();

    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider with ID '${providerId}' not found`);
    }

    // Verify model exists for this provider
    const model = await this.getModel(providerId, modelId);
    if (!model) {
      throw new Error(`Model '${modelId}' not found for provider '${providerId}'`);
    }

    await this.db.run(
      'UPDATE providers SET default_model = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [modelId, providerId]
    );
  }

  /**
   * Update model configuration
   * @param providerId - Provider ID
   * @param modelId - Model ID
   * @param config - Partial model configuration to update
   * @returns Updated model info
   */
  async updateModel(
    providerId: string,
    modelId: string,
    config: Partial<ModelConfig>
  ): Promise<ModelInfo> {
    await this.ensureInitialized();

    const existing = await this.getModel(providerId, modelId);
    if (!existing) {
      throw new Error(`Model '${modelId}' not found for provider '${providerId}'`);
    }

    const mergedConfig = { ...existing.config, ...config };

    await this.db.run(
      `UPDATE model_configs
       SET config = ?, updated_at = CURRENT_TIMESTAMP
       WHERE provider_id = ? AND model_id = ?`,
      [JSON.stringify(mergedConfig), providerId, modelId]
    );

    const updated = await this.getModel(providerId, modelId);
    if (!updated) {
      throw new Error('Failed to update model');
    }

    return updated;
  }

  // ============================================
  // Provider Selection
  // ============================================

  /**
   * Select a provider based on criteria
   * @param options - Selection options
   * @returns Selected provider or undefined
   */
  async selectProvider(options: ProviderSelectionOptions = {}): Promise<AIProvider | undefined> {
    await this.ensureInitialized();

    // Build query based on options
    let sql = `
      SELECT p.*
      FROM providers p
      LEFT JOIN api_keys k ON p.id = k.provider_id
      WHERE p.enabled = 1
    `;
    const params: any[] = [];

    // Filter by specific provider ID
    if (options.providerId) {
      sql += ' AND p.id = ?';
      params.push(options.providerId);
    }

    // Filter by provider type
    if (options.type) {
      sql += ' AND p.type = ?';
      params.push(options.type);
    }

    // Filter by model availability
    if (options.modelId) {
      sql += ' AND EXISTS (SELECT 1 FROM model_configs m WHERE m.provider_id = p.id AND m.model_id = ?)';
      params.push(options.modelId);
    }

    // Prefer providers with API keys (but don't require them)
    sql += ' ORDER BY COALESCE(k.is_valid, 0) DESC, p.priority DESC, p.name ASC LIMIT 1';

    const row = await this.db.get<any>(sql, params);
    return row ? rowToProvider(row) : undefined;
  }

  /**
   * Get active provider (highest priority with valid key)
   * @returns Active provider or null
   */
  async getActiveProvider(): Promise<AIProvider | null> {
    await this.ensureInitialized();

    const rows = await this.db.all<any>(
      `SELECT p.*
       FROM providers p
       INNER JOIN api_keys k ON p.id = k.provider_id
       WHERE p.enabled = 1 AND k.is_valid = 1
       ORDER BY p.priority DESC, p.name ASC
       LIMIT 1`
    );

    return rows.length > 0 ? rowToProvider(rows[0]) : null;
  }

  /**
   * Get all active providers (enabled with valid keys)
   * @returns Array of active providers
   */
  async getActiveProviders(): Promise<AIProvider[]> {
    await this.ensureInitialized();

    const rows = await this.db.all<any>(
      `SELECT p.*
       FROM providers p
       INNER JOIN api_keys k ON p.id = k.provider_id
       WHERE p.enabled = 1 AND k.is_valid = 1
       ORDER BY p.priority DESC, p.name ASC`
    );

    return rows.map(rowToProvider);
  }

  // ============================================
  // Usage Tracking
  // ============================================

  /**
   * Log usage for a request
   * @param input - Usage log input
   * @returns Created usage log entry
   */
  async logUsage(input: LogUsageInput): Promise<UsageLog> {
    await this.ensureInitialized();
    return this.usageTracker.logUsage(input);
  }

  /**
   * Get usage logs with filters
   * @param filters - Query filters
   * @returns Array of usage logs
   */
  async getUsageLogs(filters?: UsageLogFilters): Promise<UsageLog[]> {
    await this.ensureInitialized();
    return this.usageTracker.getLogs(filters);
  }

  /**
   * Get usage summary
   * @param filters - Query filters
   * @returns Usage summary statistics
   */
  async getUsageSummary(filters?: UsageLogFilters): Promise<UsageSummary> {
    await this.ensureInitialized();
    return this.usageTracker.getSummary(filters);
  }

  // ============================================
  // Export/Import
  // ============================================

  /**
   * Export configuration (keys excluded for security)
   * @returns Export data
   */
  async exportConfig(): Promise<ModelExportData> {
    await this.ensureInitialized();

    const providers = await this.listProviders();

    // Get API key metadata (not actual keys)
    const apiKeyRows = await this.db.all<any>('SELECT provider_id, key_name, is_valid FROM api_keys');
    const apiKeys = apiKeyRows.map((row) => ({
      providerId: row.provider_id,
      keyName: row.key_name,
      hasKey: true,
      isValid: row.is_valid === 1,
    }));

    // Get usage summary
    const usageSummary = await this.getUsageSummary();

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        enabled: p.enabled,
        priority: p.priority,
        config: p.config,
        models: p.models,
        defaultModel: p.defaultModel,
        baseUrl: p.baseUrl,
      })),
      apiKeys,
      usageSummary,
    };
  }

  /**
   * Import configuration
   * @param data - Export data to import
   */
  async importConfig(data: ModelExportData): Promise<void> {
    await this.ensureInitialized();

    // Import providers (skip existing)
    for (const provider of data.providers) {
      const existing = await this.getProvider(provider.id);
      if (!existing) {
        await this.createProvider({
          id: provider.id,
          name: provider.name,
          type: provider.type,
          baseUrl: provider.baseUrl,
          config: provider.config,
          models: provider.models,
          defaultModel: provider.defaultModel,
        });
      } else {
        // Update existing provider
        await this.updateProvider(provider.id, {
          name: provider.name,
          enabled: provider.enabled,
          priority: provider.priority,
          config: provider.config,
          models: provider.models,
          defaultModel: provider.defaultModel,
          baseUrl: provider.baseUrl,
        });
      }
    }

    // Note: API keys are NOT imported for security reasons
    // Users must re-enter their API keys after import
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Close the manager and release resources
   */
  async close(): Promise<void> {
    await this.db.close();
    this.initialized = false;
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get database path
   */
  getDatabasePath(): string {
    return this.db.getDatabasePath();
  }
}
