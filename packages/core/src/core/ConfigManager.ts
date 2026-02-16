/**
 * Core - ConfigManager
 * Unified configuration loading, saving, and validation
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import type { UnifiedConfig } from './types';
import { configValidator, type ValidationResult } from './validator';

// ============================================
// Type definitions
// ============================================

/**
 * Config manager options
 */
export interface ConfigManagerOptions {
  /** Project root directory */
  projectRoot?: string;
  /** Configuration file name */
  configFileName?: string;
  /** Whether to validate on load */
  validateOnLoad?: boolean;
  /** Whether to create default config if not exists */
  createIfMissing?: boolean;
}

/**
 * Backup info
 */
export interface BackupInfo {
  /** Backup ID */
  id: string;
  /** Backup timestamp */
  timestamp: string;
  /** Backup file path */
  path: string;
  /** Original config version */
  version?: string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_CONFIG_FILENAME = 'unified.json';
const BACKUP_DIR = '.unify-ai/backups';
const DEFAULT_CONFIG: UnifiedConfig = {
  version: '1.0.0',
  rules: [],
  mcp: {
    servers: [],
  },
  settings: {},
};

// ============================================
// ConfigManager class
// ============================================

/**
 * Configuration manager
 * Handles loading, saving, validating, and backing up unified configuration
 */
export class ConfigManager {
  private projectRoot: string;
  private configFileName: string;
  private validateOnLoad: boolean;
  private createIfMissing: boolean;
  private cachedConfig: UnifiedConfig | null = null;

  /**
   * Create a new ConfigManager
   * @param options Configuration options
   */
  constructor(options: ConfigManagerOptions = {}) {
    this.projectRoot = options.projectRoot ?? process.cwd();
    this.configFileName = options.configFileName ?? DEFAULT_CONFIG_FILENAME;
    this.validateOnLoad = options.validateOnLoad ?? true;
    this.createIfMissing = options.createIfMissing ?? false;
  }

  /**
   * Get configuration file path
   * @returns Configuration file path
   */
  getConfigPath(): string {
    return path.join(this.projectRoot, this.configFileName);
  }

  /**
   * Load unified configuration
   * @returns Unified configuration
   */
  async load(): Promise<UnifiedConfig> {
    const configPath = this.getConfigPath();

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as UnifiedConfig;

      if (this.validateOnLoad) {
        const validation = this.validate(config);
        if (!validation.valid) {
          const errorMessages = validation.errors.map(e => `${e.path}: ${e.message}`).join(', ');
          throw new Error(`Configuration validation failed: ${errorMessages}`);
        }
      }

      this.cachedConfig = config;
      return config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist
        if (this.createIfMissing) {
          // Create default config
          const defaultConfig = this.createDefaultConfig();
          await this.save(defaultConfig);
          this.cachedConfig = defaultConfig;
          return defaultConfig;
        }
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      throw error;
    }
  }

  /**
   * Save unified configuration
   * @param config Configuration to save
   */
  async save(config: UnifiedConfig): Promise<void> {
    // Validate before saving
    const validation = this.validate(config);
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => `${e.path}: ${e.message}`).join(', ');
      throw new Error(`Configuration validation failed: ${errorMessages}`);
    }

    // Update metadata
    config.lastModified = new Date().toISOString();

    const configPath = this.getConfigPath();
    const configDir = path.dirname(configPath);

    // Ensure directory exists
    await fs.mkdir(configDir, { recursive: true });

    // Write config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Update cache
    this.cachedConfig = config;
  }

  /**
   * Validate configuration
   * @param config Configuration to validate
   * @returns Validation result
   */
  validate(config: unknown): ValidationResult {
    return configValidator.validate(config);
  }

  /**
   * Create a backup of current configuration
   * @param name Optional backup name
   * @returns Backup information
   */
  async backup(name?: string): Promise<BackupInfo> {
    const configPath = this.getConfigPath();
    const timestamp = new Date();
    const backupId = name ?? timestamp.toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.projectRoot, BACKUP_DIR, `${backupId}.json`);

    // Ensure backup directory exists
    const backupDir = path.dirname(backupPath);
    await fs.mkdir(backupDir, { recursive: true });

    // Read current config
    let content: string;
    let version: string | undefined;

    try {
      content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as UnifiedConfig;
      version = config.version;
    } catch {
      content = '{}';
    }

    // Write backup
    await fs.writeFile(backupPath, content, 'utf-8');

    return {
      id: backupId,
      timestamp: timestamp.toISOString(),
      path: backupPath,
      version,
    };
  }

  /**
   * Restore configuration from backup
   * @param backupId Backup ID or path
   */
  async restore(backupId: string): Promise<void> {
    // Check if it's a full path
    let backupPath: string;
    if (path.isAbsolute(backupId)) {
      backupPath = backupId;
    } else {
      backupPath = path.join(this.projectRoot, BACKUP_DIR, `${backupId}.json`);
    }

    // Read backup
    const content = await fs.readFile(backupPath, 'utf-8');
    const config = JSON.parse(content) as UnifiedConfig;

    // Validate backup config
    const validation = this.validate(config);
    if (!validation.valid) {
      throw new Error('Backup configuration is invalid');
    }

    // Save to current config
    await this.save(config);
  }

  /**
   * List available backups
   * @returns Array of backup information
   */
  async listBackups(): Promise<BackupInfo[]> {
    const backupDir = path.join(this.projectRoot, BACKUP_DIR);

    try {
      const files = await fs.readdir(backupDir);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const backupPath = path.join(backupDir, file);
        const stat = await fs.stat(backupPath);

        // Extract ID from filename (remove .json extension)
        const id = file.replace('.json', '');

        // Try to read version from backup
        let version: string | undefined;
        try {
          const content = await fs.readFile(backupPath, 'utf-8');
          const config = JSON.parse(content) as UnifiedConfig;
          version = config.version;
        } catch {
          // Ignore
        }

        backups.push({
          id,
          timestamp: stat.mtime.toISOString(),
          path: backupPath,
          version,
        });
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return backups;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete a backup
   * @param backupId Backup ID
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backupPath = path.join(this.projectRoot, BACKUP_DIR, `${backupId}.json`);
    await fs.unlink(backupPath);
  }

  /**
   * Check if configuration file exists
   * @returns True if config exists
   */
  async exists(): Promise<boolean> {
    const configPath = this.getConfigPath();
    try {
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cached configuration
   * @returns Cached configuration or null
   */
  getCached(): UnifiedConfig | null {
    return this.cachedConfig;
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.cachedConfig = null;
  }

  /**
   * Create default configuration
   * @returns Default configuration
   */
  createDefaultConfig(): UnifiedConfig {
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Check if configuration has unsaved changes
   * @returns True if there are unsaved changes
   */
  hasUnsavedChanges(): boolean {
    // This is a simple implementation
    // In a more complex scenario, you might track dirty state
    return false;
  }

  // ============================================
  // Static methods
  // ============================================

  /**
   * Create a ConfigManager with default options
   * @param projectRoot Project root directory
   * @returns ConfigManager instance
   */
  static create(projectRoot?: string): ConfigManager {
    return new ConfigManager({ projectRoot });
  }

  /**
   * Create a ConfigManager that creates default config if missing
   * @param projectRoot Project root directory
   * @returns ConfigManager instance
   */
  static createWithDefaults(projectRoot?: string): ConfigManager {
    return new ConfigManager({
      projectRoot,
      createIfMissing: true,
    });
  }
}

// ============================================
// Export singleton factory
// ============================================

let defaultInstance: ConfigManager | null = null;

/**
 * Get default ConfigManager instance
 * @param options Configuration options
 * @returns ConfigManager instance
 */
export function getConfigManager(options?: ConfigManagerOptions): ConfigManager {
  if (!defaultInstance) {
    defaultInstance = new ConfigManager(options);
  }
  return defaultInstance;
}

/**
 * Create a new ConfigManager instance
 * @param options Configuration options
 * @returns New ConfigManager instance
 */
export function createConfigManager(options: ConfigManagerOptions): ConfigManager {
  return new ConfigManager(options);
}
