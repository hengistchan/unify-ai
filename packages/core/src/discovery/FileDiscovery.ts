/**
 * File Discovery
 * 配置文件发现服务
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
 * 发现选项
 */
export interface DiscoveryOptions {
  /**
   * 要扫描的目录
   */
  scanDirs?: string[];

  /**
   * 排除的模式
   */
  exclude?: string[];

  /**
   * 最大深度
   */
  maxDepth?: number;

  /**
   * 只发现特定能力
   */
  capabilities?: ConfigCapability[];

  /**
   * 只使用特定适配器
   */
  adapters?: IAdapter[];
}

/**
 * 发现结果
 */
export interface DiscoveryResult {
  /**
   * 发现的文件
   */
  files: DiscoveredFile[];

  /**
   * 检测到的工具
   */
  detectedTools: IAdapter[];

  /**
   * 扫描耗时 (ms)
   */
  scanTime: number;
}

/**
 * 发现的文件
 */
export interface DiscoveredFile extends FileInfo {
  /**
   * 关联的适配器
   */
  adapter: IAdapter;

  /**
   * 关联的能力
   */
  capability: ConfigCapability;

  /**
   * 匹配的模式
   */
  matchedPattern: FilePattern;
}

/**
 * 文件发现器
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
   * 发现项目中的 AI 工具配置文件
   */
  async discover(projectRoot: string, options?: DiscoveryOptions): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const files: DiscoveredFile[] = [];
    const detectedTools = new Set<IAdapter>();

    // 获取要使用的适配器
    const adapters = options?.adapters ?? adapterRegistry.getAll();

    // 并行扫描所有适配器的文件模式
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
   * 发现特定能力的配置文件
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
   * 检测项目使用的 AI 工具
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
   * 检查特定配置文件是否存在
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
   * 扫描多个路径
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
  // 私有方法
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

// 导出单例
export const fileDiscovery = new FileDiscovery();
