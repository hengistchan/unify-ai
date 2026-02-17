/**
 * IPC Handlers Index
 * Registers all IPC handlers for the main process
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './channels';
import { detectTools, openFolderDialog } from './tool-detection';
import { syncConfig, previewSync, getToolConfig, importConfig, exportConfig, previewExport } from './sync';

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(): void {
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
    console.log('[IPC] Detected tools:', result.filter(t => t.detected).map(t => t.id).join(', ') || 'none');
    return result;
  });

  // Sync configuration
  ipcMain.handle(
    IPC_CHANNELS.SYNC_CONFIG,
    async (_event, sourceFolder: string, targetTools: string[], options?: { createBackup?: boolean; overwrite?: boolean }) => {
      console.log('[IPC] Syncing config:', { sourceFolder, targetTools, options });
      const result = await syncConfig(sourceFolder, targetTools, options);
      console.log('[IPC] Sync result:', result.success ? 'success' : 'failed', `- ${result.syncedTools.length} tools`);
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
    async (_event, folderPath: string, options?: { mergeMultiple?: boolean; sourceTool?: string }) => {
      console.log('[IPC] Importing config:', { folderPath, options });
      const result = await importConfig(folderPath, options);
      console.log('[IPC] Import result:', result.success ? 'success' : 'failed');
      return result;
    }
  );

  // Export configuration
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_CONFIG,
    async (_event, config: unknown, folderPath: string, targetTools: string[], options?: { createBackup?: boolean; overwrite?: boolean }) => {
      console.log('[IPC] Exporting config:', { folderPath, targetTools, options });
      const result = await exportConfig(config as any, folderPath, targetTools, options);
      console.log('[IPC] Export result:', result.success ? 'success' : 'failed', `- ${result.exportedTools.length} tools`);
      return result;
    }
  );

  console.log('[IPC] All handlers registered');
}

/**
 * Unregister all IPC handlers (for cleanup)
 */
export function unregisterIpcHandlers(): void {
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
