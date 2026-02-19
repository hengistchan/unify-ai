/**
 * Preload Script
 * Exposes protected methods to the renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc/channels';

// Type definitions for the exposed API
export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  openFolder: () => Promise<string | null>;
  detectTools: (folderPath: string) => Promise<DetectedTool[]>;
  syncConfig: (
    sourceFolder: string,
    targetTools: string[],
    options?: SyncOptions
  ) => Promise<SyncResult>;
  previewSync: (sourceFolder: string, targetTools: string[]) => Promise<PreviewResult[]>;
  getToolConfig: (folderPath: string, toolId: string) => Promise<ToolConfigResult>;
  importConfig: (
    folderPath: string,
    options?: { mergeMultiple?: boolean; sourceTool?: string }
  ) => Promise<ToolConfigResult>;
  exportConfig: (
    config: UnifiedConfig,
    folderPath: string,
    targetTools: string[],
    options?: SyncOptions
  ) => Promise<ExportResult>;
  saveUnifiedConfig: (folderPath: string, config: UnifiedConfig) => Promise<SaveResult>;
  loadUnifiedConfig: (folderPath: string) => Promise<LoadResult>;
  onFolderSelected: (callback: (folderPath: string) => void) => () => void;
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

export interface ExportResult {
  success: boolean;
  message: string;
  exportedTools: string[];
  errors?: string[];
  warnings?: string[];
}

export interface DetectedTool {
  id: string;
  name: string;
  configPath: string;
  detected: boolean;
  hasRules: boolean;
  hasMcp: boolean;
  hasSettings: boolean;
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

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Get app version
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_VERSION),

  // Open folder dialog
  openFolder: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FOLDER),

  // Detect AI tools in a folder
  detectTools: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.DETECT_TOOLS, folderPath),

  // Sync configuration to specified tools
  syncConfig: (sourceFolder: string, targetTools: string[], options?: SyncOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYNC_CONFIG, sourceFolder, targetTools, options),

  // Preview sync without writing files
  previewSync: (sourceFolder: string, targetTools: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_SYNC, sourceFolder, targetTools),

  // Get configuration for a specific tool
  getToolConfig: (folderPath: string, toolId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_TOOL_CONFIG, folderPath, toolId),

  // Import configuration from folder
  importConfig: (folderPath: string, options?: { mergeMultiple?: boolean; sourceTool?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMPORT_CONFIG, folderPath, options),

  // Export configuration to target tools
  exportConfig: (
    config: UnifiedConfig,
    folderPath: string,
    targetTools: string[],
    options?: SyncOptions
  ) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_CONFIG, config, folderPath, targetTools, options),

  // Save unified config to file
  saveUnifiedConfig: (folderPath: string, config: UnifiedConfig) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_UNIFIED_CONFIG, folderPath, config),

  // Load unified config from file
  loadUnifiedConfig: (folderPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOAD_UNIFIED_CONFIG, folderPath),

  // Listen for folder selection from menu
  onFolderSelected: (callback: (folderPath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, folderPath: string) => {
      callback(folderPath);
    };
    ipcRenderer.on(IPC_CHANNELS.FOLDER_SELECTED, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.FOLDER_SELECTED, handler);
    };
  },

  // ============================================
  // Model Management API
  // ============================================

  model: {
    // Provider management
    getProviders: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PROVIDERS),
    getProvider: (providerId: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_PROVIDER, providerId),
    createProvider: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_PROVIDER, input),
    updateProvider: (providerId: string, input: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_PROVIDER, providerId, input),
    deleteProvider: (providerId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DELETE_PROVIDER, providerId),
    setProviderEnabled: (providerId: string, enabled: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.SET_PROVIDER_ENABLED, providerId, enabled),
    setProviderPriority: (providerId: string, priority: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.SET_PROVIDER_PRIORITY, providerId, priority),

    // API key management
    setAPIKey: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.SET_API_KEY, input),
    getAPIKey: (providerId: string, keyName?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GET_API_KEY, providerId, keyName),
    validateAPIKey: (providerId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.VALIDATE_API_KEY, providerId),
    deleteAPIKey: (providerId: string, keyName?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.DELETE_API_KEY, providerId, keyName),
    hasValidAPIKey: (providerId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.HAS_VALID_API_KEY, providerId),

    // Model management
    getModels: (providerId: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_MODELS, providerId),
    updateModel: (providerId: string, modelId: string, config: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.UPDATE_MODEL, providerId, modelId, config),
    setDefaultModel: (providerId: string, modelId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SET_DEFAULT_MODEL, providerId, modelId),
    getDefaultModel: (providerId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GET_DEFAULT_MODEL, providerId),

    // Usage tracking
    logUsage: (input: any) => ipcRenderer.invoke(IPC_CHANNELS.LOG_USAGE, input),
    getUsageLogs: (filters?: any) => ipcRenderer.invoke(IPC_CHANNELS.GET_USAGE_LOGS, filters),
    getUsageSummary: (filters?: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.GET_USAGE_SUMMARY, filters),

    // Provider selection
    getActiveProvider: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ACTIVE_PROVIDER),
    getActiveProviders: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ACTIVE_PROVIDERS),
  },

  // ============================================
  // Proxy Server API
  // ============================================

  proxy: {
    startProxy: (config?: any) => ipcRenderer.invoke(IPC_CHANNELS.START_PROXY, config),
    stopProxy: () => ipcRenderer.invoke(IPC_CHANNELS.STOP_PROXY),
    getProxyStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PROXY_STATUS),
    getProxyStats: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PROXY_STATS),
    getRequestLogs: (limit?: number) => ipcRenderer.invoke(IPC_CHANNELS.GET_REQUEST_LOGS, limit),
    clearRequestLogs: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_REQUEST_LOGS),
  },
});

// No need to redeclare Window interface here - it's already declared in src/types/electron.d.ts
