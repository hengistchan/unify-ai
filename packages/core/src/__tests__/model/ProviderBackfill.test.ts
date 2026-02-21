/**
 * Tests for Provider Backfill Mechanism
 *
 * Tests backup, restore, and switch with backfill functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelManager } from '../../model/ModelManager';
import type { ProviderBackup, SwitchProviderResult } from '../../model/types';

describe('Provider Backfill Mechanism', () => {
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

  describe('backupProviderConfig()', () => {
    it('should return null when no current provider exists', async () => {
      // Disable all providers first
      const providers = await manager.listProviders();
      for (const p of providers) {
        await manager.setProviderEnabled(p.id, false);
      }

      const backup = await manager.backupProviderConfig('openai', 'global');

      expect(backup).toBeNull();
    });

    it('should create backup with previous provider info', async () => {
      // Set openai as global default
      await manager.setGlobalDefaultProvider('openai');

      // Create backup before switching to anthropic
      const backup = await manager.backupProviderConfig('anthropic', 'global');

      expect(backup).not.toBeNull();
      expect(backup!.previousProviderId).toBe('openai');
      expect(backup!.previousScope).toBe('global');
      expect(backup!.backupTimestamp).toBeDefined();
    });

    it('should store backup in the new provider\'s meta field', async () => {
      await manager.setGlobalDefaultProvider('openai');

      await manager.backupProviderConfig('anthropic', 'global');

      // Verify backup is stored in anthropic's meta
      const storedBackup = await manager.getProviderBackup('anthropic', 'global');

      expect(storedBackup).not.toBeNull();
      expect(storedBackup!.previousProviderId).toBe('openai');
    });

    it('should handle tool-specific provider backup', async () => {
      // Create a tool-specific provider
      await manager.createToolProvider('cursor', {
        id: 'openai',
        name: 'OpenAI for Cursor',
        type: 'openai-compatible',
      });

      await manager.setToolOverrideProvider('cursor', 'openai');

      const backup = await manager.backupProviderConfig('anthropic', 'cursor');

      expect(backup).not.toBeNull();
      expect(backup!.previousScope).toBe('tool-specific');
      expect(backup!.previousToolId).toBe('cursor');
    });
  });

  describe('restoreProviderConfig()', () => {
    it('should return false when no backup exists', async () => {
      const restored = await manager.restoreProviderConfig('openai', 'global');

      expect(restored).toBe(false);
    });

    it('should restore previous global default provider', async () => {
      // Setup: openai is current, backup for switching to anthropic
      await manager.setGlobalDefaultProvider('openai');
      await manager.backupProviderConfig('anthropic', 'global');

      // Switch to anthropic
      await manager.setGlobalDefaultProvider('anthropic');

      // Restore should switch back to openai
      const restored = await manager.restoreProviderConfig('anthropic', 'global');

      expect(restored).toBe(true);

      const currentGlobal = await manager.getGlobalCurrentProvider();
      // After restoration, it should be openai again
      expect(currentGlobal?.id).toBe('openai');
    });

    it('should clear backup after restoration', async () => {
      await manager.setGlobalDefaultProvider('openai');
      await manager.backupProviderConfig('anthropic', 'global');

      await manager.restoreProviderConfig('anthropic', 'global');

      // Backup should be cleared
      const backup = await manager.getProviderBackup('anthropic', 'global');
      expect(backup).toBeNull();
    });

    it('should restore tool-specific provider', async () => {
      // Create tool-specific providers
      await manager.createToolProvider('cursor', {
        id: 'openai',
        name: 'OpenAI for Cursor',
        type: 'openai-compatible',
      });

      await manager.createToolProvider('cursor', {
        id: 'anthropic',
        name: 'Anthropic for Cursor',
        type: 'anthropic',
      });

      // Set openai as current for cursor
      await manager.setToolOverrideProvider('cursor', 'openai');

      // Create backup
      await manager.backupProviderConfig('anthropic', 'cursor');

      // Switch to anthropic
      await manager.setToolOverrideProvider('cursor', 'anthropic');

      // Restore
      const restored = await manager.restoreProviderConfig('anthropic', 'cursor');

      expect(restored).toBe(true);

      const currentTool = await manager.getToolCurrentProvider('cursor');
      expect(currentTool?.id).toBe('openai');
    });
  });

  describe('clearBackupConfig()', () => {
    it('should remove backup from provider meta', async () => {
      await manager.setGlobalDefaultProvider('openai');
      await manager.backupProviderConfig('anthropic', 'global');

      await manager.clearBackupConfig('anthropic', 'global');

      const backup = await manager.getProviderBackup('anthropic', 'global');
      expect(backup).toBeNull();
    });

    it('should not throw when provider does not exist', async () => {
      await expect(
        manager.clearBackupConfig('nonexistent', 'global')
      ).resolves.not.toThrow();
    });
  });

  describe('getProviderBackup()', () => {
    it('should return null when no backup exists', async () => {
      const backup = await manager.getProviderBackup('openai', 'global');
      expect(backup).toBeNull();
    });

    it('should return backup data when it exists', async () => {
      await manager.setGlobalDefaultProvider('openai');
      await manager.backupProviderConfig('anthropic', 'global');

      const backup = await manager.getProviderBackup('anthropic', 'global');

      expect(backup).not.toBeNull();
      expect(backup!.previousProviderId).toBe('openai');
      expect(backup!.previousConfig).toBeDefined();
      expect(backup!.backupTimestamp).toBeDefined();
    });
  });

  describe('switchProviderWithBackfill()', () => {
    it('should successfully switch provider without validation', async () => {
      await manager.setGlobalDefaultProvider('openai');

      const result = await manager.switchProviderWithBackfill('anthropic');

      expect(result.success).toBe(true);
      expect(result.newProvider?.id).toBe('anthropic');
      expect(result.error).toBeUndefined();
    });

    it('should create and clear backup on successful switch', async () => {
      await manager.setGlobalDefaultProvider('openai');

      const result = await manager.switchProviderWithBackfill('anthropic');

      expect(result.backupCreated).toBe(true);
      expect(result.backupRestored).toBe(false);

      // Backup should be cleared after success
      const backup = await manager.getProviderBackup('anthropic', 'global');
      expect(backup).toBeNull();
    });

    it('should restore backup when validation fails', async () => {
      await manager.setGlobalDefaultProvider('openai');

      const result = await manager.switchProviderWithBackfill('anthropic', {
        validateSwitch: async () => false, // Validation fails
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Switch validation failed');
      expect(result.backupCreated).toBe(true);
      expect(result.backupRestored).toBe(true);

      // Should have restored to openai
      const currentGlobal = await manager.getGlobalCurrentProvider();
      expect(currentGlobal?.id).toBe('openai');
    });

    it('should not restore when no backup was created', async () => {
      // Disable all providers so no current provider exists
      const providers = await manager.listProviders();
      for (const p of providers) {
        await manager.setProviderEnabled(p.id, false);
      }

      const result = await manager.switchProviderWithBackfill('anthropic');

      expect(result.backupCreated).toBe(false);
      expect(result.backupRestored).toBe(false);
    });

    it('should restore on exception during switch', async () => {
      await manager.setGlobalDefaultProvider('openai');

      // Create backup first
      await manager.backupProviderConfig('anthropic', 'global');

      // Now try to switch to a nonexistent provider
      const result = await manager.switchProviderWithBackfill('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle tool-specific switch', async () => {
      // Create tool-specific providers
      await manager.createToolProvider('cursor', {
        id: 'openai',
        name: 'OpenAI for Cursor',
        type: 'openai-compatible',
      });

      await manager.createToolProvider('cursor', {
        id: 'anthropic',
        name: 'Anthropic for Cursor',
        type: 'anthropic',
      });

      await manager.setToolOverrideProvider('cursor', 'openai');

      const result = await manager.switchProviderWithBackfill('anthropic', {
        toolId: 'cursor',
      });

      expect(result.success).toBe(true);
      expect(result.newProvider?.id).toBe('anthropic');

      const currentTool = await manager.getToolCurrentProvider('cursor');
      expect(currentTool?.id).toBe('anthropic');
    });

    it('should validate new provider and clear backup on success', async () => {
      await manager.setGlobalDefaultProvider('openai');

      let validatedProvider: string | undefined;

      const result = await manager.switchProviderWithBackfill('anthropic', {
        validateSwitch: async (provider) => {
          validatedProvider = provider.id;
          return true;
        },
      });

      expect(result.success).toBe(true);
      expect(validatedProvider).toBe('anthropic');

      // Backup should be cleared
      const backup = await manager.getProviderBackup('anthropic', 'global');
      expect(backup).toBeNull();
    });

    it('should restore and return validation error', async () => {
      await manager.setGlobalDefaultProvider('openai');

      const result = await manager.switchProviderWithBackfill('anthropic', {
        validateSwitch: async () => {
          throw new Error('Custom validation error');
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Custom validation error');
      expect(result.backupRestored).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle switching to the same provider', async () => {
      await manager.setGlobalDefaultProvider('openai');

      const result = await manager.switchProviderWithBackfill('openai');

      // Should succeed (already the current provider)
      expect(result.success).toBe(true);
    });

    it('should handle multiple consecutive switches', async () => {
      await manager.setGlobalDefaultProvider('openai');

      // First switch: openai -> anthropic
      const result1 = await manager.switchProviderWithBackfill('anthropic');
      expect(result1.success).toBe(true);

      // Second switch: anthropic -> openai
      const result2 = await manager.switchProviderWithBackfill('openai');
      expect(result2.success).toBe(true);

      const current = await manager.getGlobalCurrentProvider();
      expect(current?.id).toBe('openai');
    });

    it('should preserve provider config during backup and restore', async () => {
      // Set custom config for openai
      await manager.updateProvider('openai', {
        config: {
          timeout: 5000,
          maxRetries: 3,
          customHeaders: { 'X-Custom': 'value' },
        },
      });

      await manager.setGlobalDefaultProvider('openai');

      // Create backup
      const backup = await manager.backupProviderConfig('anthropic', 'global');

      expect(backup!.previousConfig).toEqual({
        timeout: 5000,
        maxRetries: 3,
        customHeaders: { 'X-Custom': 'value' },
      });
    });
  });
});
