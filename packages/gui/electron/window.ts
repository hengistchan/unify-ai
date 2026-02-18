/**
 * Window Manager
 * Creates and manages application windows
 */

import { BrowserWindow, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname in ES module scope
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

/**
 * Get the icon path for the current environment
 */
function getIconPath(): string | undefined {
  // In production, the icon is in the build folder relative to dist/electron/
  // In development, it's in the build folder relative to electron/
  const possiblePaths = [
    path.join(__dirname, '../build/icon.png'), // Production: dist/electron/../build/
    path.join(__dirname, '../../build/icon.png'), // Alternative production path
    path.join(__dirname, '../public/icon.png'), // Development fallback
  ];

  const fs = require('fs');
  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      console.log('[Window] Found icon at:', iconPath);
      return iconPath;
    }
  }
  console.warn('[Window] Icon not found in any path');
  return undefined;
}

/**
 * Window configuration
 */
const WINDOW_CONFIG = {
  width: 1200,
  height: 800,
  minWidth: 900,
  minHeight: 600,
  title: 'Unify AI',
};

/**
 * Create the main application window
 */
export function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: WINDOW_CONFIG.width,
    height: WINDOW_CONFIG.height,
    minWidth: WINDOW_CONFIG.minWidth,
    minHeight: WINDOW_CONFIG.minHeight,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), // .cjs for CommonJS
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Disable sandbox for development
    },
    title: WINDOW_CONFIG.title,
    show: false, // Don't show until ready
    icon: (() => {
      const iconPath = getIconPath();
      return iconPath ? nativeImage.createFromPath(iconPath) : undefined;
    })(),
    backgroundColor: '#000000', // OLED dark background
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  loadApp(mainWindow);

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Load the application into the window
 */
function loadApp(window: BrowserWindow): void {
  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;

  if (isDev) {
    window.loadURL('http://localhost:5173');
    window.webContents.openDevTools();
  } else {
    window.loadFile(path.join(__dirname, '../index.html'));
  }
}

/**
 * Get the main window
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Focus the main window (create if needed)
 */
export function focusMainWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
}

/**
 * Close the main window
 */
export function closeMainWindow(): void {
  mainWindow?.close();
}
