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
  /** Tool ID for tool-specific providers */
  toolId?: string | null;
  /** Whether this is the current provider for the tool */
  isCurrentTool?: boolean;
  /** Whether this is the current global provider */
  isCurrentGlobal?: boolean;
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
  /** Tool ID for tool-specific providers (null/undefined for global) */
  toolId?: string | null;
  /** Category for the provider */
  category?: string;
  /** User notes */
  notes?: string;
  /** Additional metadata */
  meta?: Record<string, unknown>;
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
  /** API base URL */
  baseUrl?: string;
  /** Provider configuration */
  config?: Partial<ProviderConfig>;
  /** Available models */
  models?: Omit<ModelInfo, 'providerId'>[];
  /** Default model ID */
  defaultModel?: string;
  /** Tool ID for tool-specific providers */
  toolId?: string | null;
  /** Category for the provider */
  category?: string;
  /** User notes */
  notes?: string;
  /** Additional metadata */
  meta?: Record<string, unknown>;
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
  /** Tool ID for tool-specific API keys (default: 'global') */
  toolId?: string;
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

// ============================================
// Proxy Server Types
// ============================================

/**
 * Proxy server configuration
 */
export interface ProxyConfig {
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host: string;
  /** Enable request/response logging */
  enableLogging: boolean;
  /** Enable automatic usage tracking */
  enableUsageTracking: boolean;
}

/**
 * Proxy server status
 */
export type ProxyStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

/**
 * Proxy server statistics
 */
export interface ProxyStats {
  /** Current status */
  status: ProxyStatus;
  /** Number of requests processed */
  totalRequests: number;
  /** Number of successful requests */
  successfulRequests: number;
  /** Number of failed requests */
  failedRequests: number;
  /** Total bytes received */
  bytesReceived: number;
  /** Total bytes sent */
  bytesSent: number;
  /** Uptime in seconds */
  uptime: number;
  /** Last error message */
  lastError?: string;
}

/**
 * Request log entry
 */
export interface RequestLog {
  /** Request ID */
  id: string;
  /** Timestamp */
  timestamp: string;
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Provider ID used */
  providerId?: string;
  /** Model requested */
  model?: string;
  /** Request headers (sanitized) */
  headers: Record<string, string>;
  /** Request body size */
  requestSize: number;
  /** Response status code */
  responseStatus: number;
  /** Response size */
  responseSize: number;
  /** Duration in milliseconds */
  duration: number;
  /** Whether request was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Associated usage log ID */
  usageLogId?: number;
}

// ============================================
// Usage Aggregation Types
// ============================================

/**
 * Daily usage summary entry
 */
export interface DailyUsageSummary {
  /** Summary ID */
  id: number;
  /** Provider ID */
  providerId: string;
  /** Model used */
  model: string;
  /** Date (ISO format: YYYY-MM-DD) */
  date: string;
  /** Total number of requests */
  totalRequests: number;
  /** Total input tokens */
  inputTokens: number;
  /** Total output tokens */
  outputTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Weekly usage summary entry
 */
export interface WeeklyUsageSummary {
  /** Summary ID */
  id: number;
  /** Provider ID */
  providerId: string;
  /** Model used */
  model: string;
  /** ISO year */
  year: number;
  /** ISO week number (1-53) */
  week: number;
  /** Total number of requests */
  totalRequests: number;
  /** Total input tokens */
  inputTokens: number;
  /** Total output tokens */
  outputTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Aggregation type
 */
export type AggregationType = 'daily' | 'weekly';

/**
 * Aggregation status
 */
export type AggregationStatus = 'pending' | 'completed' | 'failed';

/**
 * Aggregation log entry
 */
export interface AggregationLog {
  /** Log ID */
  id: number;
  /** Aggregation type */
  aggregationType: AggregationType;
  /** Date that was aggregated */
  aggregationDate: string;
  /** Status */
  status: AggregationStatus;
  /** When aggregation started */
  startedAt?: string;
  /** When aggregation completed */
  completedAt?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Creation timestamp */
  createdAt: string;
}

/**
 * Options for aggregation tasks
 */
export interface AggregationOptions {
  /** Maximum retry attempts for failed aggregations */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelayMs?: number;
  /** Whether to run aggregation in background */
  runInBackground?: boolean;
  /** Timezone for date calculations (IANA timezone string) */
  timezone?: string;
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  /** Aggregation type */
  type: AggregationType;
  /** Date aggregated */
  date: string;
  /** Number of records processed */
  recordsProcessed: number;
  /** Whether aggregation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * ISO week representation
 */
export interface ISOWeek {
  /** ISO year */
  year: number;
  /** ISO week number (1-53) */
  week: number;
}

// ============================================
// Hybrid Tool Isolation Types
// ============================================

/**
 * Provider scope for hybrid tool isolation
 */
export type ProviderScope = 'global' | 'tool-specific';

/**
 * Extended provider data with hybrid tool isolation fields
 */
export interface HybridProviderFields {
  /** Tool ID (null = global provider) */
  toolId?: string | null;
  /** Whether this is a global provider */
  isGlobal: boolean;
  /** Whether this is the current global default provider */
  isCurrentGlobal: boolean;
  /** Whether this is the current tool-specific provider */
  isCurrentTool: boolean;
  /** Sort index for ordering */
  sortIndex?: number;
  /** Provider category */
  category?: string;
  /** User notes */
  notes?: string;
  /** Additional metadata */
  meta?: Record<string, unknown>;
}

/**
 * Current provider query result
 */
export interface CurrentProviderResult {
  /** The provider */
  provider: AIProvider;
  /** Scope of the provider (global or tool-specific) */
  scope: ProviderScope;
  /** Tool ID if tool-specific */
  toolId?: string;
}

// ============================================
// Provider Backfill Types
// ============================================

/**
 * Backup data for provider switching
 * Stored in the new provider's meta field during switching
 */
export interface ProviderBackup {
  /** The previous provider ID */
  previousProviderId: string;
  /** The previous provider's config (for restoration) */
  previousConfig: ProviderConfig;
  /** The previous provider's scope (global or tool-specific) */
  previousScope: ProviderScope;
  /** The tool ID if tool-specific */
  previousToolId?: string;
  /** Timestamp when backup was created */
  backupTimestamp: string;
}

/**
 * Result of switch provider with backfill operation
 */
export interface SwitchProviderResult {
  /** Whether the switch was successful */
  success: boolean;
  /** The new provider (if switch succeeded) */
  newProvider?: AIProvider;
  /** Error message (if switch failed) */
  error?: string;
  /** Whether a backup was created */
  backupCreated: boolean;
  /** Whether a backup was restored (on failure) */
  backupRestored: boolean;
}
