import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Electron API
const mockElectronAPI = {
  openFolder: vi.fn().mockResolvedValue(null),
  detectTools: vi.fn().mockResolvedValue([]),
  syncConfig: vi.fn().mockResolvedValue({ success: true, message: 'OK', syncedTools: [] }),
  previewSync: vi.fn().mockResolvedValue([]),
  getToolConfig: vi.fn().mockResolvedValue({ success: true }),
  importConfig: vi.fn().mockResolvedValue({ success: true }),
  exportConfig: vi.fn().mockResolvedValue({ success: true, message: 'OK', exportedTools: [] }),
  saveUnifiedConfig: vi.fn().mockResolvedValue({ success: true }),
  loadUnifiedConfig: vi.fn().mockResolvedValue({ success: false, error: 'Not found' }),
  onFolderSelected: vi.fn(() => () => {}),
};

// Set up global window mock
global.window = global.window || {};
(window as any).electronAPI = mockElectronAPI;

// Export for use in tests
export { mockElectronAPI };
