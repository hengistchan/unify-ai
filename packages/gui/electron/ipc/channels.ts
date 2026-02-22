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

  // Model management - Providers
  GET_PROVIDERS: 'get-providers',
  GET_PROVIDER: 'get-provider',
  CREATE_PROVIDER: 'create-provider',
  UPDATE_PROVIDER: 'update-provider',
  DELETE_PROVIDER: 'delete-provider',
  SET_PROVIDER_ENABLED: 'set-provider-enabled',
  SET_PROVIDER_PRIORITY: 'set-provider-priority',

  // Model management - API Keys
  SET_API_KEY: 'set-api-key',
  GET_API_KEY: 'get-api-key',
  VALIDATE_API_KEY: 'validate-api-key',
  VALIDATE_API_KEY_WITHOUT_SAVING: 'validate-api-key-without-saving',
  DELETE_API_KEY: 'delete-api-key',
  HAS_VALID_API_KEY: 'has-valid-api-key',

  // Model management - Models
  GET_MODELS: 'get-models',
  ADD_MODEL: 'add-model',
  UPDATE_MODEL_DETAILS: 'update-model-details',
  DELETE_MODEL: 'delete-model',
  SET_MODEL_ENABLED: 'set-model-enabled',
  SET_DEFAULT_MODEL: 'set-default-model',
  GET_DEFAULT_MODEL: 'get-default-model',

  // Model management - Usage Tracking
  GET_USAGE_LOGS: 'get-usage-logs',
  GET_USAGE_SUMMARY: 'get-usage-summary',
  LOG_USAGE: 'log-usage',

  // Model management - Provider Selection
  GET_ACTIVE_PROVIDER: 'get-active-provider',
  GET_ACTIVE_PROVIDERS: 'get-active-providers',

  // Proxy Server
  START_PROXY: 'start-proxy',
  STOP_PROXY: 'stop-proxy',
  GET_PROXY_STATUS: 'get-proxy-status',
  GET_PROXY_STATS: 'get-proxy-stats',
  GET_REQUEST_LOGS: 'get-request-logs',
  CLEAR_REQUEST_LOGS: 'clear-request-logs',

  // Quick Switcher
  SHOW_QUICK_SWITCHER: 'show-quick-switcher',
  QUICK_SWITCHER_TRIGGERED: 'quick-switcher-triggered',

  // Tray
  TRAY_PROVIDER_CHANGED: 'tray-provider-changed',
  UPDATE_TRAY_PROVIDERS: 'update-tray-providers',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
