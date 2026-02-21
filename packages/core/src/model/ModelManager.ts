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
  CurrentProviderResult,
  EncryptedKeyData,
  LogUsageInput,
  ModelConfig,
  ModelExportData,
  ModelInfo,
  ModelManagerOptions,
  ProviderBackup,
  ProviderScope,
  SetAPIKeyInput,
  SwitchProviderResult,
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
      toolId: 'global',  // Use 'global' for global providers
      name: input.name,
      type: input.type,
      enabled: input.enabled ? 1 : 0,
      priority: input.priority,
      config: JSON.stringify(input.config || {}),
      models: JSON.stringify(input.models || []),
      defaultModel: input.defaultModel || null,
      baseUrl: input.baseUrl || null,
      isGlobal: 1,
      isCurrentGlobal: 0,
      isCurrentTool: 0,
      sortIndex: input.priority,
      category: 'third-party',
      notes: null,
      meta: '{}',
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
   * @param toolId - Optional tool ID (defaults to 'global')
   * @returns Provider or null if not found
   */
  async getProvider(id: string, toolId?: string): Promise<AIProvider | null> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';
    const row = await this.db.get<any>(
      "SELECT * FROM providers WHERE id = ? AND tool_id = ?",
      [id, effectiveToolId]
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

    const toolId = input.toolId ?? 'global';
    const isGlobal = toolId === 'global';

    // Check if provider already exists for this scope
    const existing = await this.getProvider(input.id, toolId);
    if (existing) {
      const scope = isGlobal ? 'global' : `tool '${toolId}'`;
      throw new Error(`Provider with ID '${input.id}' already exists in ${scope} scope`);
    }

    const stmt = this.db.getStatement('provider_insert');
    stmt.run({
      id: input.id,
      toolId: toolId,
      name: input.name,
      type: input.type,
      enabled: 1,
      priority: 0,
      config: JSON.stringify(input.config || {}),
      models: JSON.stringify(input.models || []),
      defaultModel: input.defaultModel || null,
      baseUrl: input.baseUrl || null,
      isGlobal: isGlobal ? 1 : 0,
      isCurrentGlobal: 0,
      isCurrentTool: 0,
      sortIndex: 0,
      category: input.category || 'third-party',
      notes: input.notes || null,
      meta: JSON.stringify(input.meta || {}),
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

    const provider = await this.getProvider(input.id, toolId);
    if (!provider) {
      throw new Error('Failed to create provider');
    }

    return provider;
  }

  /**
   * Update a provider
   * @param id - Provider ID
   * @param input - Update input
   * @param toolId - Optional tool ID (defaults to 'global')
   * @returns Updated provider
   */
  async updateProvider(
    id: string,
    input: UpdateProviderInput,
    toolId?: string
  ): Promise<AIProvider> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';
    const existing = await this.getProvider(id, effectiveToolId);
    if (!existing) {
      throw new Error(`Provider with ID '${id}' not found in scope '${effectiveToolId}'`);
    }

    const stmt = this.db.getStatement('provider_update');
    stmt.run({
      id,
      toolId: effectiveToolId,
      name: input.name ?? existing.name,
      type: existing.type,
      enabled: input.enabled !== undefined ? (input.enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
      priority: input.priority ?? existing.priority,
      config: JSON.stringify(input.config ?? existing.config),
      models: JSON.stringify(input.models ?? existing.models),
      defaultModel: input.defaultModel ?? existing.defaultModel ?? null,
      baseUrl: input.baseUrl ?? existing.baseUrl ?? null,
      isGlobal: effectiveToolId === 'global' ? 1 : 0,
      isCurrentGlobal: 0,
      isCurrentTool: 0,
      sortIndex: input.priority ?? existing.priority,
      category: input.category ?? 'third-party',
      notes: input.notes ?? null,
      meta: JSON.stringify(input.meta ?? {}),
    });

    const provider = await this.getProvider(id, effectiveToolId);
    if (!provider) {
      throw new Error('Failed to update provider');
    }

    return provider;
  }

  /**
   * Delete a provider
   * @param id - Provider ID
   * @param toolId - Optional tool ID (defaults to 'global')
   */
  async deleteProvider(id: string, toolId?: string): Promise<void> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';
    const existing = await this.getProvider(id, effectiveToolId);
    if (!existing) {
      throw new Error(`Provider with ID '${id}' not found in scope '${effectiveToolId}'`);
    }

    // Delete related model_configs first (no CASCADE in schema)
    await this.db.run('DELETE FROM model_configs WHERE provider_id = ?', [id]);

    // Delete associated API keys (no CASCADE in schema)
    await this.db.run(
      'DELETE FROM api_keys WHERE provider_id = ? AND provider_tool_id = ?',
      [id, effectiveToolId]
    );

    // Invalidate all cached API keys for this provider (with toolId)
    this.encryption.invalidateProviderCache(id, effectiveToolId);

    const stmt = this.db.getStatement('provider_delete');
    stmt.run(id, effectiveToolId);
  }

  /**
   * Set provider enabled status
   * @param id - Provider ID
   * @param enabled - Enabled status
   * @param toolId - Optional tool ID (defaults to 'global')
   */
  async setProviderEnabled(id: string, enabled: boolean, toolId?: string): Promise<void> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';
    const existing = await this.getProvider(id, effectiveToolId);
    if (!existing) {
      throw new Error(`Provider with ID '${id}' not found in scope '${effectiveToolId}'`);
    }

    await this.db.run(
      'UPDATE providers SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tool_id = ?',
      [enabled ? 1 : 0, id, effectiveToolId]
    );
  }

  /**
   * Set provider priority
   * @param id - Provider ID
   * @param priority - Priority value (higher = preferred)
   */
  async setProviderPriority(id: string, priority: number, toolId?: string): Promise<void> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';
    const existing = await this.getProvider(id, effectiveToolId);
    if (!existing) {
      throw new Error(`Provider with ID '${id}' not found in scope '${effectiveToolId}'`);
    }

    await this.db.run(
      'UPDATE providers SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tool_id = ?',
      [priority, id, effectiveToolId]
    );
  }

  // ============================================
  // API Key Management
  // ============================================

  /**
   * Set an API key for a provider
   * @param input - API key input (can include toolId)
   * @param toolId - Optional tool ID (defaults to 'global', overridden by input.toolId)
   * @returns API key metadata (not the actual key)
   */
  async setAPIKey(input: SetAPIKeyInput, toolId?: string): Promise<APIKey> {
    await this.ensureInitialized();

    // Prefer input.toolId, then parameter toolId, then default to 'global'
    const effectiveToolId = input.toolId ?? toolId ?? 'global';

    // Verify provider exists
    const provider = await this.getProvider(input.providerId, effectiveToolId);
    if (!provider) {
      throw new Error(`Provider with ID '${input.providerId}' not found in scope '${effectiveToolId}'`);
    }

    const keyName = input.keyName || 'primary';
    const keyId = `${input.providerId}:${effectiveToolId}:${keyName}`;

    // Encrypt the API key
    const encryptedData = await this.encryption.encrypt(input.key);

    // Check if key already exists
    const existing = await this.db.get<any>(
      'SELECT id FROM api_keys WHERE provider_id = ? AND provider_tool_id = ? AND key_name = ?',
      [input.providerId, effectiveToolId, keyName]
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

      // Invalidate cache when key is updated (with toolId)
      this.encryption.invalidateCachedAPIKey(input.providerId, keyName, effectiveToolId);

      const apiKey = await this.getAPIKeyRecord(input.providerId, keyName, effectiveToolId);
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
        providerToolId: effectiveToolId,
        keyName,
        encryptedKey: encryptedData.encrypted,
        iv: encryptedData.iv || null,
        authTag: encryptedData.authTag || null,
        isValid: 0,
      });

      // Cache the new API key with toolId
      this.encryption.setCachedAPIKey(input.providerId, keyName, effectiveToolId, input.key);

      const apiKey = await this.getAPIKeyRecord(input.providerId, keyName, effectiveToolId);
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
    keyName: string,
    toolId?: string
  ): Promise<APIKey | null> {
    const effectiveToolId = toolId ?? 'global';
    const row = await this.db.get<any>(
      'SELECT * FROM api_keys WHERE provider_id = ? AND provider_tool_id = ? AND key_name = ?',
      [providerId, effectiveToolId, keyName]
    );

    return row ? rowToAPIKey(row) : null;
  }

  /**
   * Get the decrypted API key for a provider
   * @param providerId - Provider ID
   * @param keyName - Key name (default: 'primary')
   * @param toolId - Optional tool ID (defaults to 'global')
   * @returns Decrypted API key or null
   */
  async getAPIKey(providerId: string, keyName?: string, toolId?: string): Promise<string | null> {
    await this.ensureInitialized();

    const name = keyName || 'primary';
    const effectiveToolId = toolId ?? 'global';

    // Check cache first (with toolId)
    const cachedKey = this.encryption.getCachedAPIKey(providerId, name, effectiveToolId);
    if (cachedKey !== undefined) {
      return cachedKey;
    }

    const row = await this.db.get<any>(
      'SELECT encrypted_key, iv, auth_tag FROM api_keys WHERE provider_id = ? AND provider_tool_id = ? AND key_name = ?',
      [providerId, effectiveToolId, name]
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

    // Cache the decrypted key for future use (with toolId)
    this.encryption.setCachedAPIKey(providerId, name, effectiveToolId, decrypted);

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
   * @param toolId - Optional tool ID (defaults to 'global')
   * @returns True if key is valid
   */
  async validateAPIKey(providerId: string, toolId?: string): Promise<boolean> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';

    const provider = await this.getProvider(providerId, effectiveToolId);
    if (!provider) {
      throw new Error(`Provider with ID '${providerId}' not found in scope '${effectiveToolId}'`);
    }

    const apiKey = await this.getAPIKey(providerId, 'primary', effectiveToolId);
    if (!apiKey) {
      return false;
    }

    try {
      const result = await APIKeyValidator.validate(providerId, apiKey, provider);

      // Update validation status in database
      await this.db.run(
        `UPDATE api_keys
         SET is_valid = ?, last_validated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE provider_id = ? AND provider_tool_id = ? AND key_name = 'primary'`,
        [result.valid ? 1 : 0, providerId, effectiveToolId]
      );

      return result.valid;
    } catch (_error) {
      // Mark as invalid on error
      await this.db.run(
        `UPDATE api_keys
         SET is_valid = 0, last_validated = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE provider_id = ? AND provider_tool_id = ? AND key_name = 'primary'`,
        [providerId, effectiveToolId]
      );

      return false;
    }
  }

  /**
   * Delete an API key
   * @param providerId - Provider ID
   * @param keyName - Key name (default: 'primary')
   * @param toolId - Optional tool ID (defaults to 'global')
   */
  async deleteAPIKey(providerId: string, keyName?: string, toolId?: string): Promise<void> {
    await this.ensureInitialized();

    const name = keyName || 'primary';
    const effectiveToolId = toolId ?? 'global';

    await this.db.run(
      'DELETE FROM api_keys WHERE provider_id = ? AND provider_tool_id = ? AND key_name = ?',
      [providerId, effectiveToolId, name]
    );

    // Invalidate cache when key is deleted (with toolId)
    this.encryption.invalidateCachedAPIKey(providerId, name, effectiveToolId);
  }

  /**
   * Check if a provider has a valid API key
   * @param providerId - Provider ID
   * @param toolId - Optional tool ID (defaults to 'global')
   * @returns True if provider has a valid key
   */
  async hasValidAPIKey(providerId: string, toolId?: string): Promise<boolean> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';

    const row = await this.db.get<any>(
      'SELECT is_valid FROM api_keys WHERE provider_id = ? AND provider_tool_id = ? AND is_valid = 1',
      [providerId, effectiveToolId]
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
   * @param toolId - Optional tool ID (defaults to 'global')
   * @returns Active provider or null
   */
  async getActiveProvider(toolId?: string): Promise<AIProvider | null> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';

    const rows = await this.db.all<any>(
      `SELECT p.*
       FROM providers p
       INNER JOIN api_keys k ON p.id = k.provider_id AND p.tool_id = k.provider_tool_id
       WHERE p.enabled = 1 AND k.is_valid = 1 AND p.tool_id = ?
       ORDER BY p.priority DESC, p.name ASC
       LIMIT 1`,
      [effectiveToolId]
    );

    return rows.length > 0 ? rowToProvider(rows[0]) : null;
  }

  /**
   * Get all active providers (enabled with valid keys)
   * @param toolId - Optional tool ID (defaults to 'global')
   * @returns Array of active providers
   */
  async getActiveProviders(toolId?: string): Promise<AIProvider[]> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';

    const rows = await this.db.all<any>(
      `SELECT p.*
       FROM providers p
       INNER JOIN api_keys k ON p.id = k.provider_id AND p.tool_id = k.provider_tool_id
       WHERE p.enabled = 1 AND k.is_valid = 1 AND p.tool_id = ?
       ORDER BY p.priority DESC, p.name ASC`,
      [effectiveToolId]
    );

    return rows.map(rowToProvider);
  }

  // ============================================
  // Current Provider Query (Hybrid Tool Isolation)
  // ============================================

  /**
   * Get the current provider with priority logic for hybrid tool isolation
   *
   * Priority order:
   * 1. Tool-specific current provider (if toolId provided)
   * 2. Global current provider (fallback)
   *
   * @param toolId - Optional tool ID for tool-specific lookup
   * @returns Current provider result with scope info, or null if not found
   */
  async getCurrentProvider(toolId?: string): Promise<CurrentProviderResult | null> {
    await this.ensureInitialized();

    // If toolId is provided, try tool-specific provider first
    if (toolId) {
      const toolProvider = await this.getToolCurrentProvider(toolId);
      if (toolProvider) {
        return {
          provider: toolProvider,
          scope: 'tool-specific',
          toolId,
        };
      }
    }

    // Fall back to global current provider
    const globalProvider = await this.getGlobalCurrentProvider();
    if (globalProvider) {
      return {
        provider: globalProvider,
        scope: 'global',
      };
    }

    return null;
  }

  /**
   * Get the global current provider
   *
   * Query: is_global = 1 AND is_current_global = 1
   * Falls back to getActiveProvider() if hybrid columns don't exist
   *
   * @returns Global current provider or null
   */
  async getGlobalCurrentProvider(): Promise<AIProvider | null> {
    await this.ensureInitialized();

    // Check if hybrid tool isolation columns exist
    const hasHybridColumns = await this.checkHybridColumnsExist();

    if (hasHybridColumns) {
      // Use new hybrid query
      const row = await this.db.get<any>(
        `SELECT p.*
         FROM providers p
         WHERE p.enabled = 1 AND p.is_global = 1 AND p.is_current_global = 1
         ORDER BY p.priority DESC
         LIMIT 1`
      );

      return row ? rowToProvider(row) : null;
    } else {
      // Fallback to existing getActiveProvider for backward compatibility
      return this.getActiveProvider();
    }
  }

  /**
   * Get the tool-specific current provider
   *
   * Query: tool_id = ? AND is_current_tool = 1
   * Returns null if hybrid columns don't exist (graceful fallback)
   *
   * @param toolId - Tool ID
   * @returns Tool-specific current provider or null
   */
  async getToolCurrentProvider(toolId: string): Promise<AIProvider | null> {
    await this.ensureInitialized();

    // Check if hybrid tool isolation columns exist
    const hasHybridColumns = await this.checkHybridColumnsExist();

    if (!hasHybridColumns) {
      // Hybrid columns don't exist yet, return null
      // This forces fallback to global provider
      return null;
    }

    const row = await this.db.get<any>(
      `SELECT p.*
       FROM providers p
       WHERE p.enabled = 1 AND p.tool_id = ? AND p.is_current_tool = 1
       ORDER BY p.priority DESC
       LIMIT 1`,
      [toolId]
    );

    return row ? rowToProvider(row) : null;
  }

  /**
   * Check if hybrid tool isolation columns exist in the providers table
   * This allows graceful fallback during migration
   */
  private async checkHybridColumnsExist(): Promise<boolean> {
    try {
      const columns = await this.db.all<any>(
        "PRAGMA table_info(providers)"
      );
      const columnNames = columns.map(col => col.name);
      return (
        columnNames.includes('tool_id') &&
        columnNames.includes('is_global') &&
        columnNames.includes('is_current_global') &&
        columnNames.includes('is_current_tool')
      );
    } catch {
      return false;
    }
  }

  /**
   * Get API key with priority logic for hybrid tool isolation
   *
   * Priority order (when toolId is provided):
   * 1. Tool-specific API key for the provider (with provider_tool_id = toolId)
   * 2. Global API key for the provider (fallback, with provider_tool_id = 'global')
   *
   * @param providerId - Provider ID
   * @param keyName - Key name (default: 'primary')
   * @param toolId - Optional tool ID for priority lookup
   * @returns Decrypted API key or null
   */
  async getAPIKeyWithPriority(
    providerId: string,
    keyName?: string,
    toolId?: string
  ): Promise<string | null> {
    await this.ensureInitialized();

    const name = keyName || 'primary';

    // If toolId provided, try tool-specific API key first
    if (toolId && toolId !== 'global') {
      const toolKey = await this.getAPIKey(providerId, name, toolId);
      if (toolKey) {
        return toolKey;
      }
    }

    // Fall back to global API key
    return this.getAPIKey(providerId, name, 'global');
  }

  /**
   * List all global providers
   * Falls back to listProviders() if hybrid columns don't exist
   *
   * @returns Array of global providers
   */
  async listGlobalProviders(): Promise<AIProvider[]> {
    await this.ensureInitialized();

    const hasHybridColumns = await this.checkHybridColumnsExist();

    if (hasHybridColumns) {
      const rows = await this.db.all<any>(
        `SELECT * FROM providers
         WHERE is_global = 1 OR tool_id IS NULL
         ORDER BY priority DESC, name ASC`
      );
      return rows.map(rowToProvider);
    } else {
      // Fallback to list all providers (backward compatibility)
      return this.listProviders();
    }
  }

  /**
   * List all providers for a specific tool
   * Returns empty array if hybrid columns don't exist
   *
   * @param toolId - Tool ID
   * @returns Array of tool-specific providers
   */
  async listToolProviders(toolId: string): Promise<AIProvider[]> {
    await this.ensureInitialized();

    const hasHybridColumns = await this.checkHybridColumnsExist();

    if (!hasHybridColumns) {
      return [];
    }

    const rows = await this.db.all<any>(
      `SELECT * FROM providers
       WHERE tool_id = ?
       ORDER BY priority DESC, name ASC`,
      [toolId]
    );

    return rows.map(rowToProvider);
  }

  /**
   * Set a provider as the global default
   * @param providerId - Provider ID
   */
  async setGlobalDefaultProvider(providerId: string): Promise<void> {
    await this.ensureInitialized();

    // Check if provider exists in global scope
    const provider = await this.getProvider(providerId, 'global');
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found in global scope`);
    }

    // Unset all global current flags
    await this.db.run(
      'UPDATE providers SET is_current_global = 0 WHERE is_global = 1'
    );

    // Set the new global default
    await this.db.run(
      'UPDATE providers SET is_current_global = 1, updated_at = ? WHERE id = ? AND tool_id = ?',
      [new Date().toISOString(), providerId, 'global']
    );
  }

  /**
   * Set a tool-specific provider override
   * @param toolId - Tool ID
   * @param providerId - Provider ID
   */
  async setToolOverrideProvider(toolId: string, providerId: string): Promise<void> {
    await this.ensureInitialized();

    // Check if provider exists for this tool
    const provider = await this.getProvider(providerId, toolId);
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found for tool '${toolId}'`);
    }

    // Unset current tool flag for all providers of this tool
    await this.db.run(
      'UPDATE providers SET is_current_tool = 0 WHERE tool_id = ?',
      [toolId]
    );

    // Set the new tool-specific current provider
    await this.db.run(
      'UPDATE providers SET is_current_tool = 1, updated_at = ? WHERE id = ? AND tool_id = ?',
      [new Date().toISOString(), providerId, toolId]
    );
  }

  /**
   * Clear tool-specific provider override (fallback to global)
   * @param toolId - Tool ID
   */
  async clearToolOverride(toolId: string): Promise<void> {
    await this.ensureInitialized();

    // Unset current tool flag for all providers of this tool
    await this.db.run(
      'UPDATE providers SET is_current_tool = 0 WHERE tool_id = ?',
      [toolId]
    );
  }

  /**
   * Create a global provider
   * Convenience method that calls createProvider with toolId = 'global'
   * @param input - Provider creation input
   * @returns Created provider
   */
  async createGlobalProvider(input: CreateProviderInput): Promise<AIProvider> {
    return this.createProvider({ ...input, toolId: 'global' });
  }

  /**
   * Create a tool-specific provider
   * Convenience method that calls createProvider with specified toolId
   * @param toolId - Tool ID
   * @param input - Provider creation input
   * @returns Created provider
   */
  async createToolProvider(toolId: string, input: CreateProviderInput): Promise<AIProvider> {
    return this.createProvider({ ...input, toolId });
  }

  // ============================================
  // Provider Backfill Mechanism
  // ============================================

  /**
   * Key for storing backup in provider's meta field
   */
  private static readonly BACKUP_META_KEY = '_providerSwitchBackup';

  /**
   * Backup the current provider configuration before switching
   * Stores backup data in the new provider's meta field
   *
   * @param newProviderId - The ID of the new provider to switch to
   * @param newProviderToolId - The tool ID of the new provider (defaults to 'global')
   * @returns The backup data that was created, or null if no current provider
   */
  async backupProviderConfig(
    newProviderId: string,
    newProviderToolId?: string
  ): Promise<ProviderBackup | null> {
    await this.ensureInitialized();

    const newToolId = newProviderToolId ?? 'global';

    // Get the current provider based on scope
    const currentResult = await this.getCurrentProvider(newToolId === 'global' ? undefined : newToolId);

    if (!currentResult) {
      // No current provider to backup
      return null;
    }

    const backup: ProviderBackup = {
      previousProviderId: currentResult.provider.id,
      previousConfig: currentResult.provider.config,
      previousScope: currentResult.scope,
      previousToolId: currentResult.toolId,
      backupTimestamp: new Date().toISOString(),
    };

    // Store backup in the new provider's meta field
    await this.updateProviderMeta(newProviderId, newToolId, {
      [ModelManager.BACKUP_META_KEY]: backup,
    });

    return backup;
  }

  /**
   * Restore provider configuration from backup
   *
   * @param providerId - The provider ID that has the backup
   * @param toolId - The tool ID of the provider (defaults to 'global')
   * @returns True if restoration was successful, false if no backup found
   */
  async restoreProviderConfig(providerId: string, toolId?: string): Promise<boolean> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';

    // Get the backup from the provider's meta
    const row = await this.db.get<{ meta: string }>(
      'SELECT meta FROM providers WHERE id = ? AND tool_id = ?',
      [providerId, effectiveToolId]
    );

    if (!row || !row.meta) {
      return false;
    }

    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(row.meta);
    } catch {
      return false;
    }

    const backup = meta[ModelManager.BACKUP_META_KEY] as ProviderBackup | undefined;
    if (!backup) {
      return false;
    }

    // Restore the previous provider's current status
    if (backup.previousScope === 'global') {
      // Restore global default provider
      await this.setGlobalDefaultProvider(backup.previousProviderId);
    } else {
      // Restore tool-specific provider
      if (backup.previousToolId) {
        await this.setToolOverrideProvider(backup.previousToolId, backup.previousProviderId);
      }
    }

    // Clear the backup after restoration
    await this.clearBackupConfig(providerId, effectiveToolId);

    return true;
  }

  /**
   * Clear the backup configuration from a provider's meta field
   *
   * @param providerId - The provider ID
   * @param toolId - The tool ID of the provider (defaults to 'global')
   */
  async clearBackupConfig(providerId: string, toolId?: string): Promise<void> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';

    // Get current meta
    const row = await this.db.get<{ meta: string }>(
      'SELECT meta FROM providers WHERE id = ? AND tool_id = ?',
      [providerId, effectiveToolId]
    );

    if (!row) {
      return;
    }

    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(row.meta || '{}');
    } catch {
      meta = {};
    }

    // Remove backup key
    delete meta[ModelManager.BACKUP_META_KEY];

    // Update meta
    await this.db.run(
      'UPDATE providers SET meta = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tool_id = ?',
      [JSON.stringify(meta), providerId, effectiveToolId]
    );
  }

  /**
   * Get the backup data from a provider's meta field
   *
   * @param providerId - The provider ID
   * @param toolId - The tool ID of the provider (defaults to 'global')
   * @returns The backup data or null if not found
   */
  async getProviderBackup(providerId: string, toolId?: string): Promise<ProviderBackup | null> {
    await this.ensureInitialized();

    const effectiveToolId = toolId ?? 'global';

    const row = await this.db.get<{ meta: string }>(
      'SELECT meta FROM providers WHERE id = ? AND tool_id = ?',
      [providerId, effectiveToolId]
    );

    if (!row || !row.meta) {
      return null;
    }

    try {
      const meta = JSON.parse(row.meta);
      const backup = meta[ModelManager.BACKUP_META_KEY];
      return backup as ProviderBackup || null;
    } catch {
      return null;
    }
  }

  /**
   * Switch provider with backfill mechanism
   * Creates a backup before switching and restores on failure
   *
   * @param newProviderId - The ID of the new provider to switch to
   * @param options - Switch options
   * @param options.toolId - Tool ID for tool-specific switch (defaults to global)
   * @param options.validateSwitch - Optional async function to validate the switch
   * @returns Result of the switch operation
   */
  async switchProviderWithBackfill(
    newProviderId: string,
    options?: {
      toolId?: string;
      validateSwitch?: (provider: AIProvider) => Promise<boolean>;
    }
  ): Promise<SwitchProviderResult> {
    await this.ensureInitialized();

    const toolId = options?.toolId ?? 'global';
    const validateSwitch = options?.validateSwitch;
    let backupCreated = false;
    let backupRestored = false;

    try {
      // Step 1: Backup current configuration
      const backup = await this.backupProviderConfig(newProviderId, toolId);
      backupCreated = backup !== null;

      // Step 2: Perform the switch
      if (toolId === 'global') {
        await this.setGlobalDefaultProvider(newProviderId);
      } else {
        await this.setToolOverrideProvider(toolId, newProviderId);
      }

      // Step 3: Validate the switch if validator provided
      if (validateSwitch) {
        const newProvider = await this.getProvider(newProviderId, toolId);
        if (!newProvider) {
          throw new Error(`Provider '${newProviderId}' not found after switch`);
        }

        const isValid = await validateSwitch(newProvider);
        if (!isValid) {
          throw new Error('Switch validation failed');
        }
      }

      // Step 4: Clear backup on success
      if (backupCreated) {
        await this.clearBackupConfig(newProviderId, toolId);
      }

      const newProvider = await this.getProvider(newProviderId, toolId);

      return {
        success: true,
        newProvider: newProvider ?? undefined,
        backupCreated,
        backupRestored,
      };
    } catch (error) {
      // Step 5: Restore backup on failure
      if (backupCreated) {
        const restored = await this.restoreProviderConfig(newProviderId, toolId);
        backupRestored = restored;
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        backupCreated,
        backupRestored,
      };
    }
  }

  /**
   * Update a provider's meta field by merging with new data
   *
   * @param providerId - Provider ID
   * @param toolId - Tool ID
   * @param newMeta - New meta data to merge
   */
  private async updateProviderMeta(
    providerId: string,
    toolId: string,
    newMeta: Record<string, unknown>
  ): Promise<void> {
    const row = await this.db.get<{ meta: string }>(
      'SELECT meta FROM providers WHERE id = ? AND tool_id = ?',
      [providerId, toolId]
    );

    let existingMeta: Record<string, unknown> = {};
    if (row && row.meta) {
      try {
        existingMeta = JSON.parse(row.meta);
      } catch {
        existingMeta = {};
      }
    }

    const mergedMeta = { ...existingMeta, ...newMeta };

    await this.db.run(
      'UPDATE providers SET meta = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tool_id = ?',
      [JSON.stringify(mergedMeta), providerId, toolId]
    );
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
