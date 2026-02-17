/**
 * IPC Channel Names
 * Central definition of all IPC channel names for type safety
 */

export const IPC_CHANNELS = {
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

  // File system
  READ_FILE: 'read-file',
  WRITE_FILE: 'write-file',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
