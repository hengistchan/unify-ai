import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Unify AI',
    show: false, // Don't show until ready
    icon: path.join(__dirname, '../public/icon.png'),
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create application menu
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS)
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Folder',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog({
              properties: ['openDirectory'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send('folder-selected', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(process.platform === 'darwin'
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }]),
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' },
        { role: 'togglefullscreen' as const },
      ],
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(process.platform === 'darwin'
          ? [{ type: 'separator' as const }, { role: 'front' as const }, { type: 'separator' as const }, { role: 'window' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
    // Help menu
    {
      role: 'help' as const,
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/unify-ai/unify-ai');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers

// Open folder dialog
ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// Detect AI tools in a given directory
ipcMain.handle('detect-tools', async (_event, folderPath: string) => {
  // Import the core library's tool detection
  try {
    // This will be implemented with @unify-ai/core
    // For now, return a placeholder
    const detectedTools: string[] = [];

    // Basic file-based detection
    const fs = await import('fs/promises');
    const files = await fs.readdir(folderPath);

    const toolConfigPatterns: Record<string, string[]> = {
      cursor: ['.cursorrules', '.cursor'],
      'claude-code': ['CLAUDE.md', '.claude'],
      copilot: ['.github/copilot-instructions.md'],
      windsurf: ['.windsurfrules', '.windsurf'],
      cline: ['.clinerules', '.cline'],
      aider: ['.aider.conf.yml', 'aider.conf.yml'],
      continue: ['.continue/config.json', 'continue.json'],
      codex: ['CODEX.md', 'codex.toml'],
    };

    for (const [tool, patterns] of Object.entries(toolConfigPatterns)) {
      for (const pattern of patterns) {
        if (files.some((f) => f === pattern || f.startsWith(pattern.split('/')[0]))) {
          if (!detectedTools.includes(tool)) {
            detectedTools.push(tool);
          }
        }
      }
    }

    return detectedTools;
  } catch (error) {
    console.error('Error detecting tools:', error);
    return [];
  }
});

// Sync configuration across tools
ipcMain.handle('sync-config', async (_event, _config: unknown, targetTools: string[]) => {
  try {
    // This will be implemented with @unify-ai/core
    // For now, return a placeholder result
    return {
      success: true,
      message: `Synced configuration to ${targetTools.length} tools`,
      syncedTools: targetTools,
    };
  } catch (error) {
    console.error('Error syncing config:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      syncedTools: [],
    };
  }
});

// App lifecycle events
app.whenReady().then(() => {
  createWindow();
  createMenu();

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
