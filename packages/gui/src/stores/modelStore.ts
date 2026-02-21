/**
 * Model Management Store
 * Zustand-based state management for model configuration
 */

import { create } from 'zustand';
import type {
  AIProvider,
  ModelInfo,
  UsageSummary,
  UsageLog,
  UsageLogFilters,
  CreateProviderInput,
  UpdateProviderInput,
  SetAPIKeyInput,
  LogUsageInput,
  ProxyConfig,
  ProxyStats,
  ProxyStatus,
  RequestLog,
  APIKeyValidationResult,
} from '@unify-ai/core/model';

// ============================================
// Type Definitions
// ============================================

export interface ModelState {
  // Providers
  providers: AIProvider[];
  activeProvider: AIProvider | null;
  selectedProviderId: string | null;

  // Models (by provider ID)
  modelsByProvider: Map<string, ModelInfo[]>;

  // Usage
  usageSummary: UsageSummary | null;
  usageLogs: UsageLog[];

  // Proxy
  proxyStatus: ProxyStatus;
  proxyStats: ProxyStats | null;
  requestLogs: RequestLog[];

  // UI State
  loading: boolean;
  error: string | null;

  // Provider Actions
  loadProviders: () => Promise<void>;
  createProvider: (input: CreateProviderInput) => Promise<AIProvider>;
  updateProvider: (id: string, input: UpdateProviderInput) => Promise<AIProvider>;
  deleteProvider: (id: string) => Promise<void>;
  setProviderEnabled: (id: string, enabled: boolean) => Promise<void>;
  setProviderPriority: (id: string, priority: number) => Promise<void>;
  selectProvider: (id: string | null) => void;
  loadActiveProvider: () => Promise<void>;
  setActiveProvider: (providerId: string) => Promise<void>;
  initializeTrayListener: () => () => void;

  // API Key Actions
  setAPIKey: (input: SetAPIKeyInput) => Promise<void>;
  validateAPIKey: (providerId: string) => Promise<boolean>;
  validateAPIKeyWithoutSaving: (
    providerId: string,
    apiKey: string,
    options?: { timeout?: number; baseUrl?: string }
  ) => Promise<APIKeyValidationResult>;
  hasValidAPIKey: (providerId: string) => Promise<boolean>;

  // Model Actions
  loadModels: (providerId: string) => Promise<void>;
  setDefaultModel: (providerId: string, modelId: string) => Promise<void>;

  // Usage Actions
  loadUsageSummary: (filters?: UsageLogFilters) => Promise<void>;
  loadUsageLogs: (filters?: UsageLogFilters) => Promise<void>;
  logUsage: (input: LogUsageInput) => Promise<void>;

  // Proxy Actions
  startProxy: (config?: Partial<ProxyConfig>) => Promise<void>;
  stopProxy: () => Promise<void>;
  loadProxyStatus: () => Promise<void>;
  loadProxyStats: () => Promise<void>;
  loadRequestLogs: (limit?: number) => Promise<void>;

  // Utility Actions
  clearError: () => void;
  reset: () => void;
}

// ============================================
// Initial State
// ============================================

const initialState = {
  providers: [],
  activeProvider: null,
  selectedProviderId: null,
  modelsByProvider: new Map<string, ModelInfo[]>(),
  usageSummary: null,
  usageLogs: [],
  proxyStatus: 'stopped' as ProxyStatus,
  proxyStats: null,
  requestLogs: [],
  loading: false,
  error: null,
};

// ============================================
// Store Implementation
// ============================================

export const useModelStore = create<ModelState>((set, get) => ({
  ...initialState,

  // ============================================
  // Provider Actions
  // ============================================

  loadProviders: async () => {
    set({ loading: true, error: null });
    try {
      const providers = await window.electronAPI.model.getProviders();
      set({ providers, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load providers';
      set({ error: message, loading: false });
      throw error;
    }
  },

  createProvider: async (input: CreateProviderInput) => {
    set({ loading: true, error: null });
    try {
      const provider = await window.electronAPI.model.createProvider(input);
      const providers = [...get().providers, provider];
      set({ providers, loading: false });
      return provider;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create provider';
      set({ error: message, loading: false });
      throw error;
    }
  },

  updateProvider: async (id: string, input: UpdateProviderInput) => {
    set({ loading: true, error: null });
    try {
      const provider = await window.electronAPI.model.updateProvider(id, input);
      const providers = get().providers.map(p => (p.id === id ? provider : p));
      set({ providers, loading: false });
      return provider;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update provider';
      set({ error: message, loading: false });
      throw error;
    }
  },

  deleteProvider: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.model.deleteProvider(id);
      const providers = get().providers.filter(p => p.id !== id);
      const modelsByProvider = new Map(get().modelsByProvider);
      modelsByProvider.delete(id);
      set({
        providers,
        modelsByProvider,
        selectedProviderId: get().selectedProviderId === id ? null : get().selectedProviderId,
        loading: false
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete provider';
      set({ error: message, loading: false });
      throw error;
    }
  },

  setProviderEnabled: async (id: string, enabled: boolean) => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.model.setProviderEnabled(id, enabled);
      const providers = get().providers.map(p =>
        p.id === id ? { ...p, enabled } : p
      );
      set({ providers, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update provider';
      set({ error: message, loading: false });
      throw error;
    }
  },

  setProviderPriority: async (id: string, priority: number) => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.model.setProviderPriority(id, priority);
      const providers = get().providers.map(p =>
        p.id === id ? { ...p, priority } : p
      );
      set({ providers, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update provider priority';
      set({ error: message, loading: false });
      throw error;
    }
  },

  selectProvider: (id: string | null) => {
    set({ selectedProviderId: id });
  },

  loadActiveProvider: async () => {
    set({ loading: true, error: null });
    try {
      const activeProvider = await window.electronAPI.model.getActiveProvider();
      set({ activeProvider, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load active provider';
      set({ error: message, loading: false });
      throw error;
    }
  },

  setActiveProvider: async (providerId: string) => {
    set({ loading: true, error: null });
    try {
      // Update the provider's priority to make it the active one
      // First, get all providers to find current highest priority
      const providers = get().providers;
      const maxPriority = Math.max(...providers.map(p => p.priority), 0);

      // Set the selected provider's priority to be highest
      await window.electronAPI.model.setProviderPriority(providerId, maxPriority + 10);

      // Reload active provider
      const activeProvider = await window.electronAPI.model.getActiveProvider();
      set({ activeProvider, loading: false });

      // Update tray
      await window.electronAPI.tray.updateProviders();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set active provider';
      set({ error: message, loading: false });
      throw error;
    }
  },

  initializeTrayListener: () => {
    // Listen for provider changes from tray
    const cleanup = window.electronAPI.tray.onProviderChanged(async (providerId: string) => {
      console.log('[ModelStore] Provider changed from tray:', providerId);

      // Set the new active provider
      try {
        await get().setActiveProvider(providerId);
      } catch (error) {
        console.error('[ModelStore] Failed to set active provider from tray:', error);
      }
    });

    return cleanup;
  },

  // ============================================
  // API Key Actions
  // ============================================

  setAPIKey: async (input: SetAPIKeyInput) => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.model.setAPIKey(input);
      // Reload provider to update hasValidKey status
      await get().loadProviders();
      set({ loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set API key';
      set({ error: message, loading: false });
      throw error;
    }
  },

  validateAPIKey: async (providerId: string) => {
    set({ loading: true, error: null });
    try {
      const isValid = await window.electronAPI.model.validateAPIKey(providerId);
      await get().loadProviders();
      set({ loading: false });
      return isValid;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to validate API key';
      set({ error: message, loading: false });
      throw error;
    }
  },

  validateAPIKeyWithoutSaving: async (
    providerId: string,
    apiKey: string,
    options?: { timeout?: number; baseUrl?: string }
  ) => {
    set({ loading: true, error: null });
    try {
      const result = await window.electronAPI.model.validateAPIKeyWithoutSaving(
        providerId,
        apiKey,
        options
      );
      set({ loading: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to validate API key';
      set({ error: message, loading: false });
      return {
        valid: false,
        error: message,
        errorType: 'unknown' as const,
      };
    }
  },

  hasValidAPIKey: async (providerId: string) => {
    try {
      return await window.electronAPI.model.hasValidAPIKey(providerId);
    } catch (error) {
      console.error('Failed to check API key:', error);
      return false;
    }
  },

  // ============================================
  // Model Actions
  // ============================================

  loadModels: async (providerId: string) => {
    set({ loading: true, error: null });
    try {
      const models = await window.electronAPI.model.getModels(providerId);
      const modelsByProvider = new Map(get().modelsByProvider);
      modelsByProvider.set(providerId, models);
      set({ modelsByProvider, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load models';
      set({ error: message, loading: false });
      throw error;
    }
  },

  setDefaultModel: async (providerId: string, modelId: string) => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.model.setDefaultModel(providerId, modelId);
      await get().loadProviders();
      set({ loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set default model';
      set({ error: message, loading: false });
      throw error;
    }
  },

  // ============================================
  // Usage Actions
  // ============================================

  loadUsageSummary: async (filters?: UsageLogFilters) => {
    set({ loading: true, error: null });
    try {
      const usageSummary = await window.electronAPI.model.getUsageSummary(filters);
      set({ usageSummary, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load usage summary';
      set({ error: message, loading: false });
      throw error;
    }
  },

  loadUsageLogs: async (filters?: UsageLogFilters) => {
    set({ loading: true, error: null });
    try {
      const usageLogs = await window.electronAPI.model.getUsageLogs(filters);
      set({ usageLogs, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load usage logs';
      set({ error: message, loading: false });
      throw error;
    }
  },

  logUsage: async (input: LogUsageInput) => {
    try {
      await window.electronAPI.model.logUsage(input);
    } catch (error) {
      console.error('Failed to log usage:', error);
    }
  },

  // ============================================
  // Proxy Actions
  // ============================================

  startProxy: async (config?: Partial<ProxyConfig>) => {
    set({ loading: true, error: null });
    try {
      const result = await window.electronAPI.proxy.startProxy(config);
      if (!result.success) {
        throw new Error(result.error || 'Failed to start proxy');
      }
      await get().loadProxyStatus();
      set({ loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start proxy';
      set({ error: message, loading: false });
      throw error;
    }
  },

  stopProxy: async () => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.proxy.stopProxy();
      await get().loadProxyStatus();
      set({ loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop proxy';
      set({ error: message, loading: false });
      throw error;
    }
  },

  loadProxyStatus: async () => {
    try {
      const proxyStatus = await window.electronAPI.proxy.getProxyStatus();
      set({ proxyStatus });
    } catch (error) {
      console.error('Failed to load proxy status:', error);
    }
  },

  loadProxyStats: async () => {
    try {
      const proxyStats = await window.electronAPI.proxy.getProxyStats();
      set({ proxyStats });
    } catch (error) {
      console.error('Failed to load proxy stats:', error);
    }
  },

  loadRequestLogs: async (limit?: number) => {
    try {
      const requestLogs = await window.electronAPI.proxy.getRequestLogs(limit);
      set({ requestLogs });
    } catch (error) {
      console.error('Failed to load request logs:', error);
    }
  },

  // ============================================
  // Utility Actions
  // ============================================

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },
}));
