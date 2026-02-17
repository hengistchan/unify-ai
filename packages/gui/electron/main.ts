/**
 * Electron Main Process Entry
 * Initializes the application and coordinates all modules
 */

import { app, BrowserWindow } from 'electron';
import { createWindow, getMainWindow } from './window';
import { createApplicationMenu } from './menu';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus the main window if someone tries to open a second instance
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

/**
 * Initialize the application
 */
function initializeApp(): void {
  // Create the main window
  createWindow();

  // Create the application menu
  createApplicationMenu();

  // Register IPC handlers
  registerIpcHandlers();
}

// App lifecycle events
app.whenReady().then(() => {
  initializeApp();

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup before quit
app.on('before-quit', () => {
  unregisterIpcHandlers();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
