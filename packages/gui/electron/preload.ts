/**
 * Preload Script
 * Exposes protected methods to the renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './ipc/channels';

// Type definitions for the exposed API
export interface ElectronAPI {
  openFolder: () => Promise<string | null>;
  detectTools: (folderPath: string) => Promise<DetectedTool[]>;
  syncConfig: (sourceFolder: string, targetTools: string[], options?: SyncOptions) => Promise<SyncResult>;
  previewSync: (sourceFolder: string, targetTools: string[]) => Promise<PreviewResult[]>;
  getToolConfig: (folderPath: string, toolId: string) => Promise<ToolConfigResult>;
  onFolderSelected: (callback: (folderPath: string) => void) => () => void;
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
  // Open folder dialog
  openFolder: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FOLDER),

  // Detect AI tools in a folder
  detectTools: (folderPath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DETECT_TOOLS, folderPath),

  // Sync configuration to specified tools
  syncConfig: (sourceFolder: string, targetTools: string[], options?: SyncOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.SYNC_CONFIG, sourceFolder, targetTools, options),

  // Preview sync without writing files
  previewSync: (sourceFolder: string, targetTools: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.PREVIEW_SYNC, sourceFolder, targetTools),

  // Get configuration for a specific tool
  getToolConfig: (folderPath: string, toolId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_TOOL_CONFIG, folderPath, toolId),

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
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
