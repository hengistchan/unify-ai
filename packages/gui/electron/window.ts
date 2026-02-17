/**
 * Window Manager
 * Creates and manages application windows
 */

import { BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

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
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    title: WINDOW_CONFIG.title,
    show: false, // Don't show until ready
    icon: path.join(__dirname, '../public/icon.png'),
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
    window.loadFile(path.join(__dirname, '../dist/index.html'));
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
