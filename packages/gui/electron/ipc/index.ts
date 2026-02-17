/**
 * IPC Handlers Index
 * Registers all IPC handlers for the main process
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './channels';
import { detectTools, openFolderDialog } from './tool-detection';
import { syncConfig, previewSync, getToolConfig, importConfig } from './sync';

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  // Open folder dialog
  ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER, async () => {
    return openFolderDialog();
  });

  // Detect AI tools
  ipcMain.handle(IPC_CHANNELS.DETECT_TOOLS, async (_event, folderPath: string) => {
    return detectTools(folderPath);
  });

  // Sync configuration
  ipcMain.handle(
    IPC_CHANNELS.SYNC_CONFIG,
    async (_event, sourceFolder: string, targetTools: string[], options?: { createBackup?: boolean; overwrite?: boolean }) => {
      return syncConfig(sourceFolder, targetTools, options);
    }
  );

  // Preview sync
  ipcMain.handle(
    IPC_CHANNELS.PREVIEW_SYNC,
    async (_event, sourceFolder: string, targetTools: string[]) => {
      return previewSync(sourceFolder, targetTools);
    }
  );

  // Get tool configuration
  ipcMain.handle(
    IPC_CHANNELS.GET_TOOL_CONFIG,
    async (_event, folderPath: string, toolId: string) => {
      return getToolConfig(folderPath, toolId);
    }
  );

  // Import configuration
  ipcMain.handle(
    IPC_CHANNELS.IMPORT_CONFIG,
    async (_event, folderPath: string, options?: { mergeMultiple?: boolean; sourceTool?: string }) => {
      return importConfig(folderPath, options);
    }
  );

  console.log('IPC handlers registered');
}

/**
 * Unregister all IPC handlers (for cleanup)
 */
export function unregisterIpcHandlers(): void {
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
