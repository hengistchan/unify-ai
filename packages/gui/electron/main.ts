/**
 * Electron Main Process Entry
 * Initializes the application and coordinates all modules
 */

import { app, BrowserWindow, nativeImage } from 'electron';
import { createWindow, getMainWindow } from './window.js';
import { createApplicationMenu } from './menu.js';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get __dirname in ES module scope
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set app name for dock/menu display
app.setName('Unify AI');

/**
 * Get the icon path for the current environment
 */
function getIconPath(): string | undefined {
  const possiblePaths = [
    path.join(__dirname, '../build/icon.png'), // Production: dist/electron/../build/
    path.join(__dirname, '../../build/icon.png'), // Development from source
    path.join(__dirname, '../public/icon.png'), // Alternative path
  ];

  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }
  return undefined;
}

// Set dock icon on macOS
if (process.platform === 'darwin' && app.dock) {
  const iconPath = getIconPath();
  if (iconPath) {
    console.log('[Main] Setting dock icon from:', iconPath);
    const iconImage = nativeImage.createFromPath(iconPath);
    if (!iconImage.isEmpty()) {
      app.dock.setIcon(iconImage);
      console.log('[Main] Dock icon set successfully');
    } else {
      console.warn('[Main] Failed to create icon image');
    }
  } else {
    console.warn('[Main] Icon file not found');
  }
}

// Print startup info
console.log('\n========================================');
console.log('  Unify AI - GUI Application');
console.log('========================================');
console.log(`  Version:    ${app.getVersion()}`);
console.log(`  Electron:   ${process.versions.electron}`);
console.log(`  Node:       ${process.versions.node}`);
console.log(`  Platform:   ${process.platform} ${process.arch}`);
console.log(`  App Path:   ${app.getAppPath()}`);
console.log('========================================\n');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not installed, skip
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
async function initializeApp(): Promise<void> {
  console.log('[Main] Initializing application...');

  // Create the main window
  createWindow();
  console.log('[Main] Window created');

  // Create the application menu
  createApplicationMenu();
  console.log('[Main] Menu created');

  // Register IPC handlers (now async)
  await registerIpcHandlers();
  console.log('[Main] IPC handlers registered');

  console.log('[Main] Application ready\n');
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
process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', reason => {
  console.error('Unhandled rejection:', reason);
});
