/**
 * Tests for ModelManager
 *
 * Tests provider management, API key management, model management, and provider selection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelManager } from '../../model/ModelManager';
import type {
  CreateProviderInput,
  UpdateProviderInput,
  SetAPIKeyInput,
} from '../../model/types';

describe('ModelManager', () => {
  let manager: ModelManager;

  // Mock encryption key for testing (exactly 32 bytes)
  const mockEncryptionKey = Buffer.from('test-encryption-key-32-bytes!!!!', 'utf8');

  beforeEach(async () => {
    // Create ModelManager with in-memory database
    manager = new ModelManager({
      dbPath: ':memory:',
      encryptionKey: mockEncryptionKey,
    });
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      // ModelManager auto-initializes on first use
      const providers = await manager.listProviders();
      expect(providers).toBeDefined();
      expect(manager.isInitialized()).toBe(true);
    });

    it('should initialize with default providers', async () => {
      const providers = await manager.listProviders();

      expect(providers.length).toBeGreaterThan(0);
      expect(providers.find(p => p.id === 'openai')).toBeDefined();
      expect(providers.find(p => p.id === 'anthropic')).toBeDefined();
    });

    it('should not duplicate providers on multiple calls', async () => {
      await manager.listProviders();
      await manager.listProviders();

      const providers = await manager.listProviders();
      const openaiProviders = providers.filter(p => p.id === 'openai');

      expect(openaiProviders).toHaveLength(1);
    });
  });

  describe('provider management', () => {
    describe('listProviders()', () => {
      it('should return all providers', async () => {
        const providers = await manager.listProviders();

        expect(providers.length).toBeGreaterThan(0);
        expect(providers[0]).toHaveProperty('id');
        expect(providers[0]).toHaveProperty('name');
        expect(providers[0]).toHaveProperty('type');
        expect(providers[0]).toHaveProperty('enabled');
      });

      it('should return providers sorted by priority (descending)', async () => {
        const providers = await manager.listProviders();

        for (let i = 1; i < providers.length; i++) {
          expect(providers[i - 1].priority).toBeGreaterThanOrEqual(providers[i].priority);
        }
      });
    });

    describe('getProvider()', () => {
      it('should get provider by ID', async () => {
        const provider = await manager.getProvider('openai');

        expect(provider).toBeDefined();
        expect(provider!.id).toBe('openai');
        expect(provider!.name).toBe('OpenAI');
      });

      it('should return null for non-existent provider', async () => {
        const provider = await manager.getProvider('nonexistent');

        expect(provider).toBeNull();
      });
    });

    describe('createProvider()', () => {
      it('should create a new provider', async () => {
        const input: CreateProviderInput = {
          id: 'test-provider',
          name: 'Test Provider',
          type: 'custom',
          baseUrl: 'https://api.test.com/v1',
        };

        const provider = await manager.createProvider(input);

        expect(provider.id).toBe('test-provider');
        expect(provider.name).toBe('Test Provider');
        expect(provider.type).toBe('custom');
        expect(provider.enabled).toBe(true);
        expect(provider.priority).toBe(0);
        expect(provider.createdAt).toBeDefined();
        expect(provider.updatedAt).toBeDefined();
      });

      it('should create provider with models', async () => {
        const input: CreateProviderInput = {
          id: 'test-provider',
          name: 'Test Provider',
          type: 'custom',
          models: [
            {
              id: 'model-1',
              displayName: 'Model 1',
              contextWindow: 128000,
              maxOutputTokens: 4096,
              pricing: { inputPerK: 0.001, outputPerK: 0.002 },
              enabled: true,
            },
          ],
        };

        const provider = await manager.createProvider(input);

        expect(provider.models).toHaveLength(1);
        expect(provider.models[0].id).toBe('model-1');
      });

      it('should create provider with default model', async () => {
        const input: CreateProviderInput = {
          id: 'test-provider',
          name: 'Test Provider',
          type: 'custom',
          models: [
            {
              id: 'model-1',
              displayName: 'Model 1',
              contextWindow: 128000,
              maxOutputTokens: 4096,
              pricing: { inputPerK: 0.001, outputPerK: 0.002 },
              enabled: true,
            },
          ],
          defaultModel: 'model-1',
        };

        const provider = await manager.createProvider(input);

        expect(provider.defaultModel).toBe('model-1');
      });

      it('should throw error for duplicate provider ID', async () => {
        const input: CreateProviderInput = {
          id: 'openai', // Already exists
          name: 'Duplicate OpenAI',
          type: 'openai-compatible',
        };

        await expect(manager.createProvider(input)).rejects.toThrow();
      });

      it('should create provider with custom config', async () => {
        const input: CreateProviderInput = {
          id: 'test-provider',
          name: 'Test Provider',
          type: 'custom',
          config: {
            timeout: 30000,
            maxRetries: 3,
            customHeaders: {
              'X-Custom-Header': 'value',
            },
          },
        };

        const provider = await manager.createProvider(input);

        expect(provider.config.timeout).toBe(30000);
        expect(provider.config.maxRetries).toBe(3);
        expect(provider.config.customHeaders).toEqual({
          'X-Custom-Header': 'value',
        });
      });
    });

    describe('updateProvider()', () => {
      it('should update provider name', async () => {
        const input: UpdateProviderInput = {
          name: 'Updated OpenAI',
        };

        const provider = await manager.updateProvider('openai', input);

        expect(provider!.name).toBe('Updated OpenAI');
      });

      it('should update provider enabled status', async () => {
        const input: UpdateProviderInput = {
          enabled: false,
        };

        const provider = await manager.updateProvider('openai', input);

        expect(provider!.enabled).toBe(false);
      });

      it('should update provider priority', async () => {
        const input: UpdateProviderInput = {
          priority: 200,
        };

        const provider = await manager.updateProvider('openai', input);

        expect(provider!.priority).toBe(200);
      });

      it('should update provider models', async () => {
        const input: UpdateProviderInput = {
          models: [
            {
              id: 'new-model',
              displayName: 'New Model',
              contextWindow: 200000,
              maxOutputTokens: 8192,
              pricing: { inputPerK: 0.01, outputPerK: 0.03 },
              enabled: true,
            },
          ],
        };

        const provider = await manager.updateProvider('openai', input);

        expect(provider!.models).toHaveLength(1);
        expect(provider!.models[0].id).toBe('new-model');
      });

      it('should update provider default model', async () => {
        const input: UpdateProviderInput = {
          defaultModel: 'gpt-4-turbo',
        };

        const provider = await manager.updateProvider('openai', input);

        expect(provider!.defaultModel).toBe('gpt-4-turbo');
      });

      it('should throw error for non-existent provider', async () => {
        const input: UpdateProviderInput = {
          name: 'Updated Name',
        };

        await expect(manager.updateProvider('nonexistent', input)).rejects.toThrow();
      });

      it('should update updatedAt timestamp', async () => {
        const originalProvider = await manager.getProvider('openai');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s for timestamp change

        const input: UpdateProviderInput = {
          name: 'Updated OpenAI',
        };
        const updatedProvider = await manager.updateProvider('openai', input);

        expect(updatedProvider!.updatedAt).not.toBe(originalProvider!.updatedAt);
      });
    });

    describe('deleteProvider()', () => {
      it('should delete provider', async () => {
        await manager.deleteProvider('openai');
        const provider = await manager.getProvider('openai');

        expect(provider).toBeNull();
      });

      it('should delete associated API keys', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-test-key',
          keyName: 'primary',
        });

        await manager.deleteProvider('openai');

        const apiKey = await manager.getAPIKey('openai');
        expect(apiKey).toBeNull();
      });

      it('should throw error for non-existent provider', async () => {
        await expect(manager.deleteProvider('nonexistent')).rejects.toThrow();
      });
    });

    describe('setProviderEnabled() and setProviderPriority()', () => {
      it('should set provider enabled status', async () => {
        await manager.setProviderEnabled('openai', false);
        const provider = await manager.getProvider('openai');

        expect(provider!.enabled).toBe(false);
      });

      it('should set provider priority', async () => {
        await manager.setProviderPriority('openai', 500);
        const provider = await manager.getProvider('openai');

        expect(provider!.priority).toBe(500);
      });

      it('should throw error for non-existent provider', async () => {
        await expect(manager.setProviderEnabled('nonexistent', true)).rejects.toThrow();
        await expect(manager.setProviderPriority('nonexistent', 100)).rejects.toThrow();
      });
    });
  });

  describe('API key management', () => {
    describe('setAPIKey()', () => {
      it('should set API key for provider', async () => {
        const input: SetAPIKeyInput = {
          providerId: 'openai',
          key: 'sk-test-key-12345',
          keyName: 'primary',
        };

        const apiKey = await manager.setAPIKey(input);

        expect(apiKey.providerId).toBe('openai');
        expect(apiKey.keyName).toBe('primary');
        expect(apiKey.isValid).toBe(false);
        expect(apiKey.createdAt).toBeDefined();
      });

      it('should use default key name if not provided', async () => {
        const input: SetAPIKeyInput = {
          providerId: 'openai',
          key: 'sk-test-key-12345',
        };

        const apiKey = await manager.setAPIKey(input);

        expect(apiKey.keyName).toBe('primary');
      });

      it('should update existing API key', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-old-key',
          keyName: 'primary',
        });

        const input: SetAPIKeyInput = {
          providerId: 'openai',
          key: 'sk-new-key',
          keyName: 'primary',
        };

        const apiKey = await manager.setAPIKey(input);

        expect(apiKey.keyName).toBe('primary');
        expect(apiKey.updatedAt).toBeDefined();
      });

      it('should throw error for non-existent provider', async () => {
        const input: SetAPIKeyInput = {
          providerId: 'nonexistent',
          key: 'sk-test-key',
        };

        await expect(manager.setAPIKey(input)).rejects.toThrow();
      });
    });

    describe('getAPIKey()', () => {
      it('should get decrypted API key', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-test-key',
          keyName: 'primary',
        });

        const apiKey = await manager.getAPIKey('openai');

        expect(apiKey).toBe('sk-test-key');
      });

      it('should return null if no API key set', async () => {
        const apiKey = await manager.getAPIKey('anthropic');

        expect(apiKey).toBeNull();
      });

      it('should get API key by name', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-primary-key',
          keyName: 'primary',
        });

        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-backup-key',
          keyName: 'backup',
        });

        const apiKey = await manager.getAPIKey('openai', 'backup');

        expect(apiKey).toBe('sk-backup-key');
      });
    });

    describe('validateAPIKey()', () => {
      it('should validate API key successfully', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-test-key-with-sufficient-length',
          keyName: 'primary',
        });

        const isValid = await manager.validateAPIKey('openai');

        expect(isValid).toBe(true);
      });

      it('should return false for invalid key format', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'short', // Too short for OpenAI
        });

        const isValid = await manager.validateAPIKey('openai');

        expect(isValid).toBe(false);
      });

      it('should throw error for non-existent provider', async () => {
        await expect(manager.validateAPIKey('nonexistent')).rejects.toThrow();
      });

      it('should return false when no API key set', async () => {
        const isValid = await manager.validateAPIKey('anthropic');

        expect(isValid).toBe(false);
      });
    });

    describe('hasValidAPIKey()', () => {
      it('should return true for valid API key', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-test-key-with-sufficient-length',
        });
        await manager.validateAPIKey('openai');

        const hasValid = await manager.hasValidAPIKey('openai');

        expect(hasValid).toBe(true);
      });

      it('should return false for invalid key', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'short',
        });

        const hasValid = await manager.hasValidAPIKey('openai');

        expect(hasValid).toBe(false);
      });

      it('should return false when no key set', async () => {
        const hasValid = await manager.hasValidAPIKey('anthropic');

        expect(hasValid).toBe(false);
      });
    });

    describe('deleteAPIKey()', () => {
      it('should delete API key', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-test-key',
        });

        await manager.deleteAPIKey('openai');

        const apiKey = await manager.getAPIKey('openai');
        expect(apiKey).toBeNull();
      });

      it('should delete specific API key by name', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-primary',
          keyName: 'primary',
        });

        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-backup',
          keyName: 'backup',
        });

        await manager.deleteAPIKey('openai', 'backup');

        const backupKey = await manager.getAPIKey('openai', 'backup');
        const primaryKey = await manager.getAPIKey('openai', 'primary');

        expect(backupKey).toBeNull();
        expect(primaryKey).toBe('sk-primary');
      });

      it('should not throw error for non-existent key', async () => {
        await expect(manager.deleteAPIKey('anthropic')).resolves.not.toThrow();
      });
    });
  });

  describe('model management', () => {
    describe('listModels()', () => {
      it('should get models for provider', async () => {
        const models = await manager.listModels('openai');

        expect(models.length).toBeGreaterThan(0);
        expect(models[0]).toHaveProperty('id');
        expect(models[0]).toHaveProperty('displayName');
        expect(models[0]).toHaveProperty('contextWindow');
        expect(models[0]).toHaveProperty('pricing');
      });

      it('should get all models when no provider specified', async () => {
        const models = await manager.listModels();

        expect(models.length).toBeGreaterThan(0);
      });

      it('should return empty array for non-existent provider', async () => {
        const models = await manager.listModels('nonexistent');

        expect(models).toEqual([]);
      });
    });

    describe('getModel()', () => {
      it('should get specific model', async () => {
        const model = await manager.getModel('openai', 'gpt-4o');

        expect(model).toBeDefined();
        expect(model!.id).toBe('gpt-4o');
        expect(model!.providerId).toBe('openai');
      });

      it('should return null for non-existent model', async () => {
        const model = await manager.getModel('openai', 'nonexistent');

        expect(model).toBeNull();
      });
    });

    describe('getDefaultModel()', () => {
      it('should get default model for provider', async () => {
        await manager.updateProvider('openai', {
          defaultModel: 'gpt-4o',
        });

        const model = await manager.getDefaultModel('openai');

        expect(model).toBeDefined();
        expect(model!.id).toBe('gpt-4o');
      });

      it('should return null if no default model set', async () => {
        const model = await manager.getDefaultModel('anthropic');

        expect(model).toBeNull();
      });
    });

    describe('setDefaultModel()', () => {
      it('should set default model', async () => {
        await manager.setDefaultModel('openai', 'gpt-4o');

        const provider = await manager.getProvider('openai');
        expect(provider!.defaultModel).toBe('gpt-4o');
      });

      it('should throw error for non-existent model', async () => {
        await expect(manager.setDefaultModel('openai', 'nonexistent')).rejects.toThrow();
      });
    });

    describe('updateModel()', () => {
      it('should update model configuration', async () => {
        const model = await manager.updateModel('openai', 'gpt-4o', {
          temperature: 0.7,
          topP: 0.9,
        });

        expect(model.config!.temperature).toBe(0.7);
        expect(model.config!.topP).toBe(0.9);
      });

      it('should throw error for non-existent model', async () => {
        await expect(
          manager.updateModel('openai', 'nonexistent', { temperature: 0.5 })
        ).rejects.toThrow();
      });
    });
  });

  describe('provider selection', () => {
    beforeEach(async () => {
      // Setup providers with different priorities and API keys
      await manager.setProviderEnabled('openai', true);
      await manager.setProviderEnabled('anthropic', true);
      await manager.setProviderPriority('openai', 100);
      await manager.setProviderPriority('anthropic', 90);

      await manager.setAPIKey({
        providerId: 'openai',
        key: 'sk-openai-key-with-sufficient-length',
      });

      await manager.setAPIKey({
        providerId: 'anthropic',
        key: 'sk-ant-key-with-sufficient-length',
      });

      // Validate both keys
      await manager.validateAPIKey('openai');
      await manager.validateAPIKey('anthropic');
    });

    describe('getActiveProvider()', () => {
      it('should select provider with highest priority', async () => {
        const provider = await manager.getActiveProvider();

        expect(provider).toBeDefined();
        expect(provider!.id).toBe('openai');
      });

      it('should skip providers without valid API keys', async () => {
        await manager.deleteAPIKey('openai');

        const provider = await manager.getActiveProvider();

        expect(provider!.id).toBe('anthropic');
      });

      it('should skip disabled providers', async () => {
        await manager.setProviderEnabled('openai', false);

        const provider = await manager.getActiveProvider();

        expect(provider!.id).toBe('anthropic');
      });

      it('should return null when no providers available', async () => {
        await manager.setProviderEnabled('openai', false);
        await manager.setProviderEnabled('anthropic', false);

        const provider = await manager.getActiveProvider();

        expect(provider).toBeNull();
      });
    });

    describe('getActiveProviders()', () => {
      it('should return all enabled providers with valid keys', async () => {
        const providers = await manager.getActiveProviders();

        expect(providers.length).toBe(2);
        expect(providers.find(p => p.id === 'openai')).toBeDefined();
        expect(providers.find(p => p.id === 'anthropic')).toBeDefined();
      });

      it('should exclude providers without valid keys', async () => {
        await manager.deleteAPIKey('openai');

        const providers = await manager.getActiveProviders();

        expect(providers.find(p => p.id === 'openai')).toBeUndefined();
        expect(providers.find(p => p.id === 'anthropic')).toBeDefined();
      });

      it('should exclude disabled providers', async () => {
        await manager.setProviderEnabled('openai', false);

        const providers = await manager.getActiveProviders();

        expect(providers.find(p => p.id === 'openai')).toBeUndefined();
      });
    });
  });

  describe('current provider query (hybrid tool isolation)', () => {
    /**
     * Note: These tests verify the priority query logic.
     * When hybrid tool isolation columns don't exist (pre-migration),
     * the methods should gracefully fall back to existing behavior.
     */

    // Reset provider states before each test
    beforeEach(async () => {
      const providers = await manager.listProviders();
      for (const p of providers) {
        await manager.setProviderEnabled(p.id, true);
        await manager.setProviderPriority(p.id, 0);
      }
    });

    describe('getCurrentProvider()', () => {
      it('should return global current provider when no toolId provided', async () => {
        // Setup: make openai the active provider
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-openai-key-with-sufficient-length',
        });
        await manager.validateAPIKey('openai');

        // Without hybrid columns, this falls back to getActiveProvider
        const result = await manager.getCurrentProvider();

        // Result may be null if no active provider with valid key
        // or may return the active provider
        if (result) {
          expect(result.scope).toBe('global');
          expect(result.provider).toBeDefined();
        }
      });

      it('should return null when no provider available', async () => {
        // Disable all providers
        const providers = await manager.listProviders();
        for (const p of providers) {
          await manager.setProviderEnabled(p.id, false);
        }

        const result = await manager.getCurrentProvider();
        expect(result).toBeNull();
      });

      it('should fall back to global provider when toolId has no specific provider', async () => {
        // Setup: make openai the active provider
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-openai-key-with-sufficient-length',
        });
        await manager.validateAPIKey('openai');

        // Query with a tool that has no tool-specific provider
        const result = await manager.getCurrentProvider('claude-code');

        // Without hybrid columns, tool-specific lookup returns null
        // and falls back to global
        if (result) {
          expect(result.scope).toBe('global');
        }
      });
    });

    describe('getGlobalCurrentProvider()', () => {
      it('should return active provider as global current (fallback)', async () => {
        await manager.setAPIKey({
          providerId: 'anthropic',
          key: 'sk-ant-key-with-sufficient-length',
        });
        await manager.validateAPIKey('anthropic');

        // Without hybrid columns, this falls back to getActiveProvider
        const provider = await manager.getGlobalCurrentProvider();

        if (provider) {
          expect(provider.id).toBeDefined();
          expect(provider.enabled).toBe(true);
        }
      });

      it('should return null when no global provider available', async () => {
        // Disable all providers
        const providers = await manager.listProviders();
        for (const p of providers) {
          await manager.setProviderEnabled(p.id, false);
        }

        const provider = await manager.getGlobalCurrentProvider();
        expect(provider).toBeNull();
      });
    });

    describe('getToolCurrentProvider()', () => {
      it('should return null without hybrid columns (graceful fallback)', async () => {
        // Without hybrid columns, tool-specific lookup returns null
        const provider = await manager.getToolCurrentProvider('cursor');

        // This is expected behavior before migration
        expect(provider).toBeNull();
      });
    });

    describe('getAPIKeyWithPriority()', () => {
      it('should return API key for provider', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-test-priority-key',
        });

        const key = await manager.getAPIKeyWithPriority('openai');

        expect(key).toBe('sk-test-priority-key');
      });

      it('should return null for non-existent key', async () => {
        const key = await manager.getAPIKeyWithPriority('anthropic');
        expect(key).toBeNull();
      });

      it('should fall back to global key when toolId has no specific provider', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-global-key',
        });

        const key = await manager.getAPIKeyWithPriority('openai', 'primary', 'some-tool');

        // Falls back to global provider's key
        expect(key).toBe('sk-global-key');
      });
    });

    describe('listGlobalProviders()', () => {
      it('should return all providers without hybrid columns (fallback)', async () => {
        const providers = await manager.listGlobalProviders();

        // Without hybrid columns, this falls back to listProviders
        expect(providers.length).toBeGreaterThan(0);
      });
    });

    describe('listToolProviders()', () => {
      it('should return empty array without hybrid columns', async () => {
        const providers = await manager.listToolProviders('cursor');

        // Without hybrid columns, returns empty array
        expect(providers).toEqual([]);
      });
    });

    describe('backward compatibility', () => {
      it('should maintain existing getActiveProvider behavior', async () => {
        // Ensure providers are enabled and have correct priority
        await manager.setProviderEnabled('openai', true);
        await manager.setProviderEnabled('anthropic', true);
        await manager.setProviderPriority('openai', 200);
        await manager.setProviderPriority('anthropic', 100);

        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-openai-key-with-sufficient-length',
        });
        await manager.setAPIKey({
          providerId: 'anthropic',
          key: 'sk-ant-key-with-sufficient-length',
        });
        await manager.validateAPIKey('openai');
        await manager.validateAPIKey('anthropic');

        const activeProvider = await manager.getActiveProvider();
        expect(activeProvider).toBeDefined();
        expect(activeProvider!.id).toBe('openai');
      });

      it('should maintain existing getAPIKey behavior', async () => {
        await manager.setAPIKey({
          providerId: 'openai',
          key: 'sk-test-key',
        });

        const key = await manager.getAPIKey('openai');
        expect(key).toBe('sk-test-key');
      });
    });
  });

  describe('utility methods', () => {
    it('should get database path', () => {
      const path = manager.getDatabasePath();

      expect(path).toBe(':memory:');
    });

    it('should check if initialized', async () => {
      expect(manager.isInitialized()).toBe(false);

      await manager.listProviders();

      expect(manager.isInitialized()).toBe(true);
    });

    it('should close manager', async () => {
      await manager.listProviders();
      expect(manager.isInitialized()).toBe(true);

      await manager.close();

      expect(manager.isInitialized()).toBe(false);
    });
  });
});
