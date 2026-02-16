/**
 * IPC Handlers Index
 * Registers all IPC handlers for the main process
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './channels';
import { detectTools, openFolderDialog } from './tool-detection';
import { syncConfig } from './sync';

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
  ipcMain.handle(IPC_CHANNELS.SYNC_CONFIG, async (_event, config: unknown, targetTools: string[]) => {
    return syncConfig(config, targetTools);
  });

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
