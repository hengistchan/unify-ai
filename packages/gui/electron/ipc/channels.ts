/**
 * IPC Channel Names
 * Central definition of all IPC channel names for type safety
 */

export const IPC_CHANNELS = {
  // App info
  GET_APP_VERSION: 'get-app-version',

  // Folder operations
  OPEN_FOLDER: 'open-folder',
  FOLDER_SELECTED: 'folder-selected',

  // Tool detection
  DETECT_TOOLS: 'detect-tools',

  // Configuration sync
  SYNC_CONFIG: 'sync-config',
  PREVIEW_SYNC: 'preview-sync',

  // Tool configuration
  GET_TOOL_CONFIG: 'get-tool-config',

  // Import/Export
  IMPORT_CONFIG: 'import-config',
  EXPORT_CONFIG: 'export-config',

  // Unified config persistence
  SAVE_UNIFIED_CONFIG: 'save-unified-config',
  LOAD_UNIFIED_CONFIG: 'load-unified-config',

  // File system
  READ_FILE: 'read-file',
  WRITE_FILE: 'write-file',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
