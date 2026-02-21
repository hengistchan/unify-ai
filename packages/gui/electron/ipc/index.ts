/**
 * IPC Handlers Index
 * Registers all IPC handlers for the main process
 */

import { ipcMain, app, globalShortcut } from 'electron';
import { IPC_CHANNELS } from './channels';
import { detectTools, openFolderDialog } from './tool-detection';
import { syncConfig, previewSync, getToolConfig, importConfig, exportConfig } from './sync';
import { saveUnifiedConfig, loadUnifiedConfig } from './unified-config';
import {
  registerModelIpcHandlers,
  initializeModelManager,
  cleanupModelManager,
  getModelManagerForTray,
} from './model.js';
import {
  registerProxyIpcHandlers,
  initializeProxyServer,
  cleanupProxyServer,
} from './proxy.js';
import { getMainWindow } from '../window.js';
import { updateProviders as updateTrayProviders } from '../tray.js';

/**
 * Register all IPC handlers
 */
export async function registerIpcHandlers(): Promise<void> {
  // Initialize ModelManager first
  const modelManager = await initializeModelManager();

  // Initialize ProxyServer with ModelManager
  initializeProxyServer(modelManager);

  // Get app version
  ipcMain.handle(IPC_CHANNELS.GET_APP_VERSION, () => {
    return app.getVersion();
  });

  // Open folder dialog
  ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER, async () => {
    console.log('[IPC] Opening folder dialog...');
    const result = await openFolderDialog();
    console.log('[IPC] Folder selected:', result || 'cancelled');
    return result;
  });

  // Detect AI tools
  ipcMain.handle(IPC_CHANNELS.DETECT_TOOLS, async (_event, folderPath: string) => {
    console.log('[IPC] Detecting tools in:', folderPath);
    const result = await detectTools(folderPath);
    console.log(
      '[IPC] Detected tools:',
      result
        .filter(t => t.detected)
        .map(t => t.id)
        .join(', ') || 'none'
    );
    return result;
  });

  // Sync configuration
  ipcMain.handle(
    IPC_CHANNELS.SYNC_CONFIG,
    async (
      _event,
      sourceFolder: string,
      targetTools: string[],
      options?: { createBackup?: boolean; overwrite?: boolean }
    ) => {
      console.log('[IPC] Syncing config:', { sourceFolder, targetTools, options });
      const result = await syncConfig(sourceFolder, targetTools, options);
      console.log(
        '[IPC] Sync result:',
        result.success ? 'success' : 'failed',
        `- ${result.syncedTools.length} tools`
      );
      return result;
    }
  );

  // Preview sync
  ipcMain.handle(
    IPC_CHANNELS.PREVIEW_SYNC,
    async (_event, sourceFolder: string, targetTools: string[]) => {
      console.log('[IPC] Previewing sync:', { sourceFolder, targetTools });
      const result = await previewSync(sourceFolder, targetTools);
      console.log('[IPC] Preview complete:', result.length, 'tools');
      return result;
    }
  );

  // Get tool configuration
  ipcMain.handle(
    IPC_CHANNELS.GET_TOOL_CONFIG,
    async (_event, folderPath: string, toolId: string) => {
      console.log('[IPC] Getting tool config:', { folderPath, toolId });
      const result = await getToolConfig(folderPath, toolId);
      console.log('[IPC] Config loaded:', result.success ? 'success' : 'failed');
      return result;
    }
  );

  // Import configuration
  ipcMain.handle(
    IPC_CHANNELS.IMPORT_CONFIG,
    async (
      _event,
      folderPath: string,
      options?: { mergeMultiple?: boolean; sourceTool?: string }
    ) => {
      console.log('[IPC] Importing config:', { folderPath, options });
      const result = await importConfig(folderPath, options);
      console.log('[IPC] Import result:', result.success ? 'success' : 'failed');
      return result;
    }
  );

  // Export configuration
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_CONFIG,
    async (
      _event,
      config: unknown,
      folderPath: string,
      targetTools: string[],
      options?: { createBackup?: boolean; overwrite?: boolean }
    ) => {
      console.log('[IPC] Exporting config:', { folderPath, targetTools, options });
      const result = await exportConfig(config as any, folderPath, targetTools, options);
      console.log(
        '[IPC] Export result:',
        result.success ? 'success' : 'failed',
        `- ${result.exportedTools.length} tools`
      );
      return result;
    }
  );

  // Save unified config to file
  ipcMain.handle(
    IPC_CHANNELS.SAVE_UNIFIED_CONFIG,
    async (_event, folderPath: string, config: unknown) => {
      console.log('[IPC] Saving unified config to:', folderPath);
      const result = await saveUnifiedConfig(folderPath, config);
      console.log('[IPC] Save result:', result.success ? 'success' : 'failed');
      return result;
    }
  );

  // Load unified config from file
  ipcMain.handle(IPC_CHANNELS.LOAD_UNIFIED_CONFIG, async (_event, folderPath: string) => {
    console.log('[IPC] Loading unified config from:', folderPath);
    const result = await loadUnifiedConfig(folderPath);
    console.log('[IPC] Load result:', result.success ? 'success' : 'no config found');
    return result;
  });

  // Register model management handlers
  registerModelIpcHandlers();

  // Register proxy server handlers
  registerProxyIpcHandlers();

  // Register tray update handler
  ipcMain.handle(IPC_CHANNELS.UPDATE_TRAY_PROVIDERS, async () => {
    console.log('[IPC] Updating tray providers...');
    try {
      const manager = getModelManagerForTray();
      const providers = await manager.listProviders();
      const activeProvider = await manager.getActiveProvider();
      updateTrayProviders(providers, activeProvider?.id || null);
      console.log('[IPC] Tray providers updated');
    } catch (error) {
      console.error('[IPC] Failed to update tray providers:', error);
    }
  });

  // Register Quick Switcher shortcut
  registerQuickSwitcherShortcut();

  console.log('[IPC] All handlers registered');
}

/**
 * Unregister all IPC handlers (for cleanup)
 */
export async function unregisterIpcHandlers(): Promise<void> {
  // Unregister global shortcuts
  globalShortcut.unregisterAll();

  Object.values(IPC_CHANNELS).forEach(channel => {
    ipcMain.removeHandler(channel);
  });
  await cleanupProxyServer();
  await cleanupModelManager();
}

/**
 * Register global shortcut for Quick Switcher
 * Cmd+Shift+M on macOS, Ctrl+Shift+M on Windows/Linux
 */
function registerQuickSwitcherShortcut(): void {
  // Determine the accelerator based on platform
  const accelerator = process.platform === 'darwin' ? 'CommandOrControl+Shift+M' : 'Ctrl+Shift+M';

  const ret = globalShortcut.register(accelerator, () => {
    console.log('[QuickSwitcher] Shortcut triggered');
    const mainWindow = getMainWindow();
    if (mainWindow) {
      // Show and focus the window if hidden/minimized
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();

      // Send event to renderer to show quick switcher
      mainWindow.webContents.send(IPC_CHANNELS.QUICK_SWITCHER_TRIGGERED);
    }
  });

  if (!ret) {
    console.error('[QuickSwitcher] Failed to register global shortcut:', accelerator);
  } else {
    console.log('[QuickSwitcher] Global shortcut registered:', accelerator);
  }
}
