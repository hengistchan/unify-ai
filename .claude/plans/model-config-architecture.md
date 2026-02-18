# Model Configuration Management Architecture

## Overview

This document describes the architecture for extending unify-ai with model configuration management capabilities, inspired by the cc-switch patterns. The system provides unified AI model provider management, API key storage, usage tracking, and optional proxy functionality.

## Design Principles

1. **Single Source of Truth (SSOT)**: SQLite database as the central data store
2. **Security First**: Encrypted API keys using Electron's safeStorage
3. **Independent Module**: Separate from but integrated with unified config
4. **MVP Focus**: Provider management + switching first, proxy + monitoring later
5. **Extensibility**: Support multiple AI providers with different configuration schemas

---

## Phase 1: MVP Architecture

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        unify-ai GUI (Electron)                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │  Pages/Models  │  │ ModelSettings  │  │  UsageDashboard       │  │
│  └───────┬────────┘  └───────┬────────┘  └───────────┬────────────┘ │
│          │                   │                       │               │
│          └───────────────────┼───────────────────────┘               │
│                              │                                       │
│                    ┌─────────▼─────────┐                             │
│                    │   Model Store     │  (Zustand)                  │
│                    │   (State Mgmt)    │                             │
│                    └─────────┬─────────┘                             │
│                              │                                       │
│                    ┌─────────▼─────────┐                             │
│                    │   IPC Bridge      │                             │
│                    │  (Model Channels) │                             │
│                    └─────────┬─────────┘                             │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               │ IPC
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                     Main Process                                     │
│                              │                                       │
│  ┌───────────────────────────▼───────────────────────────┐          │
│  │                  ModelManager                          │          │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │          │
│  │  │ Provider    │  │ API Key     │  │  Usage        │  │          │
│  │  │ Registry    │  │ Manager     │  │  Tracker      │  │          │
│  │  └─────────────┘  └─────────────┘  └───────────────┘  │          │
│  └───────────────────────┬───────────────────────────────┘          │
│                          │                                           │
│  ┌───────────────────────▼───────────────────────────────┐          │
│  │              Database (SQLite)                         │          │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │          │
│  │  │ providers   │  │ api_keys    │  │ usage_logs    │  │          │
│  │  └─────────────┘  └─────────────┘  └───────────────┘  │          │
│  └───────────────────────────────────────────────────────┘          │
│                                                                      │
│  ┌───────────────────────────────────────────────────────┐          │
│  │              Encryption (safeStorage)                  │          │
│  └───────────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 Database Schema

```sql
-- providers: AI provider configurations
CREATE TABLE providers (
  id TEXT PRIMARY KEY,                    -- e.g., 'openai', 'anthropic'
  name TEXT NOT NULL,                     -- Display name
  type TEXT NOT NULL,                     -- 'openai-compatible', 'anthropic', 'custom'
  enabled INTEGER DEFAULT 1,              -- Whether provider is active
  priority INTEGER DEFAULT 0,             -- Selection priority (higher = preferred)
  config TEXT,                            -- JSON: provider-specific config
  models TEXT,                            -- JSON: available models list
  default_model TEXT,                     -- Default model ID
  base_url TEXT,                          -- API base URL
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- api_keys: Encrypted API keys for providers
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,              -- FK to providers.id
  key_name TEXT,                          -- Key identifier (e.g., 'primary', 'backup')
  encrypted_key BLOB NOT NULL,            -- Encrypted API key
  iv BLOB,                                -- Initialization vector
  auth_tag BLOB,                          -- Authentication tag
  is_valid INTEGER DEFAULT 0,             -- Whether key has been validated
  last_validated TEXT,                    -- Last validation timestamp
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  UNIQUE(provider_id, key_name)
);

-- usage_logs: Usage tracking for each provider/model
CREATE TABLE usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,              -- FK to providers.id
  model TEXT NOT NULL,                    -- Model used
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,                    -- Calculated cost in USD
  request_id TEXT,                        -- External request ID
  metadata TEXT,                          -- JSON: additional metadata
  FOREIGN KEY (provider_id) REFERENCES providers(id)
);

-- model_configs: Model-specific configurations
CREATE TABLE model_configs (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT,
  context_window INTEGER,
  max_output_tokens INTEGER,
  pricing_input REAL,                     -- Cost per 1K input tokens
  pricing_output REAL,                    -- Cost per 1K output tokens
  enabled INTEGER DEFAULT 1,
  config TEXT,                            -- JSON: model-specific params
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES providers(id),
  UNIQUE(provider_id, model_id)
);

-- Create indexes for common queries
CREATE INDEX idx_usage_logs_provider ON usage_logs(provider_id);
CREATE INDEX idx_usage_logs_timestamp ON usage_logs(timestamp);
CREATE INDEX idx_usage_logs_model ON usage_logs(provider_id, model);
```

### 1.3 Core Module Structure

#### Directory Structure

```
packages/core/src/model/
├── index.ts                    # Module exports
├── types.ts                    # Type definitions
├── ModelManager.ts             # Main manager class
├── Database.ts                 # SQLite database wrapper
├── EncryptionManager.ts        # API key encryption
├── ProviderRegistry.ts         # Built-in provider definitions
├── UsageTracker.ts             # Usage tracking
└── __tests__/
    ├── ModelManager.test.ts
    ├── Database.test.ts
    └── UsageTracker.test.ts
```

#### Type Definitions (`types.ts`)

```typescript
/**
 * Provider Types
 */
export type ProviderType = 'openai-compatible' | 'anthropic' | 'azure' | 'custom';

export interface AIProvider {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  priority: number;
  config: ProviderConfig;
  models: ModelInfo[];
  defaultModel?: string;
  baseUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderConfig {
  timeout?: number;
  maxRetries?: number;
  rateLimit?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };
  customHeaders?: Record<string, string>;
  [key: string]: unknown;
}

export interface ModelInfo {
  id: string;
  providerId: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  pricing: {
    inputPerK: number;
    outputPerK: number;
  };
  enabled: boolean;
  config?: ModelConfig;
}

export interface ModelConfig {
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  [key: string]: unknown;
}

export interface APIKey {
  id: string;
  providerId: string;
  keyName: string;
  isValid: boolean;
  lastValidated?: string;
  createdAt: string;
  updatedAt: string;
  // Never expose the actual key
}

export interface UsageLog {
  id: number;
  providerId: string;
  model: string;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageSummary {
  providerId: string;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  byModel: Map<string, ModelUsageSummary>;
  period: {
    start: string;
    end: string;
  };
}

export interface ModelUsageSummary {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

/**
 * Manager Options
 */
export interface ModelManagerOptions {
  dbPath?: string;
  enableUsageTracking?: boolean;
  encryptionKey?: Buffer;
}

/**
 * CRUD Operations
 */
export interface CreateProviderInput {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  config?: ProviderConfig;
  models?: Omit<ModelInfo, 'providerId'>[];
  defaultModel?: string;
}

export interface UpdateProviderInput {
  name?: string;
  enabled?: boolean;
  priority?: number;
  config?: Partial<ProviderConfig>;
  models?: Omit<ModelInfo, 'providerId'>[];
  defaultModel?: string;
  baseUrl?: string;
}

export interface SetAPIKeyInput {
  providerId: string;
  key: string;
  keyName?: string;
}

export interface LogUsageInput {
  providerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost?: number;
  requestId?: string;
  metadata?: Record<string, unknown>;
}
```

#### ModelManager Class (`ModelManager.ts`)

```typescript
/**
 * ModelManager
 * Central manager for AI model provider configuration
 */
export class ModelManager {
  private db: ModelDatabase;
  private encryption: EncryptionManager;
  private usageTracker: UsageTracker;
  private providerRegistry: ProviderRegistry;

  constructor(options?: ModelManagerOptions);

  // ============================================
  // Provider Management
  // ============================================

  /**
   * List all providers
   */
  listProviders(): Promise<AIProvider[]>;

  /**
   * Get provider by ID
   */
  getProvider(id: string): Promise<AIProvider | null>;

  /**
   * Create new provider
   */
  createProvider(input: CreateProviderInput): Promise<AIProvider>;

  /**
   * Update provider
   */
  updateProvider(id: string, input: UpdateProviderInput): Promise<AIProvider>;

  /**
   * Delete provider
   */
  deleteProvider(id: string): Promise<void>;

  /**
   * Enable/disable provider
   */
  setProviderEnabled(id: string, enabled: boolean): Promise<void>;

  /**
   * Set provider priority (for selection)
   */
  setProviderPriority(id: string, priority: number): Promise<void>;

  // ============================================
  // API Key Management
  // ============================================

  /**
   * Set API key for provider
   */
  setAPIKey(input: SetAPIKeyInput): Promise<APIKey>;

  /**
   * Get API key (decrypted) - use sparingly!
   */
  getAPIKey(providerId: string, keyName?: string): Promise<string | null>;

  /**
   * Check if provider has valid API key
   */
  hasValidAPIKey(providerId: string): Promise<boolean>;

  /**
   * Validate API key by making test request
   */
  validateAPIKey(providerId: string): Promise<boolean>;

  /**
   * Delete API key
   */
  deleteAPIKey(providerId: string, keyName?: string): Promise<void>;

  // ============================================
  // Model Management
  // ============================================

  /**
   * List models for provider
   */
  listModels(providerId: string): Promise<ModelInfo[]>;

  /**
   * Get model info
   */
  getModel(providerId: string, modelId: string): Promise<ModelInfo | null>;

  /**
   * Update model configuration
   */
  updateModel(
    providerId: string,
    modelId: string,
    config: Partial<ModelConfig>
  ): Promise<ModelInfo>;

  /**
   * Get default model for provider
   */
  getDefaultModel(providerId: string): Promise<ModelInfo | null>;

  /**
   * Set default model for provider
   */
  setDefaultModel(providerId: string, modelId: string): Promise<void>;

  // ============================================
  // Provider Selection
  // ============================================

  /**
   * Get active provider (highest priority with valid key)
   */
  getActiveProvider(): Promise<AIProvider | null>;

  /**
   * Get all active providers sorted by priority
   */
  getActiveProviders(): Promise<AIProvider[]>;

  // ============================================
  // Usage Tracking
  // ============================================

  /**
   * Log usage
   */
  logUsage(input: LogUsageInput): Promise<UsageLog>;

  /**
   * Get usage logs
   */
  getUsageLogs(
    providerId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<UsageLog[]>;

  /**
   * Get usage summary
   */
  getUsageSummary(
    providerId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<UsageSummary>;

  // ============================================
  // Initialization & Utilities
  // ============================================

  /**
   * Initialize with built-in providers
   */
  initializeDefaults(): Promise<void>;

  /**
   * Export configuration
   */
  exportConfig(): Promise<ModelExportData>;

  /**
   * Import configuration
   */
  importConfig(data: ModelExportData): Promise<void>;

  /**
   * Close database connection
   */
  dispose(): Promise<void>;
}
```

### 1.4 Integration Points

#### A. Core Package Integration

**File: `packages/core/src/index.ts`**
```typescript
// Add model module exports
export * from './model';
export { ModelManager } from './model/ModelManager';
```

**File: `packages/core/src/model/ProviderRegistry.ts`**
```typescript
/**
 * Built-in provider definitions
 */
export const BUILTIN_PROVIDERS: Omit<AIProvider, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai-compatible',
    enabled: true,
    priority: 100,
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        pricing: { inputPerK: 0.005, outputPerK: 0.015 },
        enabled: true,
      },
      {
        id: 'gpt-4-turbo',
        displayName: 'GPT-4 Turbo',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        pricing: { inputPerK: 0.01, outputPerK: 0.03 },
        enabled: true,
      },
      // ... more models
    ],
    defaultModel: 'gpt-4o',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    enabled: true,
    priority: 90,
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      {
        id: 'claude-sonnet-4-5-20250929',
        displayName: 'Claude Sonnet 4.5',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        pricing: { inputPerK: 0.003, outputPerK: 0.015 },
        enabled: true,
      },
      {
        id: 'claude-opus-4-6-20250514',
        displayName: 'Claude Opus 4.6',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        pricing: { inputPerK: 0.015, outputPerK: 0.075 },
        enabled: true,
      },
    ],
    defaultModel: 'claude-sonnet-4-5-20250929',
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    type: 'azure',
    enabled: false,
    priority: 80,
    models: [], // Loaded dynamically
  },
  // ... more providers
];
```

#### B. GUI Integration

**File: `packages/gui/electron/ipc/channels.ts`**
```typescript
export const IPC_CHANNELS = {
  // ... existing channels

  // Model management
  GET_PROVIDERS: 'get-providers',
  GET_PROVIDER: 'get-provider',
  CREATE_PROVIDER: 'create-provider',
  UPDATE_PROVIDER: 'update-provider',
  DELETE_PROVIDER: 'delete-provider',
  SET_PROVIDER_ENABLED: 'set-provider-enabled',

  // API key management
  SET_API_KEY: 'set-api-key',
  VALIDATE_API_KEY: 'validate-api-key',
  DELETE_API_KEY: 'delete-api-key',
  HAS_VALID_API_KEY: 'has-valid-api-key',

  // Model management
  GET_MODELS: 'get-models',
  UPDATE_MODEL: 'update-model',
  SET_DEFAULT_MODEL: 'set-default-model',

  // Usage tracking
  GET_USAGE_LOGS: 'get-usage-logs',
  GET_USAGE_SUMMARY: 'get-usage-summary',
  LOG_USAGE: 'log-usage',

  // Provider selection
  GET_ACTIVE_PROVIDER: 'get-active-provider',
  GET_ACTIVE_PROVIDERS: 'get-active-providers',
} as const;
```

**File: `packages/gui/src/stores/modelStore.ts`** (New)
```typescript
import { create } from 'zustand';
import type { AIProvider, ModelInfo, UsageSummary } from '@unify-ai/core';

interface ModelState {
  // Providers
  providers: AIProvider[];
  activeProvider: AIProvider | null;
  loading: boolean;

  // Actions
  loadProviders: () => Promise<void>;
  createProvider: (input: CreateProviderInput) => Promise<void>;
  updateProvider: (id: string, input: UpdateProviderInput) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  setActiveProvider: (id: string) => Promise<void>;

  // API Keys
  setAPIKey: (providerId: string, key: string) => Promise<void>;
  validateAPIKey: (providerId: string) => Promise<boolean>;

  // Models
  models: Map<string, ModelInfo[]>;
  loadModels: (providerId: string) => Promise<void>;
  setDefaultModel: (providerId: string, modelId: string) => Promise<void>;

  // Usage
  usageSummary: UsageSummary | null;
  loadUsageSummary: (providerId?: string) => Promise<void>;
}

export const useModelStore = create<ModelState>((set, get) => ({
  // Implementation...
}));
```

**File: `packages/gui/src/pages/Models.tsx`** (New)
```typescript
/**
 * Models Page
 * UI for managing AI providers and models
 */
export function ModelsPage() {
  const { providers, activeProvider, loadProviders } = useModelStore();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  return (
    <div className="models-page">
      <div className="provider-sidebar">
        <ProviderList
          providers={providers}
          activeProvider={activeProvider}
          onSelect={setSelectedProvider}
        />
        <AddProviderButton />
      </div>

      <div className="provider-detail">
        {selectedProvider ? (
          <ProviderDetail providerId={selectedProvider} />
        ) : (
          <EmptyState />
        )}
      </div>

      <div className="usage-panel">
        <UsageDashboard />
      </div>
    </div>
  );
}
```

#### C. CLI Integration

**File: `packages/cli/src/commands/models.ts`** (New)
```typescript
import { Command } from 'commander';

export const modelsCommand = new Command('models')
  .description('Manage AI model providers and configuration')
  .addCommand(listProvidersCommand)
  .addCommand(addProviderCommand)
  .addCommand(removeProviderCommand)
  .addCommand(setKeyCommand)
  .addCommand(setDefaultCommand)
  .addCommand(usageCommand);

const listProvidersCommand = new Command('list')
  .description('List all configured providers')
  .option('-e, --enabled', 'Show only enabled providers')
  .action(async (options) => {
    // Implementation
  });

const addProviderCommand = new Command('add')
  .description('Add a new provider')
  .argument('<provider-id>', 'Provider ID (e.g., openai, anthropic)')
  .option('-n, --name <name>', 'Display name')
  .option('-k, --api-key <key>', 'API key')
  .action(async (providerId, options) => {
    // Implementation
  });

const setKeyCommand = new Command('set-key')
  .description('Set API key for a provider')
  .argument('<provider-id>')
  .argument('<api-key>')
  .action(async (providerId, apiKey) => {
    // Implementation
  });

const setDefaultCommand = new Command('default')
  .description('Set default provider or model')
  .argument('<provider-id>')
  .option('-m, --model <model-id>', 'Set default model instead of provider')
  .action(async (providerId, options) => {
    // Implementation
  });

const usageCommand = new Command('usage')
  .description('Show usage statistics')
  .option('-p, --provider <id>', 'Filter by provider')
  .option('--from <date>', 'Start date')
  .option('--to <date>', 'End date')
  .option('--format <format>', 'Output format', 'table')
  .action(async (options) => {
    // Implementation
  });
```

### 1.5 Data Flow

#### Provider Switching Flow

```
User Action (GUI/CLI)
       │
       ▼
┌──────────────────┐
│  Model Store /   │
│  CLI Command     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  IPC Channel     │
│  SET_PROVIDER    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  ModelManager    │
│  .setProvider    │
│  Enabled()       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  SQLite DB       │
│  UPDATE providers│
│  SET enabled = 1 │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Emit Event      │
│  'provider-      │
│   changed'       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  GUI Updates     │
│  UI State        │
└──────────────────┘
```

#### API Key Validation Flow

```
User enters API key
       │
       ▼
┌──────────────────┐
│  setAPIKey()     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Encryption      │
│  Manager         │
│  .encrypt(key)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  SQLite DB       │
│  INSERT/UPDATE   │
│  api_keys        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  validateAPIKey()│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Test API Call   │
│  to provider     │
└────────┬─────────┘
         │
    ┌────┴────┐
    │ Success │ Failure
    ▼         ▼
┌────────┐ ┌────────┐
│Mark key│ │Mark key│
│ valid  │ │ invalid│
└────────┘ └────────┘
```

---

## Phase 2: Proxy Server (Future)

### 2.1 Proxy Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Coding Assistant                       │
│                   (Cursor, Claude Code, etc.)               │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP Request
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Local Proxy Server                          │
│                   (localhost:8787)                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Request Interceptor                     │   │
│  │  - Add API key from encrypted storage               │   │
│  │  - Route to correct provider                        │   │
│  │  - Log request details                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Response Interceptor                    │   │
│  │  - Parse usage data                                 │   │
│  │  - Log token counts                                 │   │
│  │  - Calculate costs                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ModelManager                            │   │
│  │  - Get active provider                              │   │
│  │  - Get API key                                      │   │
│  │  - Log usage                                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS Request
                          │
                          ▼
              ┌───────────────────────┐
              │   AI Provider API     │
              │  (OpenAI, Anthropic)  │
              └───────────────────────┘
```

### 2.2 Proxy Components

**File: `packages/core/src/model/ProxyServer.ts`**
```typescript
export interface ProxyConfig {
  port: number;
  host: string;
  enableLogging: boolean;
  enableUsageTracking: boolean;
}

export class ProxyServer {
  private server: http.Server;
  private modelManager: ModelManager;

  constructor(modelManager: ModelManager, config?: ProxyConfig);

  /**
   * Start proxy server
   */
  start(): Promise<void>;

  /**
   * Stop proxy server
   */
  stop(): Promise<void>;

  /**
   * Get proxy URL for tool configuration
   */
  getProxyUrl(): string;

  /**
   * Handle incoming request
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;

  /**
   * Intercept and modify request
   */
  private interceptRequest(req: AIRequest): Promise<AIRequest>;

  /**
   * Intercept and process response
   */
  private interceptResponse(res: AIResponse): Promise<AIResponse>;

  /**
   * Extract usage data from response
   */
  private extractUsage(res: AIResponse): UsageLog;
}
```

### 2.3 Proxy Database Schema Extensions

```sql
-- proxy_config: Proxy server configuration
CREATE TABLE proxy_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton
  enabled INTEGER DEFAULT 0,
  port INTEGER DEFAULT 8787,
  host TEXT DEFAULT 'localhost',
  enable_logging INTEGER DEFAULT 1,
  enable_usage_tracking INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- request_logs: Detailed request/response logs
CREATE TABLE request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  provider_id TEXT,
  method TEXT,
  path TEXT,
  request_headers TEXT,       -- JSON
  request_body TEXT,          -- JSON (redacted)
  response_status INTEGER,
  response_headers TEXT,      -- JSON
  response_body TEXT,         -- JSON (redacted)
  duration_ms INTEGER,
  usage_log_id INTEGER,       -- FK to usage_logs
  FOREIGN KEY (usage_log_id) REFERENCES usage_logs(id)
);
```

---

## Security Considerations

### API Key Encryption

1. **Storage**: API keys stored encrypted in SQLite BLOB column
2. **Encryption**: Use Electron's `safeStorage` API (platform-specific encryption)
3. **Access**: Decrypted only when needed for API calls
4. **Validation**: Test keys upon storage, mark validity status

### Implementation Details

**File: `packages/core/src/model/EncryptionManager.ts`**
```typescript
/**
 * EncryptionManager
 * Handles API key encryption using Electron's safeStorage
 */
export class EncryptionManager {
  private safeStorage: Electron.SafeStorage | null;

  constructor();

  /**
   * Encrypt API key
   */
  encrypt(plaintext: string): Promise<EncryptedData>;

  /**
   * Decrypt API key
   */
  decrypt(encrypted: EncryptedData): Promise<string>;

  /**
   * Check if encryption is available
   */
  isEncryptionAvailable(): boolean;

  /**
   * Get encryption key (for non-Electron environments)
   */
  private getFallbackKey(): Buffer;
}

interface EncryptedData {
  encrypted: Buffer;
  iv?: Buffer;
  authTag?: Buffer;
}
```

---

## Configuration Export/Import

### Export Format

```typescript
interface ModelExportData {
  version: string;
  exportedAt: string;
  providers: Omit<AIProvider, 'createdAt' | 'updatedAt'>[];
  apiKeys: {
    providerId: string;
    keyName: string;
    // Key is NOT exported for security
    hasKey: boolean;
  }[];
  usageSummary?: UsageSummary;
}
```

---

## Testing Strategy

### Unit Tests

1. **ModelManager**: Provider CRUD, API key management
2. **EncryptionManager**: Encrypt/decrypt roundtrip
3. **UsageTracker**: Log aggregation, summary calculation
4. **ProxyServer**: Request interception, routing

### Integration Tests

1. **End-to-end flow**: Create provider → Set key → Validate → Use
2. **GUI ↔ IPC ↔ Main**: All channel operations
3. **CLI commands**: All model subcommands
4. **Database migrations**: Schema versioning

### Test Fixtures

```typescript
// __tests__/fixtures/providers.ts
export const mockProviders: AIProvider[] = [
  {
    id: 'test-openai',
    name: 'Test OpenAI',
    type: 'openai-compatible',
    enabled: true,
    priority: 100,
    baseUrl: 'https://api.openai.com/v1',
    models: [mockGPT4o, mockGPT4Turbo],
    defaultModel: 'gpt-4o',
  },
  // ...
];
```

---

## Performance Considerations

1. **Database**: SQLite with indexes on frequently queried columns
2. **Encryption**: Cache decrypted keys in memory for session duration
3. **Usage Logs**: Batch inserts for high-volume logging
4. **UI**: Virtualized lists for large provider/model lists
5. **Queries**: Pre-aggregated daily/weekly summaries

---

## Migration Path

### From cc-switch

1. Export cc-switch database
2. Convert to unify-ai schema
3. Re-encrypt API keys (different encryption method)
4. Import into new database

### Schema Migrations

```typescript
// packages/core/src/model/migrations/001_initial.ts
export const migration_001 = `
  CREATE TABLE providers (...);
  CREATE TABLE api_keys (...);
  CREATE TABLE usage_logs (...);
  -- etc.
`;

// packages/core/src/model/migrations/002_add_proxy.ts
export const migration_002 = `
  CREATE TABLE proxy_config (...);
  CREATE TABLE request_logs (...);
`;
```

---

## Success Metrics

### MVP (Phase 1)

- [ ] Can add/remove/configure multiple providers
- [ ] API keys stored encrypted
- [ ] Can switch active provider
- [ ] Usage tracking works
- [ ] GUI shows provider status
- [ ] CLI commands functional

### Phase 2

- [ ] Proxy server starts/stops reliably
- [ ] AI tools work through proxy
- [ ] Usage logged automatically
- [ ] Request/response logging works
- [ ] Can monitor in real-time

---

## Future Enhancements

1. **Auto-discovery**: Detect provider from AI tool config
2. **Cost alerts**: Notify when spending exceeds threshold
3. **Model recommendations**: Suggest models based on task
4. **Fallback chains**: Auto-switch on rate limits
5. **Team sync**: Share provider configs (not keys) across team
6. **Cloud backup**: Encrypted backup of configuration

---

## Appendix: Complete Type Definitions

See `packages/core/src/model/types.ts` for full type definitions.

## Appendix: API Reference

See generated TypeDoc documentation for complete API reference.
