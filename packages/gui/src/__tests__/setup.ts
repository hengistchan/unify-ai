import '@testing-library/jest-dom';
import { vi } from 'vitest';

const mockModelAPI = {
  getProviders: vi.fn().mockResolvedValue([]),
  getProvider: vi.fn().mockResolvedValue(null),
  createProvider: vi.fn().mockResolvedValue({}),
  updateProvider: vi.fn().mockResolvedValue({}),
  deleteProvider: vi.fn().mockResolvedValue(undefined),
  setProviderEnabled: vi.fn().mockResolvedValue(undefined),
  setProviderPriority: vi.fn().mockResolvedValue(undefined),
  setAPIKey: vi.fn().mockResolvedValue({}),
  getAPIKey: vi.fn().mockResolvedValue(null),
  validateAPIKey: vi.fn().mockResolvedValue(true),
  validateAPIKeyWithoutSaving: vi.fn().mockResolvedValue({ valid: true }),
  deleteAPIKey: vi.fn().mockResolvedValue(undefined),
  hasValidAPIKey: vi.fn().mockResolvedValue(false),
  getModels: vi.fn().mockResolvedValue([]),
  addModel: vi.fn().mockResolvedValue({}),
  updateModelDetails: vi.fn().mockResolvedValue({}),
  deleteModel: vi.fn().mockResolvedValue(undefined),
  setModelEnabled: vi.fn().mockResolvedValue({}),
  setDefaultModel: vi.fn().mockResolvedValue(undefined),
  getDefaultModel: vi.fn().mockResolvedValue(null),
  logUsage: vi.fn().mockResolvedValue({}),
  getUsageLogs: vi.fn().mockResolvedValue([]),
  getUsageSummary: vi.fn().mockResolvedValue({
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalRequests: 0,
    byProvider: [],
    byModel: [],
    byDate: [],
  }),
  getActiveProvider: vi.fn().mockResolvedValue(null),
  getActiveProviders: vi.fn().mockResolvedValue([]),
  getCurrentProvider: vi
    .fn()
    .mockResolvedValue({ toolId: '', providerId: null, isOverride: false }),
  listGlobalProviders: vi.fn().mockResolvedValue([]),
  listToolProviders: vi.fn().mockResolvedValue([]),
  setToolOverrideProvider: vi.fn().mockResolvedValue(undefined),
  clearToolOverride: vi.fn().mockResolvedValue(undefined),
  getGlobalProviderUsage: vi.fn().mockResolvedValue([]),
  setGlobalDefaultProvider: vi.fn().mockResolvedValue(undefined),
};

const mockProxyAPI = {
  startProxy: vi.fn().mockResolvedValue({ success: true }),
  stopProxy: vi.fn().mockResolvedValue({ success: true }),
  getProxyStatus: vi.fn().mockResolvedValue('stopped'),
  getProxyStats: vi.fn().mockResolvedValue(null),
  getRequestLogs: vi.fn().mockResolvedValue([]),
  clearRequestLogs: vi.fn().mockResolvedValue({ success: true }),
};

const mockTrayAPI = {
  updateProviders: vi.fn().mockResolvedValue(undefined),
  onProviderChanged: vi.fn(() => () => {}),
};

const mockQuickSwitcherAPI = {
  onTriggered: vi.fn(() => () => {}),
};

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
  model: mockModelAPI,
  proxy: mockProxyAPI,
  tray: mockTrayAPI,
  quickSwitcher: mockQuickSwitcherAPI,
};

// Set up global window mock
global.window = global.window || {};
(window as any).electronAPI = mockElectronAPI;

// Export for use in tests
export { mockElectronAPI, mockModelAPI, mockProxyAPI, mockTrayAPI };
