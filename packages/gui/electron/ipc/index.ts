/**
 * IPC Handlers Index
 * Registers all IPC handlers for the main process
 */

import { ipcMain, app } from 'electron';
import { IPC_CHANNELS } from './channels';
import { detectTools, openFolderDialog } from './tool-detection';
import { syncConfig, previewSync, getToolConfig, importConfig, exportConfig } from './sync';
import { saveUnifiedConfig, loadUnifiedConfig } from './unified-config';
import {
  registerModelIpcHandlers,
  initializeModelManager,
  cleanupModelManager,
} from './model.js';

/**
 * Register all IPC handlers
 */
export async function registerIpcHandlers(): Promise<void> {
  // Initialize ModelManager first
  await initializeModelManager();

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

  console.log('[IPC] All handlers registered');
}

/**
 * Unregister all IPC handlers (for cleanup)
 */
export async function unregisterIpcHandlers(): Promise<void> {
  Object.values(IPC_CHANNELS).forEach(channel => {
    ipcMain.removeHandler(channel);
  });
  await cleanupModelManager();
}
