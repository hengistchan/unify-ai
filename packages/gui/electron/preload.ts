import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for the exposed API
interface ElectronAPI {
  openFolder: () => Promise<string | null>;
  detectTools: (folderPath: string) => Promise<string[]>;
  syncConfig: (config: unknown, targetTools: string[]) => Promise<SyncResult>;
  onFolderSelected: (callback: (folderPath: string) => void) => () => void;
}

interface SyncResult {
  success: boolean;
  message: string;
  syncedTools: string[];
}

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Open folder dialog
  openFolder: () => ipcRenderer.invoke('open-folder'),

  // Detect AI tools in a folder
  detectTools: (folderPath: string) => ipcRenderer.invoke('detect-tools', folderPath),

  // Sync configuration to specified tools
  syncConfig: (config: unknown, targetTools: string[]) => ipcRenderer.invoke('sync-config', config, targetTools),

  // Listen for folder selection from menu
  onFolderSelected: (callback: (folderPath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, folderPath: string) => {
      callback(folderPath);
    };
    ipcRenderer.on('folder-selected', handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('folder-selected', handler);
    };
  },
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
