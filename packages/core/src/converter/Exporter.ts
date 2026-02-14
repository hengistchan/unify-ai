/**
 * Converter - Exporter
 * 配置导出转换器
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import type { IAdapter } from '../adapters/base/IAdapter';
import type {
  UnifiedConfig,
  GenerateResult,
  ConvertOptions,
  ToolId,
  GenerateError,
  GenerateWarning,
  GeneratedFile,
} from '../core/types';
import { adapterRegistry } from '../adapters/registry';

/**
 * 导出选项
 */
export interface ExportOptions extends ConvertOptions {
  /**
   * 目标工具 ID
   */
  targetTool: ToolId;

  /**
   * 输出目录 (默认为项目根目录)
   */
  outputDir?: string;

  /**
   * 创建备份
   */
  createBackup?: boolean;

  /**
   * 备份目录
   */
  backupDir?: string;
}

/**
 * 导出结果
 */
export interface ExportResult {
  success: boolean;
  files?: ExportedFile[];
  errors?: ExportError[];
  warnings?: ExportWarning[];
  metadata?: {
    targetTool: ToolId;
    exportTime: number;
    backupCreated?: boolean;
  };
}

export interface ExportedFile {
  path: string;
  absolutePath: string;
  size: number;
  created: boolean;
  backedUp?: string;
}

export interface ExportError {
  code: string;
  message: string;
  file?: string;
}

export interface ExportWarning {
  code: string;
  message: string;
  suggestion?: string;
}

/**
 * 配置导出器
 */
export class Exporter {
  /**
   * 导出配置到指定工具格式
   */
  async export(
    config: UnifiedConfig,
    projectRoot: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = Date.now();
    const errors: ExportError[] = [];
    const warnings: ExportWarning[] = [];
    const exportedFiles: ExportedFile[] = [];

    // 获取目标适配器
    const adapter = adapterRegistry.get(options.targetTool);
    if (!adapter) {
      return this.createErrorResult([{
        code: 'UNKNOWN_TOOL',
        message: `Unknown target tool: ${options.targetTool}`,
      }]);
    }

    // 验证配置
    const validation = await adapter.validate(config);
    if (!validation.valid) {
      for (const err of validation.errors) {
        errors.push({
          code: 'VALIDATION_ERROR',
          message: `${err.path}: ${err.message}`,
        });
      }
      if (!options.strict) {
        warnings.push({
          code: 'VALIDATION_WARNINGS',
          message: 'Configuration has validation errors but export will continue',
        });
      } else {
        return {
          success: false,
          errors,
          metadata: {
            targetTool: options.targetTool,
            exportTime: Date.now() - startTime,
          },
        };
      }
    }

    // 检查能力支持
    const capabilityWarnings = this.checkCapabilities(config, adapter);
    warnings.push(...capabilityWarnings);

    // 生成配置文件
    const outputDir = options.outputDir ?? projectRoot;
    const generateResult = await adapter.generate(config, options);

    if (!generateResult.success) {
      return {
        success: false,
        errors: generateResult.errors?.map(e => ({
          code: e.code,
          message: e.message,
        })),
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          targetTool: options.targetTool,
          exportTime: Date.now() - startTime,
        },
      };
    }

    // 创建备份
    let backupCreated = false;
    if (options.createBackup && !options.dryRun) {
      backupCreated = await this.createBackup(projectRoot, generateResult.files, options);
    }

    // 写入文件
    if (!options.dryRun) {
      for (const file of generateResult.files) {
        const absolutePath = path.join(outputDir, file.path);

        try {
          // 确保目录存在
          await fs.mkdir(path.dirname(absolutePath), { recursive: true });

          // 写入文件
          const content = typeof file.content === 'string'
            ? file.content
            : Buffer.from(file.content);
          await fs.writeFile(absolutePath, content, { encoding: file.encoding });

          const stats = await fs.stat(absolutePath);
          exportedFiles.push({
            path: file.path,
            absolutePath,
            size: stats.size,
            created: true,
            backedUp: backupCreated ? this.getBackupPath(file.path, options) : undefined,
          });
        } catch (error) {
          errors.push({
            code: 'FILE_WRITE_ERROR',
            message: `Failed to write ${file.path}: ${error instanceof Error ? error.message : String(error)}`,
            file: file.path,
          });
        }
      }
    } else {
      // 试运行模式，不实际写入
      for (const file of generateResult.files) {
        exportedFiles.push({
          path: file.path,
          absolutePath: path.join(outputDir, file.path),
          size: typeof file.content === 'string' ? file.content.length : file.content.length,
          created: false,
        });
      }
    }

    // 添加生成器的警告
    if (generateResult.warnings) {
      for (const warn of generateResult.warnings) {
        warnings.push({
          code: warn.code,
          message: warn.message,
          suggestion: warn.suggestion,
        });
      }
    }

    return {
      success: errors.length === 0,
      files: exportedFiles,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: {
        targetTool: options.targetTool,
        exportTime: Date.now() - startTime,
        backupCreated,
      },
    };
  }

  /**
   * 导出配置到多个工具
   */
  async exportMultiple(
    config: UnifiedConfig,
    projectRoot: string,
    targetTools: ToolId[],
    options?: Omit<ExportOptions, 'targetTool'>
  ): Promise<Map<ToolId, ExportResult>> {
    const results = new Map<ToolId, ExportResult>();

    await Promise.all(
      targetTools.map(async (toolId) => {
        const result = await this.export(config, projectRoot, {
          ...options,
          targetTool: toolId,
        });
        results.set(toolId, result);
      })
    );

    return results;
  }

  /**
   * 预览导出结果 (不写入文件)
   */
  async preview(
    config: UnifiedConfig,
    targetTool: ToolId,
    options?: ConvertOptions
  ): Promise<GenerateResult> {
    const adapter = adapterRegistry.get(targetTool);
    if (!adapter) {
      return {
        success: false,
        files: [],
        errors: [{
          code: 'UNKNOWN_TOOL',
          message: `Unknown target tool: ${targetTool}`,
        }],
      };
    }

    return adapter.generate(config, { ...options, dryRun: true });
  }

  // ============================================
  // 私有方法
  // ============================================

  private checkCapabilities(config: UnifiedConfig, adapter: IAdapter): ExportWarning[] {
    const warnings: ExportWarning[] = [];

    // 检查规则
    if (config.rules?.length && !adapter.hasCapability('rules' as any)) {
      warnings.push({
        code: 'CAPABILITY_NOT_SUPPORTED',
        message: `Target tool does not support rules`,
        suggestion: 'Rules will not be exported',
      });
    }

    // 检查 MCP
    if (config.mcp?.servers?.length && !adapter.hasCapability('mcp_servers' as any)) {
      warnings.push({
        code: 'CAPABILITY_NOT_SUPPORTED',
        message: `Target tool does not support MCP servers`,
        suggestion: 'MCP configuration will not be exported',
      });
    }

    // 检查命令
    if (config.commands?.length && !adapter.hasCapability('commands' as any)) {
      warnings.push({
        code: 'CAPABILITY_NOT_SUPPORTED',
        message: `Target tool does not support custom commands`,
        suggestion: 'Commands will not be exported',
      });
    }

    return warnings;
  }

  private async createBackup(
    projectRoot: string,
    files: GeneratedFile[],
    options: ExportOptions
  ): Promise<boolean> {
    const backupDir = options.backupDir ?? path.join(projectRoot, '.unify-ai', 'backup');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, timestamp);

    try {
      await fs.mkdir(backupPath, { recursive: true });

      for (const file of files) {
        const sourcePath = path.join(projectRoot, file.path);
        const exists = await this.fileExists(sourcePath);

        if (exists) {
          const destPath = path.join(backupPath, file.path);
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.copyFile(sourcePath, destPath);
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  private getBackupPath(filePath: string, options: ExportOptions): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(options.backupDir ?? '.unify-ai/backup', timestamp, filePath);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private createErrorResult(errors: ExportError[]): ExportResult {
    return {
      success: false,
      errors,
    };
  }
}

// 导出单例
export const exporter = new Exporter();
