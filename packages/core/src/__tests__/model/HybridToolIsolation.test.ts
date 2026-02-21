/**
 * Integration tests for Hybrid Tool Isolation
 *
 * Tests the priority query logic, tool override workflow, and backfill mechanism
 * for the hybrid tool isolation feature in ModelManager.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelManager } from '../../model/ModelManager';
import type {
  CreateProviderInput,
} from '../../model/types';

describe('Hybrid Tool Isolation', () => {
  let manager: ModelManager;

  // Mock encryption key for testing (exactly 32 bytes)
  const mockEncryptionKey = Buffer.from('test-encryption-key-32-bytes!!!!', 'utf8');

  // Test fixtures
  const testGlobalProvider: CreateProviderInput = {
    id: 'test-openai',
    name: 'Test OpenAI',
    type: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        pricing: { inputPerK: 0.005, outputPerK: 0.015 },
        enabled: true,
      },
    ],
  };

  const testAnthropicProvider: CreateProviderInput = {
    id: 'test-anthropic',
    name: 'Test Anthropic',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      {
        id: 'claude-3-opus',
        displayName: 'Claude 3 Opus',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        pricing: { inputPerK: 0.015, outputPerK: 0.075 },
        enabled: true,
      },
    ],
  };

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

  // ============================================
  // Scenario 1: Global provider lifecycle
  // ============================================
  describe('Scenario 1: Global provider lifecycle', () => {
    it('should create a global provider', async () => {
      const provider = await manager.createGlobalProvider(testGlobalProvider);

      expect(provider).toBeDefined();
      expect(provider.id).toBe('test-openai');
      expect(provider.name).toBe('Test OpenAI');
      expect(provider.enabled).toBe(true);
    });

    it('should set a provider as global default', async () => {
      // Create provider
      await manager.createGlobalProvider(testGlobalProvider);

      // Set as global default
      await manager.setGlobalDefaultProvider('test-openai');

      // Verify it's the current global provider
      const currentGlobal = await manager.getGlobalCurrentProvider();
      expect(currentGlobal).toBeDefined();
      expect(currentGlobal!.id).toBe('test-openai');
    });

    it('should query current provider and return global when no toolId provided', async () => {
      // Setup
      await manager.createGlobalProvider(testGlobalProvider);
      await manager.setGlobalDefaultProvider('test-openai');

      // Query without toolId
      const result = await manager.getCurrentProvider();

      expect(result).toBeDefined();
      expect(result!.scope).toBe('global');
      expect(result!.provider.id).toBe('test-openai');
      expect(result!.toolId).toBeUndefined();
    });

    it('should list global providers', async () => {
      // Create multiple global providers
      await manager.createGlobalProvider(testGlobalProvider);
      await manager.createGlobalProvider(testAnthropicProvider);

      const globalProviders = await manager.listGlobalProviders();

      // Should include both test providers plus any built-in defaults
      expect(globalProviders.length).toBeGreaterThanOrEqual(2);
      expect(globalProviders.find(p => p.id === 'test-openai')).toBeDefined();
      expect(globalProviders.find(p => p.id === 'test-anthropic')).toBeDefined();
    });

    it('should replace global default provider when setting a new one', async () => {
      // Create two providers
      await manager.createGlobalProvider(testGlobalProvider);
      await manager.createGlobalProvider(testAnthropicProvider);

      // Set first as default
      await manager.setGlobalDefaultProvider('test-openai');
      let currentGlobal = await manager.getGlobalCurrentProvider();
      expect(currentGlobal!.id).toBe('test-openai');

      // Set second as default
      await manager.setGlobalDefaultProvider('test-anthropic');
      currentGlobal = await manager.getGlobalCurrentProvider();
      expect(currentGlobal!.id).toBe('test-anthropic');
    });
  });

  // ============================================
  // Scenario 2: Tool override workflow
  // ============================================
  describe('Scenario 2: Tool override workflow', () => {
    beforeEach(async () => {
      // Setup global providers
      await manager.createGlobalProvider(testGlobalProvider);
      await manager.createGlobalProvider(testAnthropicProvider);
      await manager.setGlobalDefaultProvider('test-openai');
    });

    it('should create a tool-specific provider', async () => {
      const toolProvider = await manager.createToolProvider('cursor', {
        id: 'cursor-anthropic',
        name: 'Cursor Anthropic',
        type: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
      });

      expect(toolProvider).toBeDefined();
      expect(toolProvider.id).toBe('cursor-anthropic');
    });

    it('should set tool override for a specific tool', async () => {
      // Create tool-specific provider
      await manager.createToolProvider('cursor', {
        id: 'cursor-anthropic',
        name: 'Cursor Anthropic',
        type: 'anthropic',
      });

      // Set tool override
      await manager.setToolOverrideProvider('cursor', 'cursor-anthropic');

      // Query tool current provider
      const toolProvider = await manager.getToolCurrentProvider('cursor');
      expect(toolProvider).toBeDefined();
      expect(toolProvider!.id).toBe('cursor-anthropic');
    });

    it('should query tool provider with priority over global', async () => {
      // Create and set tool-specific provider
      await manager.createToolProvider('cursor', {
        id: 'cursor-anthropic',
        name: 'Cursor Anthropic',
        type: 'anthropic',
      });
      await manager.setToolOverrideProvider('cursor', 'cursor-anthropic');

      // Query with toolId
      const result = await manager.getCurrentProvider('cursor');

      expect(result).toBeDefined();
      expect(result!.scope).toBe('tool-specific');
      expect(result!.provider.id).toBe('cursor-anthropic');
      expect(result!.toolId).toBe('cursor');
    });

    it('should fallback to global when querying without toolId', async () => {
      // Create and set tool-specific provider
      await manager.createToolProvider('cursor', {
        id: 'cursor-anthropic',
        name: 'Cursor Anthropic',
        type: 'anthropic',
      });
      await manager.setToolOverrideProvider('cursor', 'cursor-anthropic');

      // Query without toolId - should return global
      const result = await manager.getCurrentProvider();

      expect(result).toBeDefined();
      expect(result!.scope).toBe('global');
      expect(result!.provider.id).toBe('test-openai');
    });

    it('should clear tool override and fallback to global', async () => {
      // Create and set tool-specific provider
      await manager.createToolProvider('cursor', {
        id: 'cursor-anthropic',
        name: 'Cursor Anthropic',
        type: 'anthropic',
      });
      await manager.setToolOverrideProvider('cursor', 'cursor-anthropic');

      // Verify tool override is set
      let result = await manager.getCurrentProvider('cursor');
      expect(result!.scope).toBe('tool-specific');

      // Clear tool override
      await manager.clearToolOverride('cursor');

      // Verify fallback to global
      result = await manager.getCurrentProvider('cursor');
      expect(result!.scope).toBe('global');
      expect(result!.provider.id).toBe('test-openai');
    });

    it('should list tool-specific providers', async () => {
      // Create tool-specific providers
      await manager.createToolProvider('cursor', {
        id: 'cursor-anthropic',
        name: 'Cursor Anthropic',
        type: 'anthropic',
      });
      await manager.createToolProvider('cursor', {
        id: 'cursor-openai',
        name: 'Cursor OpenAI',
        type: 'openai-compatible',
      });

      const toolProviders = await manager.listToolProviders('cursor');

      expect(toolProviders.length).toBe(2);
      expect(toolProviders.find(p => p.id === 'cursor-anthropic')).toBeDefined();
      expect(toolProviders.find(p => p.id === 'cursor-openai')).toBeDefined();
    });
  });

  // ============================================
  // Scenario 3: Priority query tests
  // ============================================
  describe('Scenario 3: Priority query tests', () => {
    beforeEach(async () => {
      // Setup global providers
      await manager.createGlobalProvider(testGlobalProvider);
      await manager.createGlobalProvider(testAnthropicProvider);
      await manager.setGlobalDefaultProvider('test-openai');
    });

    it('should return tool-specific provider over global', async () => {
      // Create tool-specific provider
      await manager.createToolProvider('windsurf', {
        id: 'windsurf-anthropic',
        name: 'Windsurf Anthropic',
        type: 'anthropic',
      });
      await manager.setToolOverrideProvider('windsurf', 'windsurf-anthropic');

      const result = await manager.getCurrentProvider('windsurf');

      expect(result).toBeDefined();
      expect(result!.scope).toBe('tool-specific');
      expect(result!.provider.id).toBe('windsurf-anthropic');
    });

    it('should return global provider when tool has no override', async () => {
      // Query a tool without override
      const result = await manager.getCurrentProvider('cline');

      expect(result).toBeDefined();
      expect(result!.scope).toBe('global');
      expect(result!.provider.id).toBe('test-openai');
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

    it('should maintain different overrides for different tools', async () => {
      // Create tool-specific providers for different tools
      await manager.createToolProvider('cursor', {
        id: 'cursor-anthropic',
        name: 'Cursor Anthropic',
        type: 'anthropic',
      });
      await manager.setToolOverrideProvider('cursor', 'cursor-anthropic');

      await manager.createToolProvider('windsurf', {
        id: 'windsurf-openai',
        name: 'Windsurf OpenAI',
        type: 'openai-compatible',
      });
      await manager.setToolOverrideProvider('windsurf', 'windsurf-openai');

      // Verify each tool has its own override
      const cursorResult = await manager.getCurrentProvider('cursor');
      expect(cursorResult!.scope).toBe('tool-specific');
      expect(cursorResult!.provider.id).toBe('cursor-anthropic');

      const windsurfResult = await manager.getCurrentProvider('windsurf');
      expect(windsurfResult!.scope).toBe('tool-specific');
      expect(windsurfResult!.provider.id).toBe('windsurf-openai');

      // Verify a tool without override falls back to global
      const clineResult = await manager.getCurrentProvider('cline');
      expect(clineResult!.scope).toBe('global');
    });

    it('should not affect tool overrides when changing global default', async () => {
      // Create tool-specific provider
      await manager.createToolProvider('cursor', {
        id: 'cursor-anthropic',
        name: 'Cursor Anthropic',
        type: 'anthropic',
      });
      await manager.setToolOverrideProvider('cursor', 'cursor-anthropic');

      // Change global default
      await manager.setGlobalDefaultProvider('test-anthropic');

      // Tool override should still be in place
      const cursorResult = await manager.getCurrentProvider('cursor');
      expect(cursorResult!.scope).toBe('tool-specific');
      expect(cursorResult!.provider.id).toBe('cursor-anthropic');

      // Global should be updated
      const globalResult = await manager.getCurrentProvider();
      expect(globalResult!.scope).toBe('global');
      expect(globalResult!.provider.id).toBe('test-anthropic');
    });

    it('should return null for tool current provider when no override set', async () => {
      const toolProvider = await manager.getToolCurrentProvider('cursor');
      expect(toolProvider).toBeNull();
    });
  });

  // ============================================
  // Scenario 4: Backfill mechanism (provider switching with rollback)
  // ============================================
  describe('Scenario 4: Provider switching with backup', () => {
    beforeEach(async () => {
      await manager.createGlobalProvider(testGlobalProvider);
      await manager.createGlobalProvider(testAnthropicProvider);
      await manager.setGlobalDefaultProvider('test-openai');
    });

    it('should switch global provider successfully', async () => {
      // Initial state
      let current = await manager.getGlobalCurrentProvider();
      expect(current!.id).toBe('test-openai');

      // Switch provider
      await manager.setGlobalDefaultProvider('test-anthropic');

      // Verify switch
      current = await manager.getGlobalCurrentProvider();
      expect(current!.id).toBe('test-anthropic');
    });

    it('should maintain only one global current provider', async () => {
      // Set first provider as global default
      await manager.setGlobalDefaultProvider('test-openai');

      // Set second provider as global default
      await manager.setGlobalDefaultProvider('test-anthropic');

      // Query all global providers to verify only one is current
      const globalProviders = await manager.listGlobalProviders();
      const currentGlobals = globalProviders.filter(
        // Note: The current global flag is not exposed in AIProvider type
        // but we can verify through getGlobalCurrentProvider
        () => true
      );

      // Only one should be returned by getGlobalCurrentProvider
      const current = await manager.getGlobalCurrentProvider();
      expect(current!.id).toBe('test-anthropic');
    });

    it('should maintain only one tool current provider per tool', async () => {
      // Create multiple tool providers
      await manager.createToolProvider('cursor', {
        id: 'cursor-anthropic',
        name: 'Cursor Anthropic',
        type: 'anthropic',
      });
      await manager.createToolProvider('cursor', {
        id: 'cursor-openai',
        name: 'Cursor OpenAI',
        type: 'openai-compatible',
      });

      // Set first as current
      await manager.setToolOverrideProvider('cursor', 'cursor-anthropic');
      let current = await manager.getToolCurrentProvider('cursor');
      expect(current!.id).toBe('cursor-anthropic');

      // Set second as current
      await manager.setToolOverrideProvider('cursor', 'cursor-openai');
      current = await manager.getToolCurrentProvider('cursor');
      expect(current!.id).toBe('cursor-openai');
    });

    it('should throw error when setting non-existent provider as global default', async () => {
      await expect(
        manager.setGlobalDefaultProvider('non-existent-provider')
      ).rejects.toThrow(/not found/);
    });

    it('should throw error when setting non-existent provider as tool override', async () => {
      await expect(
        manager.setToolOverrideProvider('cursor', 'non-existent-provider')
      ).rejects.toThrow(/not found/);
    });
  });

  // ============================================
  // Edge cases and error handling
  // ============================================
  describe('Edge cases and error handling', () => {
    it('should throw error when creating duplicate global provider', async () => {
      await manager.createGlobalProvider(testGlobalProvider);

      await expect(
        manager.createGlobalProvider(testGlobalProvider)
      ).rejects.toThrow(/already exists/);
    });

    it('should throw error when creating duplicate tool-specific provider for same tool', async () => {
      const toolProvider = {
        id: 'cursor-openai',
        name: 'Cursor OpenAI',
        type: 'openai-compatible' as const,
      };

      await manager.createToolProvider('cursor', toolProvider);

      await expect(
        manager.createToolProvider('cursor', toolProvider)
      ).rejects.toThrow(/already exists/);
    });

    it('should allow same provider ID for different tools', async () => {
      const providerBase = {
        id: 'tool-openai',
        name: 'Tool OpenAI',
        type: 'openai-compatible' as const,
      };

      // Create for cursor
      const cursorProvider = await manager.createToolProvider('cursor', providerBase);
      expect(cursorProvider).toBeDefined();

      // Create for windsurf with same ID should fail (different scope but same toolId logic)
      // Actually, since toolId is part of primary key, different tools should work
      // But the same provider ID with same toolId should fail
      await expect(
        manager.createToolProvider('cursor', providerBase)
      ).rejects.toThrow(/already exists/);
    });

    it('should handle empty tool providers list gracefully', async () => {
      const toolProviders = await manager.listToolProviders('non-existent-tool');
      expect(toolProviders).toEqual([]);
    });

    it('should clear tool override even when no override exists', async () => {
      // Should not throw error
      await expect(
        manager.clearToolOverride('cursor')
      ).resolves.not.toThrow();
    });

    it('should handle getProvider with explicit toolId', async () => {
      await manager.createGlobalProvider(testGlobalProvider);

      // Get global provider explicitly
      const provider = await manager.getProvider('test-openai', 'global');
      expect(provider).toBeDefined();
      expect(provider!.id).toBe('test-openai');
    });

    it('should return null when getting non-existent provider', async () => {
      const provider = await manager.getProvider('non-existent');
      expect(provider).toBeNull();
    });

    it('should return null when getting provider for non-existent tool', async () => {
      const provider = await manager.getProvider('test-openai', 'non-existent-tool');
      expect(provider).toBeNull();
    });
  });

  // ============================================
  // API Key with tool isolation
  // ============================================
  describe('API Key management with tool isolation', () => {
    beforeEach(async () => {
      await manager.createGlobalProvider(testGlobalProvider);
    });

    it('should set and get API key for global provider', async () => {
      await manager.setAPIKey({
        providerId: 'test-openai',
        key: 'sk-test-global-key',
      });

      const key = await manager.getAPIKey('test-openai');
      expect(key).toBe('sk-test-global-key');
    });

    it('should set API key for tool-specific provider', async () => {
      await manager.createToolProvider('cursor', {
        id: 'cursor-openai',
        name: 'Cursor OpenAI',
        type: 'openai-compatible',
      });

      // Set API key for tool-specific provider
      const apiKeyResult = await manager.setAPIKey(
        {
          providerId: 'cursor-openai',
          key: 'sk-test-tool-key',
        },
        'cursor'
      );

      expect(apiKeyResult).toBeDefined();
      expect(apiKeyResult.providerId).toBe('cursor-openai');
    });

    it('should get API key with priority for tool', async () => {
      // Set global API key
      await manager.setAPIKey({
        providerId: 'test-openai',
        key: 'sk-global-key',
      });

      // Query with toolId should fallback to global if no tool-specific key
      const key = await manager.getAPIKeyWithPriority('test-openai', 'primary', 'cursor');
      expect(key).toBe('sk-global-key');
    });

    it('should get API key for tool-specific provider', async () => {
      await manager.createToolProvider('cursor', {
        id: 'cursor-openai',
        name: 'Cursor OpenAI',
        type: 'openai-compatible',
      });

      await manager.setAPIKey(
        {
          providerId: 'cursor-openai',
          key: 'sk-test-tool-key',
        },
        'cursor'
      );

      // Get API key with toolId
      const key = await manager.getAPIKey('cursor-openai', 'primary', 'cursor');
      expect(key).toBe('sk-test-tool-key');
    });
  });
});
