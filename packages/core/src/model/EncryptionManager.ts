/**
 * Encryption Manager for API Keys
 *
 * Provides encryption/decryption for API keys using:
 * - Electron's safeStorage (when available in main process)
 * - AES-256-GCM fallback for Node.js/CLI environments
 */

import * as crypto from 'crypto';
import type { EncryptedKeyData } from './types';

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
 * Encryption manager for securing API keys
 *
 * Uses Electron's safeStorage when available, otherwise falls back
 * to AES-256-GCM encryption with a derived key.
 */
export class EncryptionManager {
  private useElectronSafeStorage: boolean;
  private fallbackKey: Buffer | null = null;

  constructor() {
    this.useElectronSafeStorage = isElectronSafeStorageAvailable();
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
}
