/**
 * EncryptionManager Unit Tests
 * Tests encryption/decryption functionality and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EncryptionManager } from '../../model/EncryptionManager';
import type { EncryptedKeyData } from '../../model/types';
import * as crypto from 'crypto';

describe('EncryptionManager', () => {
  let manager: EncryptionManager;

  beforeEach(() => {
    manager = new EncryptionManager();
  });

  describe('constructor', () => {
    it('should create instance without Electron safeStorage', () => {
      // In test environment, Electron's safeStorage should not be available
      const mgr = new EncryptionManager();
      expect(mgr).toBeDefined();
    });

    it('should detect encryption availability', () => {
      expect(manager.isEncryptionAvailable()).toBe(true);
    });
  });

  describe('isEncryptionAvailable', () => {
    it('should return true in fallback mode', () => {
      expect(manager.isEncryptionAvailable()).toBe(true);
    });
  });

  describe('encrypt/decrypt roundtrip', () => {
    it('should encrypt and decrypt a plaintext string', async () => {
      const plaintext = 'sk-test-api-key-12345';

      const encrypted = await manager.encrypt(plaintext);
      const decrypted = await manager.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different encrypted values for same plaintext', async () => {
      const plaintext = 'test-key';

      const encrypted1 = await manager.encrypt(plaintext);
      const encrypted2 = await manager.encrypt(plaintext);

      // Due to random IV, encrypted values should be different
      expect(encrypted1.encrypted).not.toEqual(encrypted2.encrypted);

      // But both should decrypt to same value
      const decrypted1 = await manager.decrypt(encrypted1);
      const decrypted2 = await manager.decrypt(encrypted2);

      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('should handle empty strings', async () => {
      const plaintext = '';

      await expect(manager.encrypt(plaintext)).rejects.toThrow(
        'Plaintext must be a non-empty string'
      );
    });

    it('should handle various string lengths', async () => {
      const testCases = [
        'a',
        'short',
        'medium-length-api-key-12345',
        'very-long-api-key-with-lots-of-characters-and-numbers-12345678901234567890',
        'unicode-支持-emoji-🔑',
      ];

      for (const plaintext of testCases) {
        const encrypted = await manager.encrypt(plaintext);
        const decrypted = await manager.decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      }
    });

    it('should produce valid EncryptedKeyData structure', async () => {
      const plaintext = 'test-key';

      const encrypted = await manager.encrypt(plaintext);

      expect(encrypted).toHaveProperty('encrypted');
      expect(Buffer.isBuffer(encrypted.encrypted)).toBe(true);

      // In fallback mode, should have iv and authTag
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(Buffer.isBuffer(encrypted.iv)).toBe(true);
      expect(Buffer.isBuffer(encrypted.authTag)).toBe(true);
    });
  });

  describe('encrypt', () => {
    it('should throw error for null input', async () => {
      await expect(manager.encrypt(null as any)).rejects.toThrow(
        'Plaintext must be a non-empty string'
      );
    });

    it('should throw error for undefined input', async () => {
      await expect(manager.encrypt(undefined as any)).rejects.toThrow(
        'Plaintext must be a non-empty string'
      );
    });

    it('should throw error for non-string input', async () => {
      await expect(manager.encrypt(123 as any)).rejects.toThrow(
        'Plaintext must be a non-empty string'
      );
    });

    it('should throw error for empty string', async () => {
      await expect(manager.encrypt('')).rejects.toThrow(
        'Plaintext must be a non-empty string'
      );
    });

    it('should use fallback encryption in non-Electron environment', async () => {
      const plaintext = 'test-key';

      const encrypted = await manager.encrypt(plaintext);

      // Should have iv and authTag in fallback mode
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.iv!.length).toBe(16); // 16-byte IV for GCM
      expect(encrypted.authTag!.length).toBe(16); // 16-byte auth tag for GCM
    });
  });

  describe('decrypt', () => {
    it('should throw error for null input', async () => {
      await expect(manager.decrypt(null as any)).rejects.toThrow(
        'Invalid encrypted data'
      );
    });

    it('should throw error for undefined input', async () => {
      await expect(manager.decrypt(undefined as any)).rejects.toThrow(
        'Invalid encrypted data'
      );
    });

    it('should throw error for missing encrypted buffer', async () => {
      const data = { iv: Buffer.from('test'), authTag: Buffer.from('test') } as any;

      await expect(manager.decrypt(data)).rejects.toThrow(
        'Invalid encrypted data: encrypted buffer is required'
      );
    });

    it('should throw error for missing iv in fallback mode', async () => {
      const data = {
        encrypted: Buffer.from('encrypted'),
        authTag: Buffer.from('tag'),
      } as EncryptedKeyData;

      await expect(manager.decrypt(data)).rejects.toThrow(
        'Invalid encrypted data: iv buffer is required for fallback decryption'
      );
    });

    it('should throw error for missing authTag in fallback mode', async () => {
      const data = {
        encrypted: Buffer.from('encrypted'),
        iv: Buffer.from('iv'),
      } as EncryptedKeyData;

      await expect(manager.decrypt(data)).rejects.toThrow(
        'Invalid encrypted data: authTag buffer is required for fallback decryption'
      );
    });

    it('should throw error for invalid encrypted data', async () => {
      const data: EncryptedKeyData = {
        encrypted: Buffer.from('invalid-encrypted-data'),
        iv: crypto.randomBytes(16),
        authTag: crypto.randomBytes(16),
      };

      await expect(manager.decrypt(data)).rejects.toThrow('Decryption failed');
    });

    it('should throw error for corrupted auth tag', async () => {
      const plaintext = 'test-key';
      const encrypted = await manager.encrypt(plaintext);

      // Corrupt the auth tag
      const corruptedTag = Buffer.from(encrypted.authTag!);
      corruptedTag[0] = corruptedTag[0] ^ 0xff; // Flip bits

      const corruptedData: EncryptedKeyData = {
        ...encrypted,
        authTag: corruptedTag,
      };

      await expect(manager.decrypt(corruptedData)).rejects.toThrow('Decryption failed');
    });

    it('should throw error for corrupted iv', async () => {
      const plaintext = 'test-key';
      const encrypted = await manager.encrypt(plaintext);

      // Corrupt the IV
      const corruptedIv = Buffer.from(encrypted.iv!);
      corruptedIv[0] = corruptedIv[0] ^ 0xff; // Flip bits

      const corruptedData: EncryptedKeyData = {
        ...encrypted,
        iv: corruptedIv,
      };

      await expect(manager.decrypt(corruptedData)).rejects.toThrow('Decryption failed');
    });

    it('should throw error for wrong key', async () => {
      const plaintext = 'test-key';
      const encrypted = await manager.encrypt(plaintext);

      // Create new manager with different key
      const manager2 = new EncryptionManager();
      manager2.setFallbackKey(crypto.randomBytes(32));

      await expect(manager2.decrypt(encrypted)).rejects.toThrow('Decryption failed');
    });
  });

  describe('setFallbackKey', () => {
    it('should accept 32-byte key', () => {
      const key = crypto.randomBytes(32);

      expect(() => manager.setFallbackKey(key)).not.toThrow();
    });

    it('should throw error for non-32-byte key', () => {
      const key16 = crypto.randomBytes(16);
      const key24 = crypto.randomBytes(24);
      const key64 = crypto.randomBytes(64);

      expect(() => manager.setFallbackKey(key16)).toThrow(
        'Encryption key must be 32 bytes for AES-256'
      );
      expect(() => manager.setFallbackKey(key24)).toThrow(
        'Encryption key must be 32 bytes for AES-256'
      );
      expect(() => manager.setFallbackKey(key64)).toThrow(
        'Encryption key must be 32 bytes for AES-256'
      );
    });

    it('should use custom key for encryption', async () => {
      const customKey = crypto.randomBytes(32);
      const manager1 = new EncryptionManager();
      const manager2 = new EncryptionManager();

      manager1.setFallbackKey(customKey);
      manager2.setFallbackKey(customKey);

      const plaintext = 'test-key';
      const encrypted = await manager1.encrypt(plaintext);
      const decrypted = await manager2.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption with different custom key', async () => {
      const key1 = crypto.randomBytes(32);
      const key2 = crypto.randomBytes(32);

      const manager1 = new EncryptionManager();
      const manager2 = new EncryptionManager();

      manager1.setFallbackKey(key1);
      manager2.setFallbackKey(key2);

      const plaintext = 'test-key';
      const encrypted = await manager1.encrypt(plaintext);

      await expect(manager2.decrypt(encrypted)).rejects.toThrow('Decryption failed');
    });
  });

  describe('fallback encryption mode', () => {
    it('should use AES-256-GCM for encryption', async () => {
      const plaintext = 'test-api-key';
      const encrypted = await manager.encrypt(plaintext);

      // AES-GCM produces 16-byte auth tag
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.authTag!.length).toBe(16);

      // IV should be 16 bytes for GCM
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.iv!.length).toBe(16);
    });

    it('should use environment variable for key if set', async () => {
      const originalEnv = process.env.UNIFY_AI_ENCRYPTION_KEY;
      process.env.UNIFY_AI_ENCRYPTION_KEY = 'test-encryption-key-from-env';

      const managerWithEnv = new EncryptionManager();

      const plaintext = 'test-key';
      const encrypted = await managerWithEnv.encrypt(plaintext);
      const decrypted = await managerWithEnv.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);

      process.env.UNIFY_AI_ENCRYPTION_KEY = originalEnv;
    });

    it('should use default key if no env var set', async () => {
      const originalEnv = process.env.UNIFY_AI_ENCRYPTION_KEY;
      delete process.env.UNIFY_AI_ENCRYPTION_KEY;

      const defaultManager = new EncryptionManager();

      const plaintext = 'test-key';
      const encrypted = await defaultManager.encrypt(plaintext);
      const decrypted = await defaultManager.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);

      process.env.UNIFY_AI_ENCRYPTION_KEY = originalEnv;
    });
  });

  describe('security properties', () => {
    it('should produce unique IVs for each encryption', async () => {
      const plaintext = 'test-key';

      const encrypted1 = await manager.encrypt(plaintext);
      const encrypted2 = await manager.encrypt(plaintext);

      // IVs should be different
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
    });

    it('should produce unique ciphertexts for same plaintext', async () => {
      const plaintext = 'test-key';

      const encrypted1 = await manager.encrypt(plaintext);
      const encrypted2 = await manager.encrypt(plaintext);

      // Ciphertexts should be different
      expect(encrypted1.encrypted).not.toEqual(encrypted2.encrypted);
    });

    it('should detect tampering with ciphertext', async () => {
      const plaintext = 'test-key';
      const encrypted = await manager.encrypt(plaintext);

      // Tamper with ciphertext
      const tampered = Buffer.from(encrypted.encrypted);
      tampered[0] = tampered[0] ^ 0xff;

      const tamperedData: EncryptedKeyData = {
        ...encrypted,
        encrypted: tampered,
      };

      await expect(manager.decrypt(tamperedData)).rejects.toThrow('Decryption failed');
    });
  });

  describe('integration with database', () => {
    it('should produce buffers suitable for database storage', async () => {
      const plaintext = 'sk-test-1234567890';
      const encrypted = await manager.encrypt(plaintext);

      // Buffers should be storable as BLOB
      expect(Buffer.isBuffer(encrypted.encrypted)).toBe(true);
      expect(Buffer.isBuffer(encrypted.iv)).toBe(true);
      expect(Buffer.isBuffer(encrypted.authTag)).toBe(true);

      // Should be able to reconstruct from buffers
      const reconstructed: EncryptedKeyData = {
        encrypted: Buffer.from(encrypted.encrypted),
        iv: Buffer.from(encrypted.iv!),
        authTag: Buffer.from(encrypted.authTag!),
      };

      const decrypted = await manager.decrypt(reconstructed);
      expect(decrypted).toBe(plaintext);
    });
  });

  // ============================================
  // Cache Tests
  // ============================================

  describe('API Key Cache', () => {
    describe('getCachedAPIKey', () => {
      it('should return undefined for non-existent cache entry', () => {
        const result = manager.getCachedAPIKey('openai', 'primary');
        expect(result).toBeUndefined();
      });

      it('should return cached value after setting', () => {
        manager.setCachedAPIKey('openai', 'primary', 'sk-test-key');
        const result = manager.getCachedAPIKey('openai', 'primary');
        expect(result).toBe('sk-test-key');
      });

      it('should use default keyName when not specified', () => {
        manager.setCachedAPIKey('anthropic', 'sk-claude-key');
        const result = manager.getCachedAPIKey('anthropic');
        expect(result).toBe('sk-claude-key');
      });
    });

    describe('setCachedAPIKey', () => {
      it('should cache API key with explicit keyName', () => {
        manager.setCachedAPIKey('openai', 'backup', 'sk-backup-key');
        expect(manager.getCachedAPIKey('openai', 'backup')).toBe('sk-backup-key');
      });

      it('should overwrite existing cached value', () => {
        manager.setCachedAPIKey('openai', 'sk-old-key');
        manager.setCachedAPIKey('openai', 'sk-new-key');
        expect(manager.getCachedAPIKey('openai')).toBe('sk-new-key');
      });
    });

    describe('invalidateCachedAPIKey', () => {
      it('should remove specific cached key', () => {
        manager.setCachedAPIKey('openai', 'primary', 'sk-key1');
        manager.setCachedAPIKey('openai', 'backup', 'sk-key2');

        manager.invalidateCachedAPIKey('openai', 'primary');

        expect(manager.getCachedAPIKey('openai', 'primary')).toBeUndefined();
        expect(manager.getCachedAPIKey('openai', 'backup')).toBe('sk-key2');
      });

      it('should use default keyName when not specified', () => {
        manager.setCachedAPIKey('openai', 'sk-key');
        manager.invalidateCachedAPIKey('openai');
        expect(manager.getCachedAPIKey('openai')).toBeUndefined();
      });
    });

    describe('invalidateProviderCache', () => {
      it('should remove all keys for a provider', () => {
        manager.setCachedAPIKey('openai', 'primary', 'sk-key1');
        manager.setCachedAPIKey('openai', 'backup', 'sk-key2');
        manager.setCachedAPIKey('anthropic', 'primary', 'sk-key3');

        const removed = manager.invalidateProviderCache('openai');

        expect(removed).toBe(2);
        expect(manager.getCachedAPIKey('openai', 'primary')).toBeUndefined();
        expect(manager.getCachedAPIKey('openai', 'backup')).toBeUndefined();
        expect(manager.getCachedAPIKey('anthropic', 'primary')).toBe('sk-key3');
      });

      it('should return 0 if no keys found', () => {
        const removed = manager.invalidateProviderCache('nonexistent');
        expect(removed).toBe(0);
      });
    });

    describe('clearCache', () => {
      it('should remove all cached keys', () => {
        manager.setCachedAPIKey('openai', 'primary', 'sk-key1');
        manager.setCachedAPIKey('anthropic', 'primary', 'sk-key2');

        manager.clearCache();

        expect(manager.getCacheSize()).toBe(0);
        expect(manager.getCachedAPIKey('openai')).toBeUndefined();
        expect(manager.getCachedAPIKey('anthropic')).toBeUndefined();
      });
    });

    describe('getCacheSize', () => {
      it('should return 0 for empty cache', () => {
        expect(manager.getCacheSize()).toBe(0);
      });

      it('should return correct count', () => {
        manager.setCachedAPIKey('openai', 'primary', 'sk-key1');
        expect(manager.getCacheSize()).toBe(1);

        manager.setCachedAPIKey('anthropic', 'primary', 'sk-key2');
        expect(manager.getCacheSize()).toBe(2);

        // Overwriting should not increase size
        manager.setCachedAPIKey('openai', 'primary', 'sk-new-key');
        expect(manager.getCacheSize()).toBe(2);
      });
    });

    describe('TTL expiration', () => {
      it('should expire entries after TTL', async () => {
        // Use vi.useFakeTimers for time-based testing
        vi.useFakeTimers();

        manager.setCachedAPIKey('openai', 'primary', 'sk-test-key');

        // Should be available immediately
        expect(manager.getCachedAPIKey('openai', 'primary')).toBe('sk-test-key');

        // Advance time by 59 minutes (still valid)
        vi.advanceTimersByTime(59 * 60 * 1000);
        expect(manager.getCachedAPIKey('openai', 'primary')).toBe('sk-test-key');

        // Advance time to 1 hour + 1 minute (expired)
        vi.advanceTimersByTime(2 * 60 * 1000);
        expect(manager.getCachedAPIKey('openai', 'primary')).toBeUndefined();

        vi.useRealTimers();
      });
    });

    describe('LRU eviction', () => {
      it('should evict least recently used entries when at capacity', () => {
        // Create a manager with small cache for testing
        const smallCacheManager = new EncryptionManager();

        // Add entries up to capacity (100)
        for (let i = 0; i < 100; i++) {
          smallCacheManager.setCachedAPIKey(`provider-${i}`, `key-${i}`);
        }

        expect(smallCacheManager.getCacheSize()).toBe(100);

        // Add one more entry - should evict the first one
        smallCacheManager.setCachedAPIKey('new-provider', 'new-key');

        expect(smallCacheManager.getCacheSize()).toBe(100);
        expect(smallCacheManager.getCachedAPIKey('provider-0')).toBeUndefined();
        expect(smallCacheManager.getCachedAPIKey('new-provider')).toBe('new-key');
      });

      it('should update LRU order on access', () => {
        const smallCacheManager = new EncryptionManager();

        // Add entries up to capacity
        for (let i = 0; i < 100; i++) {
          smallCacheManager.setCachedAPIKey(`provider-${i}`, `key-${i}`);
        }

        // Access provider-0 to make it recently used
        smallCacheManager.getCachedAPIKey('provider-0');

        // Add a new entry - should evict provider-1 (not provider-0)
        smallCacheManager.setCachedAPIKey('new-provider', 'new-key');

        expect(smallCacheManager.getCachedAPIKey('provider-0')).toBe('key-0');
        expect(smallCacheManager.getCachedAPIKey('provider-1')).toBeUndefined();
      });
    });

    describe('performance', () => {
      it('cached retrieval should be faster than decryption', async () => {
        const apiKey = 'sk-test-api-key-12345678901234567890';

        // First, encrypt the key
        const encrypted = await manager.encrypt(apiKey);

        // Measure decryption time (multiple iterations for more accurate measurement)
        const decryptIterations = 100;
        const decryptStart = performance.now();
        for (let i = 0; i < decryptIterations; i++) {
          await manager.decrypt(encrypted);
        }
        const decryptEnd = performance.now();
        const avgDecryptTime = (decryptEnd - decryptStart) / decryptIterations;

        // Cache the key
        manager.setCachedAPIKey('test-provider', 'primary', apiKey);

        // Measure cache retrieval time
        const cacheIterations = 1000;
        const cacheStart = performance.now();
        for (let i = 0; i < cacheIterations; i++) {
          manager.getCachedAPIKey('test-provider', 'primary');
        }
        const cacheEnd = performance.now();
        const avgCacheTime = (cacheEnd - cacheStart) / cacheIterations;

        // Cache should be significantly faster than decryption
        expect(avgCacheTime).toBeLessThan(avgDecryptTime / 10);

        // Cache hit should be under 5ms (requirement)
        expect(avgCacheTime).toBeLessThan(5);

        console.log(`Average decrypt time: ${avgDecryptTime.toFixed(3)}ms`);
        console.log(`Average cache time: ${avgCacheTime.toFixed(3)}ms`);
        console.log(`Cache is ${(avgDecryptTime / avgCacheTime).toFixed(1)}x faster`);
      });
    });
  });
});
