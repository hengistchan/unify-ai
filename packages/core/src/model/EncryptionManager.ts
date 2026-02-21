/**
 * Encryption Manager for API Keys
 *
 * Provides encryption/decryption for API keys using:
 * - Electron's safeStorage (when available in main process)
 * - AES-256-GCM fallback for Node.js/CLI environments
 *
 * Includes LRU cache for decrypted API keys with 1-hour TTL.
 */

import * as crypto from 'crypto';
import type { EncryptedKeyData } from './types';

/**
 * Cache entry for decrypted API keys
 */
interface CacheEntry {
  /** Decrypted API key value */
  value: string;
  /** Timestamp when entry was created (ms since epoch) */
  createdAt: number;
}

/**
 * Check if Electron's safeStorage is available
 */
function isElectronSafeStorageAvailable(): boolean {
  try {
    // Dynamic import to avoid errors in non-Electron environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { safeStorage } = require('electron');
    return safeStorage && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/**
 * Simple LRU Cache implementation for API key caching
 *
 * Features:
 * - Maximum size limit (default: 100 entries)
 * - TTL-based expiration (default: 1 hour)
 * - LRU eviction when size limit reached
 */
class APIKeyCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  /**
   * Create a new API key cache
   * @param maxSize - Maximum number of entries (default: 100)
   * @param ttlMs - Time-to-live in milliseconds (default: 1 hour)
   */
  constructor(maxSize: number = 100, ttlMs: number = 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key from provider ID and key name
   */
  static createCacheKey(providerId: string, keyName: string): string;
  /**
   * Generate cache key from provider ID, key name, and tool ID
   */
  static createCacheKey(providerId: string, keyName: string, toolId: string): string;
  static createCacheKey(providerId: string, keyName: string, toolId?: string): string {
    if (toolId !== undefined && toolId !== 'global') {
      return `${providerId}:${toolId}:${keyName}`;
    }
    return `${providerId}:${keyName}`;
  }

  /**
   * Get a cached value if it exists and hasn't expired
   * @returns The cached value or undefined if not found/expired
   */
  get(key: string): string | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used) - implements LRU
    // Map maintains insertion order, so delete + re-add = move to end
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: string): void {
    // Remove existing entry if present (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      // First key is the least recently used (oldest insertion)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
    });
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Delete all keys for a specific provider
   * @param providerId - Provider ID
   * @param toolId - Optional tool ID to further filter
   */
  deleteByProvider(providerId: string, toolId?: string): number {
    const keysToDelete: string[] = [];
    const prefix = toolId !== undefined
      ? `${providerId}:${toolId}:`
      : `${providerId}:`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    return keysToDelete.length;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Encryption manager for securing API keys
 *
 * Uses Electron's safeStorage when available, otherwise falls back
 * to AES-256-GCM encryption with a derived key.
 */
export class EncryptionManager {
  private useElectronSafeStorage: boolean;
  private fallbackKey: Buffer | null = null;
  private cache: APIKeyCache;

  constructor() {
    this.useElectronSafeStorage = isElectronSafeStorageAvailable();
    this.cache = new APIKeyCache();
  }

  /**
   * Set the encryption key for fallback mode (non-Electron environments)
   * If not set, a default key derived from environment will be used
   *
   * @param key - Encryption key (must be 32 bytes for AES-256)
   */
  setFallbackKey(key: Buffer): void {
    if (key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes for AES-256');
    }
    this.fallbackKey = key;
  }

  /**
   * Get or derive the fallback encryption key
   */
  private getFallbackKey(): Buffer {
    if (this.fallbackKey) {
      return this.fallbackKey;
    }

    // Derive key from environment variable or use default
    const envKey = process.env.UNIFY_AI_ENCRYPTION_KEY;
    if (envKey) {
      // Derive 32-byte key from environment variable using PBKDF2
      return crypto.pbkdf2Sync(
        envKey,
        'unify-ai-salt',
        100000,
        32,
        'sha256'
      );
    }

    // Default key (for development only - should not be used in production)
    // This is a fixed salt to derive a consistent key for development
    const defaultSecret = 'unify-ai-default-encryption-key-do-not-use-in-production';
    return crypto.pbkdf2Sync(
      defaultSecret,
      'unify-ai-default-salt',
      100000,
      32,
      'sha256'
    );
  }

  /**
   * Check if encryption is available
   *
   * @returns True if encryption can be performed
   */
  isEncryptionAvailable(): boolean {
    if (this.useElectronSafeStorage) {
      return true;
    }

    // Fallback encryption is always available (uses derived key)
    return true;
  }

  /**
   * Encrypt a plaintext string
   *
   * @param plaintext - The string to encrypt
   * @returns Encrypted key data
   * @throws Error if encryption fails or input is invalid
   */
  async encrypt(plaintext: string): Promise<EncryptedKeyData> {
    // Validate input
    if (!plaintext || typeof plaintext !== 'string') {
      throw new Error('Plaintext must be a non-empty string');
    }

    if (!this.isEncryptionAvailable()) {
      throw new Error('Encryption is not available');
    }

    try {
      // Use Electron's safeStorage if available
      if (this.useElectronSafeStorage) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { safeStorage } = require('electron');

        const encrypted = safeStorage.encryptString(plaintext);
        return {
          encrypted: Buffer.from(encrypted),
        };
      }

      // Fallback: AES-256-GCM encryption
      const key = this.getFallbackKey();
      const iv = crypto.randomBytes(16); // 16-byte IV for GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);

      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv,
        authTag,
      };
    } catch (error) {
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decrypt encrypted data
   *
   * @param data - Encrypted key data
   * @returns Decrypted plaintext string
   * @throws Error if decryption fails or data is invalid
   */
  async decrypt(data: EncryptedKeyData): Promise<string> {
    // Validate input
    if (!data || !Buffer.isBuffer(data.encrypted)) {
      throw new Error('Invalid encrypted data: encrypted buffer is required');
    }

    if (!this.isEncryptionAvailable()) {
      throw new Error('Encryption is not available');
    }

    try {
      // Use Electron's safeStorage if available
      if (this.useElectronSafeStorage) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { safeStorage } = require('electron');

        const decrypted = safeStorage.decryptString(data.encrypted);
        return decrypted;
      }

      // Fallback: AES-256-GCM decryption
      if (!Buffer.isBuffer(data.iv)) {
        throw new Error('Invalid encrypted data: iv buffer is required for fallback decryption');
      }
      if (!Buffer.isBuffer(data.authTag)) {
        throw new Error('Invalid encrypted data: authTag buffer is required for fallback decryption');
      }

      const key = this.getFallbackKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, data.iv);

      decipher.setAuthTag(data.authTag);

      const decrypted = Buffer.concat([
        decipher.update(data.encrypted),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ============================================
  // Cache Management Methods
  // ============================================

  /**
   * Get cached API key if available
   *
   * @param providerId - Provider ID
   * @param keyName - Key name (default: 'primary')
   * @param toolId - Tool ID (default: 'global')
   * @returns Cached API key or undefined if not in cache
   */
  getCachedAPIKey(providerId: string, keyName?: string, toolId?: string): string | undefined {
    const name = keyName ?? 'primary';
    const effectiveToolId = toolId ?? 'global';
    const cacheKey = APIKeyCache.createCacheKey(providerId, name, effectiveToolId);
    return this.cache.get(cacheKey);
  }

  /**
   * Cache an API key
   *
   * @param providerId - Provider ID
   * @param keyName - Key name (default: 'primary')
   * @param apiKey - The decrypted API key to cache
   * @param toolId - Tool ID (default: 'global')
   */
  setCachedAPIKey(
    providerId: string,
    keyNameOrApiKey: string,
    apiKeyOrToolId?: string | undefined,
    apiKey?: string
  ): void {
    // Handle overloads:
    // setCachedAPIKey(providerId, apiKey)
    // setCachedAPIKey(providerId, keyName, apiKey)
    // setCachedAPIKey(providerId, keyName, toolId, apiKey)
    if (apiKey !== undefined) {
      // setCachedAPIKey(providerId, keyName, toolId, apiKey)
      const cacheKey = APIKeyCache.createCacheKey(providerId, keyNameOrApiKey, apiKeyOrToolId as string);
      this.cache.set(cacheKey, apiKey);
    } else if (apiKeyOrToolId !== undefined) {
      // setCachedAPIKey(providerId, keyName, apiKey)
      const cacheKey = APIKeyCache.createCacheKey(providerId, keyNameOrApiKey);
      this.cache.set(cacheKey, apiKeyOrToolId);
    } else {
      // setCachedAPIKey(providerId, apiKey)
      const cacheKey = APIKeyCache.createCacheKey(providerId, 'primary');
      this.cache.set(cacheKey, keyNameOrApiKey);
    }
  }

  /**
   * Invalidate cached API key
   *
   * Call this when an API key is updated or deleted.
   *
   * @param providerId - Provider ID
   * @param keyName - Key name (default: 'primary')
   * @param toolId - Tool ID (default: 'global')
   */
  invalidateCachedAPIKey(providerId: string, keyName?: string, toolId?: string): void {
    const name = keyName ?? 'primary';
    const effectiveToolId = toolId ?? 'global';
    const cacheKey = APIKeyCache.createCacheKey(providerId, name, effectiveToolId);
    this.cache.delete(cacheKey);
  }

  /**
   * Invalidate all cached API keys for a provider
   *
   * @param providerId - Provider ID
   * @param toolId - Optional tool ID to further filter
   * @returns Number of cache entries removed
   */
  invalidateProviderCache(providerId: string, toolId?: string): number {
    return this.cache.deleteByProvider(providerId, toolId);
  }

  /**
   * Clear all cached API keys
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size (for debugging/monitoring)
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}
