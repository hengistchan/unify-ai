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

  // API Key Actions
  setAPIKey: (input: SetAPIKeyInput) => Promise<void>;
  validateAPIKey: (providerId: string) => Promise<boolean>;
  hasValidAPIKey: (providerId: string) => Promise<boolean>;

  // Model Actions
  loadModels: (providerId: string) => Promise<void>;
  setDefaultModel: (providerId: string, modelId: string) => Promise<void>;

  // Usage Actions
  loadUsageSummary: (filters?: UsageLogFilters) => Promise<void>;
  loadUsageLogs: (filters?: UsageLogFilters) => Promise<void>;
  logUsage: (input: LogUsageInput) => Promise<void>;

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
  // Utility Actions
  // ============================================

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },
}));
