/**
 * Model Configuration Management Types
 *
 * This module provides type definitions for managing AI model providers,
 * API keys, models, and usage tracking.
 */

// ============================================
// Provider Types
// ============================================

/**
 * Provider type classification
 */
export type ProviderType = 'openai-compatible' | 'anthropic' | 'azure' | 'custom';

/**
 * AI Provider configuration
 */
export interface AIProvider {
  /** Unique identifier (e.g., 'openai', 'anthropic') */
  id: string;
  /** Display name */
  name: string;
  /** Provider type */
  type: ProviderType;
  /** Whether provider is enabled */
  enabled: boolean;
  /** Selection priority (higher = preferred) */
  priority: number;
  /** Provider-specific configuration */
  config: ProviderConfig;
  /** Available models */
  models: ModelInfo[];
  /** Default model ID */
  defaultModel?: string;
  /** API base URL */
  baseUrl?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Rate limiting configuration */
  rateLimit?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
  /** Custom HTTP headers */
  customHeaders?: Record<string, string>;
  /** Additional provider-specific options */
  [key: string]: unknown;
}

// ============================================
// Model Types
// ============================================

/**
 * Model information
 */
export interface ModelInfo {
  /** Model identifier */
  id: string;
  /** Provider ID */
  providerId: string;
  /** Display name */
  displayName: string;
  /** Context window size (tokens) */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Pricing information */
  pricing: ModelPricing;
  /** Whether model is enabled */
  enabled: boolean;
  /** Model-specific configuration */
  config?: ModelConfig;
}

/**
 * Model pricing information
 */
export interface ModelPricing {
  /** Cost per 1K input tokens (USD) */
  inputPerK: number;
  /** Cost per 1K output tokens (USD) */
  outputPerK: number;
  /** Cost per 1K cache read tokens (USD, optional) */
  cacheReadPerK?: number;
  /** Cost per 1K cache creation tokens (USD, optional) */
  cacheCreationPerK?: number;
}

/**
 * Model-specific configuration parameters
 */
export interface ModelConfig {
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Nucleus sampling probability (0-1) */
  topP?: number;
  /** Frequency penalty (0-2) */
  frequencyPenalty?: number;
  /** Presence penalty (0-2) */
  presencePenalty?: number;
  /** Stop sequences */
  stop?: string[];
  /** Additional model parameters */
  [key: string]: unknown;
}

// ============================================
// API Key Types
// ============================================

/**
 * API Key metadata (never exposes the actual key)
 */
export interface APIKey {
  /** Unique identifier */
  id: string;
  /** Provider ID */
  providerId: string;
  /** Key name/identifier (e.g., 'primary', 'backup') */
  keyName: string;
  /** Whether key has been validated */
  isValid: boolean;
  /** Last validation timestamp */
  lastValidated?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Encrypted API key data
 */
export interface EncryptedKeyData {
  /** Encrypted key bytes */
  encrypted: Buffer;
  /** Initialization vector (for AES) */
  iv?: Buffer;
  /** Authentication tag (for GCM mode) */
  authTag?: Buffer;
}

// ============================================
// Usage Tracking Types
// ============================================

/**
 * Usage log entry
 */
export interface UsageLog {
  /** Log entry ID */
  id: number;
  /** Provider ID */
  providerId: string;
  /** Model used */
  model: string;
  /** Timestamp */
  timestamp: string;
  /** Input tokens count */
  inputTokens: number;
  /** Output tokens count */
  outputTokens: number;
  /** Total tokens count */
  totalTokens: number;
  /** Calculated cost in USD */
  cost: number;
  /** External request ID */
  requestId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Usage summary statistics
 */
export interface UsageSummary {
  /** Provider ID (null for all providers) */
  providerId?: string;
  /** Total number of requests */
  totalRequests: number;
  /** Total input tokens */
  totalInputTokens: number;
  /** Total output tokens */
  totalOutputTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Usage breakdown by model */
  byModel: Map<string, ModelUsageSummary>;
  /** Time period */
  period: {
    start: string;
    end: string;
  };
}

/**
 * Model-specific usage summary
 */
export interface ModelUsageSummary {
  /** Model ID */
  model: string;
  /** Number of requests */
  requests: number;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Cost in USD */
  cost: number;
}

// ============================================
// Manager Options Types
// ============================================

/**
 * ModelManager initialization options
 */
export interface ModelManagerOptions {
  /** Database file path (default: ~/.unify-ai/models.db) */
  dbPath?: string;
  /** Enable/disable usage tracking */
  enableUsageTracking?: boolean;
  /** Custom encryption key (for non-Electron environments) */
  encryptionKey?: Buffer;
}

// ============================================
// CRUD Operation Types
// ============================================

/**
 * Input for creating a new provider
 */
export interface CreateProviderInput {
  /** Provider ID */
  id: string;
  /** Display name */
  name: string;
  /** Provider type */
  type: ProviderType;
  /** API base URL */
  baseUrl?: string;
  /** Provider configuration */
  config?: ProviderConfig;
  /** Available models */
  models?: Omit<ModelInfo, 'providerId'>[];
  /** Default model ID */
  defaultModel?: string;
}

/**
 * Input for updating a provider
 */
export interface UpdateProviderInput {
  /** Display name */
  name?: string;
  /** Enable/disable */
  enabled?: boolean;
  /** Priority */
  priority?: number;
  /** Provider configuration */
  config?: Partial<ProviderConfig>;
  /** Available models */
  models?: Omit<ModelInfo, 'providerId'>[];
  /** Default model ID */
  defaultModel?: string;
  /** API base URL */
  baseUrl?: string;
}

/**
 * Input for setting an API key
 */
export interface SetAPIKeyInput {
  /** Provider ID */
  providerId: string;
  /** API key value */
  key: string;
  /** Key name/identifier (default: 'primary') */
  keyName?: string;
}

/**
 * Input for logging usage
 */
export interface LogUsageInput {
  /** Provider ID */
  providerId: string;
  /** Model used */
  model: string;
  /** Input tokens count */
  inputTokens: number;
  /** Output tokens count */
  outputTokens: number;
  /** Calculated cost (optional, will be calculated if not provided) */
  cost?: number;
  /** External request ID */
  requestId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Filters for usage log queries
 */
export interface UsageLogFilters {
  /** Filter by provider */
  providerId?: string;
  /** Filter by model */
  model?: string;
  /** Start date (ISO string) */
  startDate?: string;
  /** End date (ISO string) */
  endDate?: string;
  /** Maximum number of results */
  limit?: number;
}

// ============================================
// Export/Import Types
// ============================================

/**
 * Export data format for configuration backup
 */
export interface ModelExportData {
  /** Export format version */
  version: string;
  /** Export timestamp */
  exportedAt: string;
  /** Provider configurations */
  providers: Omit<AIProvider, 'createdAt' | 'updatedAt'>[];
  /** API key metadata (actual keys NOT exported for security) */
  apiKeys: {
    providerId: string;
    keyName: string;
    hasKey: boolean;
    isValid: boolean;
  }[];
  /** Usage summary (optional) */
  usageSummary?: UsageSummary;
}
