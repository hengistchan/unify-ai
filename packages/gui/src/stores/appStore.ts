/**
 * GUI Application Store
 * Zustand-based state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// Type Definitions
// ============================================

export interface DetectedTool {
  id: string;
  name: string;
  configPath: string;
  detected: boolean;
  hasRules: boolean;
  hasMcp: boolean;
  hasSettings: boolean;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: string;
}

export interface AppSettings {
  autoSync: boolean;
  backupEnabled: boolean;
  animationsEnabled: boolean;
}

export interface FileChange {
  path: string;
  action: 'create' | 'update' | 'delete';
  linesAdded: number;
  linesRemoved: number;
}

export interface Conflict {
  path: string;
  description: string;
}

export interface SyncPreview {
  sourceTool: string;
  targetTools: string[];
  changes: FileChange[];
  conflicts: Conflict[];
  syncDetails?: {
    rulesCount: number;
    mcpServersCount: number;
    hasSettings: boolean;
    commandsCount: number;
  };
}

// UnifiedConfig type definition for GUI use
// This mirrors the core UnifiedConfig structure
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

export interface SyncPreferences {
  sourceTool: string | null;
  targetTools: string[];
}

export interface ImportExportOptions {
  mergeMultiple?: boolean;
  createBackup?: boolean;
  overwrite?: boolean;
}

export interface ImportResult {
  success: boolean;
  config?: UnifiedConfig;
  sourceTools?: string[];
  sourceFiles?: string[];
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

// ============================================
// Store Interface
// ============================================

interface AppState {
  // Project
  currentProject: string | null;
  setProject: (path: string) => void;
  clearProject: () => void;

  // Tools
  detectedTools: DetectedTool[];
  setDetectedTools: (tools: DetectedTool[]) => void;
  refreshTools: () => Promise<void>;

  // Sync
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  lastSyncTime: string | null;
  setSyncStatus: (status: 'idle' | 'syncing' | 'error' | 'success') => void;
  setLastSyncTime: (time: string) => void;

  // Sync Preview & Execution
  unifiedConfig: UnifiedConfig | null;
  syncPreview: SyncPreview | null;
  syncLoading: boolean;
  selectedSourceTool: string | null;
  previewSync: (sourceTool: string, targetTools: string[]) => Promise<void>;
  executeSync: () => Promise<void>;
  loadToolConfig: (toolId: string) => Promise<void>;
  clearSyncPreview: () => void;

  // Import/Export
  importLoading: boolean;
  exportLoading: boolean;
  importConfig: (options?: ImportExportOptions) => Promise<ImportResult>;
  exportConfig: (targetTools: string[], options?: ImportExportOptions) => Promise<ExportResult>;
  loadSavedConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;

  // UI
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Recent projects
  recentProjects: RecentProject[];
  addRecentProject: (project: RecentProject) => void;
  removeRecentProject: (path: string) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Sync Preferences
  syncPreferences: SyncPreferences;
  updateSyncPreferences: (preferences: Partial<SyncPreferences>) => void;
}

// ============================================
// Helper Functions
// ============================================

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// Store Creation
// ============================================

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Project
      currentProject: null,
      setProject: (path) => {
        set({ currentProject: path });
        // Auto-load saved config when project is set
        get().loadSavedConfig();
      },
      clearProject: () => set({ currentProject: null, detectedTools: [], unifiedConfig: null }),

      // Tools
      detectedTools: [],
      setDetectedTools: (tools) => set({ detectedTools: tools }),

      refreshTools: async () => {
        const { currentProject } = get();
        if (!currentProject) {
          get().addToast({
            type: 'error',
            title: 'No Project',
            message: 'Please select a project folder first',
          });
          return;
        }

        try {
          const tools = await window.electronAPI.detectTools(currentProject);
          set({ detectedTools: tools });
          get().addToast({
            type: 'success',
            title: 'Refreshed',
            message: `Detected ${tools.filter(t => t.detected).length} tools`,
          });
        } catch (error) {
          get().addToast({
            type: 'error',
            title: 'Refresh Failed',
            message: error instanceof Error ? error.message : 'Failed to refresh tools',
          });
        }
      },

      // Sync
      syncStatus: 'idle',
      lastSyncTime: null,
      setSyncStatus: (status) => set({ syncStatus: status }),
      setLastSyncTime: (time) => set({ lastSyncTime: time }),

      // Sync Preview & Execution
      unifiedConfig: null,
      syncPreview: null,
      syncLoading: false,
      selectedSourceTool: null,

      previewSync: async (sourceTool: string, targetTools: string[]) => {
        const { currentProject } = get();
        if (!currentProject) {
          get().addToast({
            type: 'error',
            title: 'No Project',
            message: 'Please select a project folder first',
          });
          return;
        }

        set({ syncLoading: true, selectedSourceTool: sourceTool });
        try {
          // First, import to get the config details
          const importResult = await window.electronAPI.importConfig(currentProject, {
            sourceTool,
          });

          // Call IPC for preview mode sync
          const results = await window.electronAPI.previewSync(currentProject, targetTools);

          // Aggregate results into a preview
          const allChanges: FileChange[] = [];
          const allConflicts: Conflict[] = [];

          for (const result of results) {
            if (result.success) {
              for (const file of result.files) {
                allChanges.push({
                  path: file.path,
                  action: 'create' as const,
                  linesAdded: file.content.split('\n').length,
                  linesRemoved: 0,
                });
              }
            }
            if (result.warnings) {
              for (const warning of result.warnings) {
                allConflicts.push({
                  path: result.toolId,
                  description: warning,
                });
              }
            }
          }

          // Build sync details from imported config
          const syncDetails = importResult.success && importResult.config ? {
            rulesCount: importResult.config.rules?.length || 0,
            mcpServersCount: importResult.config.mcp?.servers?.length || 0,
            hasSettings: !!importResult.config.settings,
            commandsCount: importResult.config.commands?.length || 0,
          } : undefined;

          const preview: SyncPreview = {
            sourceTool,
            targetTools,
            changes: allChanges,
            conflicts: allConflicts,
            syncDetails,
          };

          set({ syncPreview: preview, syncLoading: false });
        } catch (error) {
          set({ syncLoading: false });
          get().addToast({
            type: 'error',
            title: 'Preview Failed',
            message: error instanceof Error ? error.message : 'Failed to generate sync preview',
          });
        }
      },

      executeSync: async () => {
        const { syncPreview, selectedSourceTool, currentProject } = get();
        if (!syncPreview || !selectedSourceTool || !currentProject) {
          get().addToast({
            type: 'warning',
            title: 'No Preview',
            message: 'Please preview sync changes first',
          });
          return;
        }

        set({ syncLoading: true, syncStatus: 'syncing' });
        try {
          const result = await window.electronAPI.syncConfig(
            currentProject,
            syncPreview.targetTools,
            { createBackup: true, overwrite: true }
          );

          if (result.success) {
            set({
              syncPreview: null,
              selectedSourceTool: null,
              syncLoading: false,
              syncStatus: 'success',
              lastSyncTime: new Date().toISOString(),
            });
            get().addToast({
              type: 'success',
              title: 'Sync Complete',
              message: result.message,
            });
          } else {
            set({ syncLoading: false, syncStatus: 'error' });
            get().addToast({
              type: 'error',
              title: 'Sync Failed',
              message: result.errors?.join(', ') || 'Failed to execute sync',
            });
          }
        } catch (error) {
          set({ syncLoading: false, syncStatus: 'error' });
          get().addToast({
            type: 'error',
            title: 'Sync Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
          });
        }
      },

      loadToolConfig: async (toolId: string) => {
        const { currentProject } = get();
        if (!currentProject) {
          get().addToast({
            type: 'error',
            title: 'No Project',
            message: 'Please select a project folder first',
          });
          return;
        }

        try {
          const result = await window.electronAPI.getToolConfig(currentProject, toolId);
          if (result.success && result.config) {
            set({ unifiedConfig: result.config as UnifiedConfig });
          } else {
            get().addToast({
              type: 'error',
              title: 'Load Config Failed',
              message: result.errors?.join(', ') || 'Failed to load tool config',
            });
          }
        } catch (error) {
          get().addToast({
            type: 'error',
            title: 'Load Config Failed',
            message: error instanceof Error ? error.message : 'Failed to load tool config',
          });
        }
      },

      clearSyncPreview: () => set({ syncPreview: null, selectedSourceTool: null }),

      // Import/Export
      importLoading: false,
      exportLoading: false,

      importConfig: async (options?: ImportExportOptions) => {
        const { currentProject } = get();
        if (!currentProject) {
          const result: ImportResult = {
            success: false,
            errors: ['No project selected'],
          };
          get().addToast({
            type: 'error',
            title: 'No Project',
            message: 'Please select a project folder first',
          });
          return result;
        }

        set({ importLoading: true });
        try {
          const result = await window.electronAPI.importConfig(currentProject, {
            mergeMultiple: options?.mergeMultiple,
            sourceTool: options?.sourceTool,
          });

          if (result.success && result.config) {
            set({ unifiedConfig: result.config as UnifiedConfig, importLoading: false });
            // Auto-save to unified.json
            await window.electronAPI.saveUnifiedConfig(currentProject, result.config as UnifiedConfig);
            get().addToast({
              type: 'success',
              title: 'Import Complete',
              message: options?.mergeMultiple
                ? `Merged configuration from ${result.sourceTools?.length || 0} tools`
                : `Imported configuration from ${result.sourceTools?.join(', ') || 'detected tools'}`,
            });
          } else {
            set({ importLoading: false });
            get().addToast({
              type: 'error',
              title: 'Import Failed',
              message: result.errors?.join(', ') || 'Failed to import configuration',
            });
          }

          return result as ImportResult;
        } catch (error) {
          set({ importLoading: false });
          const result: ImportResult = {
            success: false,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          };
          get().addToast({
            type: 'error',
            title: 'Import Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
          });
          return result;
        }
      },

      exportConfig: async (targetTools: string[], options?: ImportExportOptions) => {
        const { currentProject, unifiedConfig } = get();
        if (!currentProject) {
          const result: ExportResult = {
            success: false,
            message: 'No project selected',
            exportedTools: [],
            errors: ['No project selected'],
          };
          get().addToast({
            type: 'error',
            title: 'No Project',
            message: 'Please select a project folder first',
          });
          return result;
        }

        if (!unifiedConfig) {
          const result: ExportResult = {
            success: false,
            message: 'No configuration to export',
            exportedTools: [],
            errors: ['No configuration loaded. Please import first.'],
          };
          get().addToast({
            type: 'warning',
            title: 'No Config',
            message: 'Please import configuration first',
          });
          return result;
        }

        set({ exportLoading: true });
        try {
          const result = await window.electronAPI.exportConfig(
            unifiedConfig,
            currentProject,
            targetTools,
            {
              createBackup: options?.createBackup ?? get().settings.backupEnabled,
              overwrite: options?.overwrite ?? true,
            }
          );

          if (result.success) {
            set({ exportLoading: false });
            get().addToast({
              type: 'success',
              title: 'Export Complete',
              message: result.message,
            });
          } else {
            set({ exportLoading: false });
            get().addToast({
              type: 'error',
              title: 'Export Failed',
              message: result.errors?.join(', ') || 'Failed to export configuration',
            });
          }

          return result;
        } catch (error) {
          set({ exportLoading: false });
          const result: ExportResult = {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
            exportedTools: [],
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          };
          get().addToast({
            type: 'error',
            title: 'Export Error',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
          });
          return result;
        }
      },

      loadSavedConfig: async () => {
        const { currentProject } = get();
        if (!currentProject) {
          return;
        }

        try {
          const result = await window.electronAPI.loadUnifiedConfig(currentProject);
          if (result.success && result.config) {
            set({ unifiedConfig: result.config as UnifiedConfig });
            console.log('[Store] Loaded saved config from unified.json');
          }
        } catch (error) {
          console.error('[Store] Failed to load saved config:', error);
        }
      },

      saveConfig: async () => {
        const { currentProject, unifiedConfig } = get();
        if (!currentProject || !unifiedConfig) {
          return;
        }

        try {
          await window.electronAPI.saveUnifiedConfig(currentProject, unifiedConfig);
          console.log('[Store] Saved config to unified.json');
        } catch (error) {
          console.error('[Store] Failed to save config:', error);
        }
      },

      // UI
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Notifications
      toasts: [],
      addToast: (toast) => {
        const id = generateId();
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));

        // Auto-remove toast after duration (default 5 seconds)
        const duration = toast.duration ?? 5000;
        if (duration > 0) {
          setTimeout(() => {
            set((state) => ({
              toasts: state.toasts.filter((t) => t.id !== id),
            }));
          }, duration);
        }
      },
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      // Recent projects
      recentProjects: [],
      addRecentProject: (project) =>
        set((state) => {
          const filtered = state.recentProjects.filter((p) => p.path !== project.path);
          return {
            recentProjects: [project, ...filtered].slice(0, 10), // Keep last 10
          };
        }),
      removeRecentProject: (path) =>
        set((state) => ({
          recentProjects: state.recentProjects.filter((p) => p.path !== path),
        })),

      // Settings
      settings: {
        autoSync: true,
        backupEnabled: true,
        animationsEnabled: true,
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Sync Preferences
      syncPreferences: {
        sourceTool: null,
        targetTools: [],
      },
      updateSyncPreferences: (newPreferences) =>
        set((state) => ({
          syncPreferences: { ...state.syncPreferences, ...newPreferences },
        })),
    }),
    {
      name: 'unify-ai-storage',
      partialize: (state) => ({
        recentProjects: state.recentProjects,
        settings: state.settings,
        sidebarCollapsed: state.sidebarCollapsed,
        syncPreferences: state.syncPreferences,
      }),
    }
  )
);

// ============================================
// Selectors
// ============================================

export const selectCurrentProject = (state: AppState) => state.currentProject;
export const selectDetectedTools = (state: AppState) => state.detectedTools;
export const selectSyncStatus = (state: AppState) => state.syncStatus;
export const selectToasts = (state: AppState) => state.toasts;
export const selectRecentProjects = (state: AppState) => state.recentProjects;
export const selectSettings = (state: AppState) => state.settings;
export const selectSyncPreview = (state: AppState) => state.syncPreview;
export const selectSyncLoading = (state: AppState) => state.syncLoading;
export const selectSelectedSourceTool = (state: AppState) => state.selectedSourceTool;
export const selectUnifiedConfig = (state: AppState) => state.unifiedConfig;
export const selectSyncPreferences = (state: AppState) => state.syncPreferences;
export const selectImportLoading = (state: AppState) => state.importLoading;
export const selectExportLoading = (state: AppState) => state.exportLoading;
