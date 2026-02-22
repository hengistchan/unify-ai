// Type definitions for Electron API
// This file ensures TypeScript knows about the electronAPI exposed by preload script

import type {
  AIProvider,
  APIKey,
  CreateProviderInput,
  UpdateProviderInput,
  SetAPIKeyInput,
  LogUsageInput,
  UsageLog,
  UsageSummary,
  UsageLogFilters,
  ModelInfo,
  ModelConfig,
  ProxyConfig,
  ProxyStats,
  ProxyStatus,
  RequestLog,
  APIKeyValidationResult,
} from '@unify-ai/core/model';

export interface ToolProviderInfo {
  toolId: string;
  providerId: string | null;
  isOverride: boolean;
}

export interface GlobalProviderUsage {
  providerId: string;
  providerName: string;
  toolsUsing: string[];
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  openFolder: () => Promise<string | null>;
  detectTools: (folderPath: string) => Promise<DetectedTool[]>;
  syncConfig: (sourceFolder: string, targetTools: string[], options?: SyncOptions) => Promise<SyncResult>;
  previewSync: (sourceFolder: string, targetTools: string[]) => Promise<PreviewResult[]>;
  getToolConfig: (folderPath: string, toolId: string) => Promise<ToolConfigResult>;
  importConfig: (folderPath: string, options?: ImportOptions) => Promise<ToolConfigResult>;
  exportConfig: (config: UnifiedConfig, folderPath: string, targetTools: string[], options?: SyncOptions) => Promise<ExportResult>;
  saveUnifiedConfig: (folderPath: string, config: UnifiedConfig) => Promise<SaveResult>;
  loadUnifiedConfig: (folderPath: string) => Promise<LoadResult>;
  onFolderSelected: (callback: (folderPath: string) => void) => () => void;

  // Model Management API
  model: {
    // Provider management
    getProviders: () => Promise<AIProvider[]>;
    getProvider: (providerId: string) => Promise<AIProvider | null>;
    createProvider: (input: CreateProviderInput) => Promise<AIProvider>;
    updateProvider: (providerId: string, input: UpdateProviderInput) => Promise<AIProvider>;
    deleteProvider: (providerId: string) => Promise<void>;
    setProviderEnabled: (providerId: string, enabled: boolean) => Promise<void>;
    setProviderPriority: (providerId: string, priority: number) => Promise<void>;

    // API key management
    setAPIKey: (input: SetAPIKeyInput) => Promise<APIKey>;
    getAPIKey: (providerId: string, keyName?: string) => Promise<string | null>;
    validateAPIKey: (providerId: string) => Promise<boolean>;
    validateAPIKeyWithoutSaving: (
      providerId: string,
      apiKey: string,
      options?: { timeout?: number; baseUrl?: string }
    ) => Promise<APIKeyValidationResult>;
    deleteAPIKey: (providerId: string, keyName?: string) => Promise<void>;
    hasValidAPIKey: (providerId: string) => Promise<boolean>;

    // Model management
    getModels: (providerId: string) => Promise<ModelInfo[]>;
    updateModel: (providerId: string, modelId: string, config: Partial<ModelConfig>) => Promise<ModelInfo>;
    setDefaultModel: (providerId: string, modelId: string) => Promise<void>;
    getDefaultModel: (providerId: string) => Promise<ModelInfo | null>;

    // Usage tracking
    logUsage: (input: LogUsageInput) => Promise<UsageLog>;
    getUsageLogs: (filters?: UsageLogFilters) => Promise<UsageLog[]>;
    getUsageSummary: (filters?: UsageLogFilters) => Promise<UsageSummary>;

    // Provider selection
    getActiveProvider: () => Promise<AIProvider | null>;
    getActiveProviders: () => Promise<AIProvider[]>;

    // Tool-specific provider management (hybrid tool isolation)
    getCurrentProvider: (toolId: string) => Promise<ToolProviderInfo>;
    listGlobalProviders: () => Promise<AIProvider[]>;
    listToolProviders: (toolId: string) => Promise<AIProvider[]>;
    setToolOverrideProvider: (toolId: string, providerId: string) => Promise<void>;
    clearToolOverride: (toolId: string) => Promise<void>;
    getGlobalProviderUsage: () => Promise<GlobalProviderUsage[]>;
  };

  // Proxy Server API
  proxy: {
    startProxy: (config?: Partial<ProxyConfig>) => Promise<{ success: boolean; url?: string; error?: string }>;
    stopProxy: () => Promise<{ success: boolean; error?: string }>;
    getProxyStatus: () => Promise<ProxyStatus>;
    getProxyStats: () => Promise<ProxyStats>;
    getRequestLogs: (limit?: number) => Promise<RequestLog[]>;
    clearRequestLogs: () => Promise<{ success: boolean }>;
  };

  // Quick Switcher API
  quickSwitcher: {
    onTriggered: (callback: () => void) => () => void;
  };

  // Tray API
  tray: {
    updateProviders: () => Promise<void>;
    onProviderChanged: (callback: (providerId: string) => void) => () => void;
  };
}

export interface SaveResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface LoadResult {
  success: boolean;
  config?: UnifiedConfig;
  path?: string;
  error?: string;
}

export interface ImportOptions {
  mergeMultiple?: boolean;
  sourceTool?: string;
}

export interface SyncOptions {
  createBackup?: boolean;
  overwrite?: boolean;
}

export interface SyncResult {
  success: boolean;
  message: string;
  syncedTools: string[];
  errors?: string[];
  warnings?: string[];
}

export interface ExportResult {
  success: boolean;
  message: string;
  exportedTools: string[];
  errors?: string[];
  warnings?: string[];
}

export interface PreviewResult {
  success: boolean;
  toolId: string;
  files: PreviewFile[];
  errors?: string[];
  warnings?: string[];
}

export interface PreviewFile {
  path: string;
  content: string;
  size: number;
}

export interface ToolConfigResult {
  success: boolean;
  config?: UnifiedConfig;
  sourceTools?: string[];
  sourceFiles?: string[];
  errors?: string[];
  warnings?: string[];
}

export interface UnifiedConfig {
  version: string;
  rules?: RuleConfig[];
  mcp?: MCPConfig;
  settings?: ToolSettings;
  commands?: CommandConfig[];
  prompts?: PromptTemplate[];
  contextFiles?: string[];
  envVars?: Record<string, string>;
  ignorePatterns?: string[];
}

export interface RuleConfig {
  id: string;
  name?: string;
  description?: string;
  content: string;
  globs?: string[];
  alwaysApply?: boolean;
  priority?: number;
  enabled?: boolean;
}

export interface MCPConfig {
  servers: MCPServerConfig[];
  globalEnv?: Record<string, string>;
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
}

export interface ToolSettings {
  model?: {
    default?: string;
    available?: string[];
  };
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  behavior?: {
    autoSave?: boolean;
    verbose?: boolean;
    timeout?: number;
  };
  toolSpecific?: Record<string, unknown>;
}

export interface CommandConfig {
  id: string;
  name: string;
  description?: string;
  template: string;
  enabled?: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
