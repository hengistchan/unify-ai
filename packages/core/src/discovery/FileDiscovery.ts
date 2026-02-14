/**
 * File Discovery
 * Configuration file discovery service
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';

import type { IAdapter } from '../adapters/base/IAdapter';
import type {
  FileInfo,
  FilePattern,
  ConfigCapability,
} from '../core/types';
import { adapterRegistry } from '../adapters/registry';

/**
 * Discovery options
 */
export interface DiscoveryOptions {
  /**
   * Directories to scan
   */
  scanDirs?: string[];

  /**
   * Patterns to exclude
   */
  exclude?: string[];

  /**
   * Maximum depth
   */
  maxDepth?: number;

  /**
   * Only discover specific capabilities
   */
  capabilities?: ConfigCapability[];

  /**
   * Only use specific adapters
   */
  adapters?: IAdapter[];
}

/**
 * Discovery result
 */
export interface DiscoveryResult {
  /**
   * Discovered files
   */
  files: DiscoveredFile[];

  /**
   * Detected tools
   */
  detectedTools: IAdapter[];

  /**
   * Scan time (ms)
   */
  scanTime: number;
}

/**
 * Discovered file
 */
export interface DiscoveredFile extends FileInfo {
  /**
   * Associated adapter
   */
  adapter: IAdapter;

  /**
   * Associated capability
   */
  capability: ConfigCapability;

  /**
   * Matched pattern
   */
  matchedPattern: FilePattern;
}

/**
 * File discoverer
 */
export class FileDiscovery {
  private defaultExclude = [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '**/*.lock',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
  ];

  /**
   * Discover AI tool configuration files in project
   */
  async discover(projectRoot: string, options?: DiscoveryOptions): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const files: DiscoveredFile[] = [];
    const detectedTools = new Set<IAdapter>();

    // Get adapters to use
    const adapters = options?.adapters ?? adapterRegistry.getAll();

    // Scan all adapter file patterns in parallel
    const scanPromises = adapters.map(async (adapter) => {
      const patterns = this.filterPatterns(adapter.getFilePatterns(), options?.capabilities);
      const adapterFiles: DiscoveredFile[] = [];

      for (const pattern of patterns) {
        const matches = await this.scanPattern(projectRoot, pattern.pattern, options?.exclude);
        for (const fileInfo of matches) {
          adapterFiles.push({
            ...fileInfo,
            adapter,
            capability: pattern.capability,
            matchedPattern: pattern,
          });
          detectedTools.add(adapter);
        }
      }

      return adapterFiles;
    });

    const results = await Promise.all(scanPromises);
    for (const adapterFiles of results) {
      files.push(...adapterFiles);
    }

    return {
      files: this.deduplicateFiles(files),
      detectedTools: Array.from(detectedTools),
      scanTime: Date.now() - startTime,
    };
  }

  /**
   * Discover config files for specific capability
   */
  async discoverByCapability(
    projectRoot: string,
    capability: ConfigCapability,
    options?: Omit<DiscoveryOptions, 'capabilities'>
  ): Promise<DiscoveredFile[]> {
    const result = await this.discover(projectRoot, {
      ...options,
      capabilities: [capability],
    });
    return result.files;
  }

  /**
   * Detect AI tools used in project
   */
  async detectTools(projectRoot: string): Promise<IAdapter[]> {
    const adapters = adapterRegistry.getAll();
    const detected: IAdapter[] = [];

    await Promise.all(
      adapters.map(async (adapter) => {
        if (await adapter.detect(projectRoot)) {
          detected.push(adapter);
        }
      })
    );

    return detected;
  }

  /**
   * Check if specific config file exists
   */
  async checkFile(projectRoot: string, relativePath: string): Promise<FileInfo> {
    const absolutePath = path.join(projectRoot, relativePath);
    const exists = await this.fileExists(absolutePath);

    if (!exists) {
      return {
        path: relativePath,
        absolutePath,
        exists: false,
      };
    }

    const stats = await fs.stat(absolutePath);
    return {
      path: relativePath,
      absolutePath,
      exists: true,
      size: stats.size,
      lastModified: stats.mtime,
    };
  }

  /**
   * Scan multiple paths
   */
  async scanPaths(
    projectRoot: string,
    paths: string[],
    options?: DiscoveryOptions
  ): Promise<FileInfo[]> {
    const results: FileInfo[] = [];

    for (const pattern of paths) {
      const matches = await this.scanPattern(projectRoot, pattern, options?.exclude);
      results.push(...matches);
    }

    return this.deduplicateFiles(results);
  }

  // ============================================
  // Private methods
  // ============================================

  private filterPatterns(
    patterns: FilePattern[],
    capabilities?: ConfigCapability[]
  ): FilePattern[] {
    if (!capabilities || capabilities.length === 0) {
      return patterns;
    }
    return patterns.filter(p => capabilities.includes(p.capability));
  }

  private async scanPattern(
    projectRoot: string,
    pattern: string,
    exclude?: string[]
  ): Promise<FileInfo[]> {
    const ignore = [...this.defaultExclude, ...(exclude ?? [])];

    try {
      const matches = await glob(pattern, {
        cwd: projectRoot,
        absolute: true,
        nodir: true,
        ignore,
        dot: true,
      });

      return Promise.all(
        matches.map(async (absolutePath) => {
          const relativePath = path.relative(projectRoot, absolutePath);
          const stats = await fs.stat(absolutePath);
          return {
            path: relativePath,
            absolutePath,
            exists: true,
            size: stats.size,
            lastModified: stats.mtime,
          };
        })
      );
    } catch {
      return [];
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private deduplicateFiles<T extends FileInfo>(files: T[]): T[] {
    const seen = new Set<string>();
    return files.filter((file) => {
      if (seen.has(file.absolutePath)) {
        return false;
      }
      seen.add(file.absolutePath);
      return true;
    });
  }
}

// Export singleton
export const fileDiscovery = new FileDiscovery();
