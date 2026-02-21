/**
 * System Tray Manager
 * Creates and manages the system tray icon with dynamic provider list
 */

import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AIProvider } from '@unify-ai/core/model';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray: Tray | null = null;
let currentProviders: AIProvider[] = [];
let currentProviderId: string | null = null;
let onProviderChange: ((providerId: string) => void) | null = null;

/**
 * Get the tray icon path
 */
function getTrayIconPath(): string {
  // macOS uses Template images for proper dark/light mode support
  // The filename should end with 'Template' on macOS
  const possiblePaths = [
    path.join(__dirname, '../build/tray.png'),
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, '../../build/tray.png'),
    path.join(__dirname, '../../build/icon.png'),
    path.join(__dirname, '../public/tray.png'),
    path.join(__dirname, '../public/icon.png'),
  ];

  const fs = require('fs');
  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }

  // Fallback to main icon
  console.warn('[Tray] Tray icon not found, using default');
  return path.join(__dirname, '../build/icon.png');
}

/**
 * Create tray icon image
 */
function createTrayIcon(): nativeImage {
  const iconPath = getTrayIconPath();

  try {
    const image = nativeImage.createFromPath(iconPath);

    // On macOS, set as template image for proper dark/light mode support
    if (process.platform === 'darwin') {
      // Resize for tray (16x16 or 18x18 is typical for macOS tray icons)
      const resized = image.resize({ width: 16, height: 16 });
      return resized;
    }

    // On Windows/Linux, use appropriate size
    if (process.platform === 'win32') {
      return image.resize({ width: 16, height: 16 });
    }

    return image.resize({ width: 22, height: 22 });
  } catch (error) {
    console.error('[Tray] Failed to create tray icon:', error);
    // Return empty image as fallback
    return nativeImage.createEmpty();
  }
}

/**
 * Build the tray menu with providers
 */
function buildTrayMenu(): Menu {
  const template: Electron.MenuItemConstructorOptions[] = [];

  // Provider section header
  template.push({
    label: 'Select Provider',
    enabled: false,
  });

  // Add enabled providers with checkmarks
  const enabledProviders = currentProviders.filter(p => p.enabled);

  if (enabledProviders.length === 0) {
    template.push({
      label: 'No providers configured',
      enabled: false,
    });
  } else {
    // Group providers by type or list all
    // For simplicity, we list all enabled providers sorted by priority
    const sortedProviders = [...enabledProviders].sort((a, b) => b.priority - a.priority);

    for (const provider of sortedProviders) {
      const isSelected = provider.id === currentProviderId;
      template.push({
        label: provider.name,
        type: 'checkbox',
        checked: isSelected,
        click: () => handleProviderSelect(provider.id),
      });
    }
  }

  // Separator
  template.push({ type: 'separator' });

  // Quick actions
  template.push({
    label: 'Open Unify AI',
    click: () => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    },
  });

  // Separator
  template.push({ type: 'separator' });

  // Quit option
  template.push({
    label: 'Quit',
    click: () => {
      app.quit();
    },
  });

  return Menu.buildFromTemplate(template);
}

/**
 * Handle provider selection from tray menu
 */
function handleProviderSelect(providerId: string): void {
  if (providerId === currentProviderId) {
    return; // No change needed
  }

  console.log('[Tray] Provider selected:', providerId);
  currentProviderId = providerId;

  // Notify callback if set
  if (onProviderChange) {
    onProviderChange(providerId);
  }

  // Update menu to reflect selection
  updateTrayMenu();
}

/**
 * Update the tray menu
 */
function updateTrayMenu(): void {
  if (!tray) return;

  const menu = buildTrayMenu();
  tray.setContextMenu(menu);

  // Update tooltip to show current provider
  const currentProvider = currentProviders.find(p => p.id === currentProviderId);
  if (currentProvider) {
    tray.setToolTip(`Unify AI - ${currentProvider.name}`);
  } else {
    tray.setToolTip('Unify AI');
  }
}

/**
 * Initialize the system tray
 */
export function initializeTray(
  providers: AIProvider[],
  activeProviderId: string | null,
  onSwitch?: (providerId: string) => void
): void {
  console.log('[Tray] Initializing system tray...');

  // Store initial state
  currentProviders = providers;
  currentProviderId = activeProviderId;
  onProviderChange = onSwitch || null;

  // Create tray icon
  const icon = createTrayIcon();
  tray = new Tray(icon);

  // Set initial menu
  updateTrayMenu();

  // On Windows, show window on double-click
  if (process.platform === 'win32') {
    tray.on('double-click', () => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  // On macOS, show window on click (since context menu is on right-click)
  if (process.platform === 'darwin') {
    tray.on('click', () => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  console.log('[Tray] System tray initialized');
}

/**
 * Update providers in the tray menu
 */
export function updateProviders(providers: AIProvider[], activeProviderId?: string | null): void {
  currentProviders = providers;

  if (activeProviderId !== undefined) {
    currentProviderId = activeProviderId;
  }

  updateTrayMenu();
  console.log('[Tray] Providers updated:', providers.length, 'active:', currentProviderId);
}

/**
 * Set the currently active provider
 */
export function setActiveProvider(providerId: string): void {
  currentProviderId = providerId;
  updateTrayMenu();
  console.log('[Tray] Active provider set to:', providerId);
}

/**
 * Get the current tray instance
 */
export function getTray(): Tray | null {
  return tray;
}

/**
 * Destroy the tray icon
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
    console.log('[Tray] System tray destroyed');
  }
}

/**
 * Show a notification from the tray
 */
export function showTrayNotification(title: string, message: string): void {
  if (tray) {
    // On macOS, use the displayBalloon method or native notifications
    // For now, we'll just log it as a simple implementation
    console.log(`[Tray] Notification: ${title} - ${message}`);

    // Note: For actual notifications, we would use Electron's Notification module
    // This is a placeholder for future enhancement
  }
}
