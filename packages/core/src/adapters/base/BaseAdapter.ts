/**
 * BaseAdapter
 * 适配器抽象基类，提供通用实现
 */

import type {
  UnifiedConfig,
  ParseResult,
  GenerateResult,
  ConvertOptions,
  AdapterInfo,
  FileInfo,
  ToolMeta,
  CapabilityDeclaration,
  ConfigCapability,
  CapabilityLevel,
  FilePattern,
  ParseError,
  ParseWarning,
} from '../../core/types';
import type { IAdapter, ValidationResult } from './IAdapter';
import { AdapterStatus } from '../../core/types';

/**
 * 抽象适配器基类
 */
export abstract class BaseAdapter implements IAdapter {
  // ============================================
  // 抽象属性和方法 (子类必须实现)
  // ============================================

  abstract readonly toolMeta: ToolMeta;
  abstract readonly version: string;

  /**
   * 获取能力声明列表
   */
  abstract getCapabilities(): CapabilityDeclaration[];

  /**
   * 获取文件模式
   */
  abstract getFilePatterns(): FilePattern[];

  /**
   * 解析配置
   */
  abstract parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult>;

  /**
   * 生成配置
   */
  abstract generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult>;

  // ============================================
  // 通用实现
  // ============================================

  /**
   * 获取适配器完整信息
   */
  getInfo(): AdapterInfo {
    return {
      tool: this.toolMeta,
      version: this.version,
      capabilities: this.getCapabilities(),
      status: AdapterStatus.READY,
      filePatterns: this.getFilePatterns(),
    };
  }

  /**
   * 检查是否支持特定能力
   */
  hasCapability(capability: ConfigCapability): boolean {
    const cap = this.getCapabilities().find(c => c.capability === capability);
    return cap !== undefined && cap.level !== 'none';
  }

  /**
   * 获取特定能力的支持级别
   */
  getCapabilityLevel(capability: ConfigCapability): CapabilityLevel | undefined {
    const cap = this.getCapabilities().find(c => c.capability === capability);
    return cap?.level;
  }

  /**
   * 发现配置文件
   */
  async discoverFiles(projectRoot: string): Promise<FileInfo[]> {
    const patterns = this.getFilePatterns();
    const files: FileInfo[] = [];
    const fs = await import('fs');
    const path = await import('path');
    const { glob } = await import('glob');

    for (const pattern of patterns) {
      const matches = await glob(pattern.pattern, {
        cwd: projectRoot,
        absolute: true,
        nodir: true,
      });

      for (const absolutePath of matches) {
        const relativePath = path.relative(projectRoot, absolutePath);
        const stats = await fs.promises.stat(absolutePath).catch(() => null);

        files.push({
          path: relativePath,
          absolutePath,
          exists: true,
          size: stats?.size,
          lastModified: stats?.mtime,
        });
      }
    }

    return files;
  }

  /**
   * 检测项目是否使用此工具
   */
  async detect(projectRoot: string): Promise<boolean> {
    const patterns = this.getFilePatterns();
    const requiredPatterns = patterns.filter(p => p.type === 'required');

    if (requiredPatterns.length === 0) {
      // 如果没有必需文件，检查是否有任何配置文件存在
      const files = await this.discoverFiles(projectRoot);
      return files.length > 0;
    }

    const fs = await import('fs');
    const path = await import('path');
    const { glob } = await import('glob');

    for (const pattern of requiredPatterns) {
      const matches = await glob(pattern.pattern, {
        cwd: projectRoot,
        nodir: true,
      });
      if (matches.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * 从特定文件解析
   * 默认实现，子类可覆盖
   */
  async parseFile(filePath: string, options?: ConvertOptions): Promise<ParseResult> {
    const fs = await import('fs');
    const path = await import('path');

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.parseContent(content, filePath, options);
    } catch (error) {
      return this.createErrorResult([
        {
          code: 'FILE_READ_ERROR',
          message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: false,
        },
      ]);
    }
  }

  /**
   * 从内容字符串解析
   * 默认实现，子类必须覆盖
   */
  async parseContent(content: string, filePath: string, options?: ConvertOptions): Promise<ParseResult> {
    throw new Error('parseContent must be implemented by subclass');
  }

  /**
   * 生成配置到指定目录
   */
  async generateTo(
    config: UnifiedConfig,
    targetDir: string,
    options?: ConvertOptions
  ): Promise<GenerateResult> {
    const result = await this.generate(config, options);

    if (!result.success || options?.dryRun) {
      return result;
    }

    const fs = await import('fs');
    const path = await import('path');

    for (const file of result.files) {
      const fullPath = path.join(targetDir, file.path);
      const dir = path.dirname(fullPath);

      // 确保目录存在
      await fs.promises.mkdir(dir, { recursive: true });

      // 写入文件
      const content = typeof file.content === 'string'
        ? file.content
        : file.content;
      await fs.promises.writeFile(fullPath, content, { encoding: file.encoding });
    }

    return result;
  }

  /**
   * 验证配置
   */
  async validate(config: UnifiedConfig): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    // 基础验证
    if (!config.version) {
      errors.push({
        path: 'version',
        message: 'Configuration version is required',
      });
    }

    // 验证规则
    if (config.rules) {
      for (let i = 0; i < config.rules.length; i++) {
        const rule = config.rules[i];
        if (!rule.id) {
          errors.push({
            path: `rules[${i}].id`,
            message: 'Rule ID is required',
          });
        }
        if (!rule.content) {
          errors.push({
            path: `rules[${i}].content`,
            message: 'Rule content is required',
          });
        }
      }
    }

    // 验证 MCP 配置
    if (config.mcp?.servers) {
      for (let i = 0; i < config.mcp.servers.length; i++) {
        const server = config.mcp.servers[i];
        if (!server.name) {
          errors.push({
            path: `mcp.servers[${i}].name`,
            message: 'MCP server name is required',
          });
        }
        if (!server.command) {
          errors.push({
            path: `mcp.servers[${i}].command`,
            message: 'MCP server command is required',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================
  // 辅助方法
  // ============================================

  /**
   * 创建成功结果
   */
  protected createSuccessResult(
    data: UnifiedConfig,
    metadata?: ParseResult['metadata']
  ): ParseResult {
    return {
      success: true,
      data,
      metadata: metadata ?? {
        sourceFiles: [],
        parseTime: Date.now(),
      },
    };
  }

  /**
   * 创建错误结果
   */
  protected createErrorResult(errors: ParseError[], warnings?: ParseWarning[]): ParseResult {
    return {
      success: false,
      errors,
      warnings,
      metadata: {
        sourceFiles: [],
        parseTime: Date.now(),
      },
    };
  }

  /**
   * 合并解析结果
   */
  protected mergeResults(...results: ParseResult[]): ParseResult {
    const allErrors: ParseError[] = [];
    const allWarnings: ParseWarning[] = [];
    const allSourceFiles: FileInfo[] = [];
    let mergedData: UnifiedConfig | undefined;

    for (const result of results) {
      if (result.errors) allErrors.push(...result.errors);
      if (result.warnings) allWarnings.push(...result.warnings);
      if (result.metadata?.sourceFiles) allSourceFiles.push(...result.metadata.sourceFiles);

      if (result.data) {
        if (!mergedData) {
          mergedData = result.data;
        } else {
          mergedData = this.deepMerge(mergedData as unknown as Record<string, unknown>, result.data as unknown as Record<string, unknown>) as unknown as UnifiedConfig;
        }
      }
    }

    return {
      success: allErrors.filter(e => !e.recoverable).length === 0 && mergedData !== undefined,
      data: mergedData,
      errors: allErrors.length > 0 ? allErrors : undefined,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
      metadata: {
        sourceFiles: allSourceFiles,
        parseTime: Date.now(),
      },
    };
  }

  /**
   * 深度合并对象
   */
  protected deepMerge<T extends Record<string, unknown>>(target: T, source: T): T {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof target[key] === 'object' &&
          target[key] !== null &&
          !Array.isArray(target[key])
        ) {
          result[key] = this.deepMerge(
            target[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>
          ) as T[Extract<keyof T, string>];
        } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
          // 数组采用连接策略
          result[key] = [...(target[key] as unknown[]), ...(source[key] as unknown[])] as T[Extract<keyof T, string>];
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * 生成唯一 ID
   */
  protected generateId(): string {
    return `${this.toolMeta.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
