import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Electron API
const mockElectronAPI = {
  openFolder: vi.fn(),
  detectTools: vi.fn(),
  syncConfig: vi.fn(),
  previewSync: vi.fn(),
  getToolConfig: vi.fn(),
  onFolderSelected: vi.fn(() => () => {}),
};

// Set up global window mock
global.window = global.window || {};
(window as any).electronAPI = mockElectronAPI;

// Export for use in tests
export { mockElectronAPI };
