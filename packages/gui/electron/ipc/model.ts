/**
 * Model Management IPC Handlers
 * Handles all IPC communication for model configuration management
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './channels';
import { ModelManager } from '@unify-ai/core/model';
import type {
  CreateProviderInput,
  UpdateProviderInput,
  SetAPIKeyInput,
  AddModelInput,
  UpdateModelInput,
  LogUsageInput,
  UsageLogFilters,
  ValidationOptions,
} from '@unify-ai/core/model';

let modelManager: ModelManager | null = null;

/**
 * Initialize ModelManager instance
 * Called during app startup
 */
export async function initializeModelManager(): Promise<ModelManager> {
  if (!modelManager) {
    console.log('[Model IPC] Initializing ModelManager...');
    modelManager = new ModelManager();
    await modelManager.initialize();
    console.log('[Model IPC] ModelManager initialized');
  }
  return modelManager;
}

/**
 * Get ModelManager instance
 */
function getModelManager(): ModelManager {
  if (!modelManager) {
    throw new Error('ModelManager not initialized. Call initializeModelManager() first.');
  }
  return modelManager;
}

/**
 * Get ModelManager instance (exported for tray and other main process modules)
 */
export function getModelManagerForTray(): ModelManager {
  return getModelManager();
}

/**
 * Register all model management IPC handlers
 */
export function registerModelIpcHandlers(): void {
  console.log('[Model IPC] Registering model handlers...');

  // ============================================
  // Provider Management
  // ============================================

  ipcMain.handle(IPC_CHANNELS.GET_PROVIDERS, async () => {
    console.log('[Model IPC] Getting providers...');
    const manager = getModelManager();
    const providers = await manager.listProviders();
    console.log(`[Model IPC] Retrieved ${providers.length} providers`);
    return providers;
  });

  ipcMain.handle(IPC_CHANNELS.GET_PROVIDER, async (_event, providerId: string) => {
    console.log('[Model IPC] Getting provider:', providerId);
    const manager = getModelManager();
    const provider = await manager.getProvider(providerId);
    return provider;
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_PROVIDER, async (_event, input: CreateProviderInput) => {
    console.log('[Model IPC] Creating provider:', input.id);
    const manager = getModelManager();
    const provider = await manager.createProvider(input);
    console.log('[Model IPC] Provider created:', provider.id);
    return provider;
  });

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_PROVIDER,
    async (_event, providerId: string, input: UpdateProviderInput) => {
      console.log('[Model IPC] Updating provider:', providerId);
      const manager = getModelManager();
      const provider = await manager.updateProvider(providerId, input);
      console.log('[Model IPC] Provider updated:', provider.id);
      return provider;
    }
  );

  ipcMain.handle(IPC_CHANNELS.DELETE_PROVIDER, async (_event, providerId: string) => {
    console.log('[Model IPC] Deleting provider:', providerId);
    const manager = getModelManager();
    await manager.deleteProvider(providerId);
    console.log('[Model IPC] Provider deleted:', providerId);
  });

  ipcMain.handle(
    IPC_CHANNELS.SET_PROVIDER_ENABLED,
    async (_event, providerId: string, enabled: boolean) => {
      console.log('[Model IPC] Setting provider enabled:', providerId, enabled);
      const manager = getModelManager();
      await manager.setProviderEnabled(providerId, enabled);
      console.log('[Model IPC] Provider enabled state updated');
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SET_PROVIDER_PRIORITY,
    async (_event, providerId: string, priority: number) => {
      console.log('[Model IPC] Setting provider priority:', providerId, priority);
      const manager = getModelManager();
      await manager.setProviderPriority(providerId, priority);
      console.log('[Model IPC] Provider priority updated');
    }
  );

  // ============================================
  // API Key Management
  // ============================================

  ipcMain.handle(IPC_CHANNELS.SET_API_KEY, async (_event, input: SetAPIKeyInput) => {
    console.log('[Model IPC] Setting API key for provider:', input.providerId);
    const manager = getModelManager();
    const apiKey = await manager.setAPIKey(input);
    console.log('[Model IPC] API key set:', apiKey.id);
    return apiKey;
  });

  ipcMain.handle(IPC_CHANNELS.GET_API_KEY, async (_event, providerId: string, keyName?: string) => {
    console.log('[Model IPC] Getting API key for provider:', providerId);
    const manager = getModelManager();
    const key = await manager.getAPIKey(providerId, keyName);
    return key;
  });

  ipcMain.handle(IPC_CHANNELS.VALIDATE_API_KEY, async (_event, providerId: string) => {
    console.log('[Model IPC] Validating API key for provider:', providerId);
    const manager = getModelManager();
    const isValid = await manager.validateAPIKey(providerId);
    console.log('[Model IPC] API key validation result:', isValid);
    return isValid;
  });

  ipcMain.handle(
    IPC_CHANNELS.VALIDATE_API_KEY_WITHOUT_SAVING,
    async (_event, providerId: string, apiKey: string, options?: ValidationOptions) => {
      // Don't log API key - security concern
      console.log('[Model IPC] Validating API key without saving for provider:', providerId);
      const manager = getModelManager();
      const result = await manager.validateAPIKeyWithoutSaving(providerId, apiKey, options);
      console.log('[Model IPC] API key validation result:', result.valid, result.errorType || 'ok');
      return result;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DELETE_API_KEY,
    async (_event, providerId: string, keyName?: string) => {
      console.log('[Model IPC] Deleting API key for provider:', providerId);
      const manager = getModelManager();
      await manager.deleteAPIKey(providerId, keyName);
      console.log('[Model IPC] API key deleted');
    }
  );

  ipcMain.handle(IPC_CHANNELS.HAS_VALID_API_KEY, async (_event, providerId: string) => {
    console.log('[Model IPC] Checking if provider has valid API key:', providerId);
    const manager = getModelManager();
    const hasKey = await manager.hasValidAPIKey(providerId);
    console.log('[Model IPC] Has valid key:', hasKey);
    return hasKey;
  });

  // ============================================
  // Model Management
  // ============================================

  ipcMain.handle(IPC_CHANNELS.GET_MODELS, async (_event, providerId: string) => {
    console.log('[Model IPC] Getting models for provider:', providerId);
    const manager = getModelManager();
    const models = await manager.listModels(providerId);
    console.log(`[Model IPC] Retrieved ${models.length} models`);
    return models;
  });

  ipcMain.handle(
    IPC_CHANNELS.ADD_MODEL,
    async (_event, providerId: string, input: AddModelInput) => {
      console.log('[Model IPC] Adding model to provider:', providerId, input.id);
      const manager = getModelManager();
      const model = await manager.addModel(providerId, input);
      console.log('[Model IPC] Model added:', model.id);
      return model;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_MODEL_DETAILS,
    async (_event, providerId: string, modelId: string, input: UpdateModelInput) => {
      console.log('[Model IPC] Updating model details:', modelId);
      const manager = getModelManager();
      const model = await manager.updateModelDetails(providerId, modelId, input);
      console.log('[Model IPC] Model details updated:', model.id);
      return model;
    }
  );

  ipcMain.handle(IPC_CHANNELS.DELETE_MODEL, async (_event, providerId: string, modelId: string) => {
    console.log('[Model IPC] Deleting model:', modelId);
    const manager = getModelManager();
    await manager.deleteModel(providerId, modelId);
    console.log('[Model IPC] Model deleted:', modelId);
  });

  ipcMain.handle(
    IPC_CHANNELS.SET_MODEL_ENABLED,
    async (_event, providerId: string, modelId: string, enabled: boolean) => {
      console.log('[Model IPC] Setting model enabled:', modelId, enabled);
      const manager = getModelManager();
      const model = await manager.setModelEnabled(providerId, modelId, enabled);
      console.log('[Model IPC] Model enabled state updated');
      return model;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SET_DEFAULT_MODEL,
    async (_event, providerId: string, modelId: string) => {
      console.log('[Model IPC] Setting default model:', modelId);
      const manager = getModelManager();
      await manager.setDefaultModel(providerId, modelId);
      console.log('[Model IPC] Default model set');
    }
  );

  ipcMain.handle(IPC_CHANNELS.GET_DEFAULT_MODEL, async (_event, providerId: string) => {
    console.log('[Model IPC] Getting default model for provider:', providerId);
    const manager = getModelManager();
    const model = await manager.getDefaultModel(providerId);
    return model;
  });

  // ============================================
  // Usage Tracking
  // ============================================

  ipcMain.handle(IPC_CHANNELS.LOG_USAGE, async (_event, input: LogUsageInput) => {
    console.log('[Model IPC] Logging usage for provider:', input.providerId);
    const manager = getModelManager();
    const log = await manager.logUsage(input);
    console.log('[Model IPC] Usage logged:', log.id);
    return log;
  });

  ipcMain.handle(IPC_CHANNELS.GET_USAGE_LOGS, async (_event, filters?: UsageLogFilters) => {
    console.log('[Model IPC] Getting usage logs with filters:', filters);
    const manager = getModelManager();
    const logs = await manager.getUsageLogs(filters);
    console.log(`[Model IPC] Retrieved ${logs.length} usage logs`);
    return logs;
  });

  ipcMain.handle(IPC_CHANNELS.GET_USAGE_SUMMARY, async (_event, filters?: UsageLogFilters) => {
    console.log('[Model IPC] Getting usage summary with filters:', filters);
    const manager = getModelManager();
    const summary = await manager.getUsageSummary(filters);
    console.log('[Model IPC] Usage summary retrieved');
    return summary;
  });

  // ============================================
  // Provider Selection
  // ============================================

  ipcMain.handle(IPC_CHANNELS.GET_ACTIVE_PROVIDER, async () => {
    console.log('[Model IPC] Getting active provider');
    const manager = getModelManager();
    const provider = await manager.getActiveProvider();
    console.log('[Model IPC] Active provider:', provider?.id || 'none');
    return provider;
  });

  ipcMain.handle(IPC_CHANNELS.GET_ACTIVE_PROVIDERS, async () => {
    console.log('[Model IPC] Getting all active providers');
    const manager = getModelManager();
    const providers = await manager.getActiveProviders();
    console.log(`[Model IPC] Retrieved ${providers.length} active providers`);
    return providers;
  });

  console.log('[Model IPC] All model handlers registered');
}

/**
 * Cleanup ModelManager
 */
export async function cleanupModelManager(): Promise<void> {
  if (modelManager) {
    console.log('[Model IPC] Cleaning up ModelManager...');
    modelManager = null;
    console.log('[Model IPC] ModelManager cleaned up');
  }
}
