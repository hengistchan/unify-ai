/**
 * Converter - Exporter
 * Configuration export converter
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
 * Export options
 */
export interface ExportOptions extends ConvertOptions {
  /**
   * Target tool ID
   */
  targetTool: ToolId;

  /**
   * Output directory (defaults to project root)
   */
  outputDir?: string;

  /**
   * Create backup
   */
  createBackup?: boolean;

  /**
   * Backup directory
   */
  backupDir?: string;
}

/**
 * Export result
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
 * Configuration exporter
 */
export class Exporter {
  /**
   * Export configuration to specified tool format
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

    // Get target adapter
    const adapter = adapterRegistry.get(options.targetTool);
    if (!adapter) {
      return this.createErrorResult([
        {
          code: 'UNKNOWN_TOOL',
          message: `Unknown target tool: ${options.targetTool}`,
        },
      ]);
    }

    // Validate configuration
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

    // Check capability support
    const capabilityWarnings = this.checkCapabilities(config, adapter);
    warnings.push(...capabilityWarnings);

    // Generate configuration file
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

    // Create backup
    let backupCreated = false;
    if (options.createBackup && !options.dryRun) {
      backupCreated = await this.createBackup(projectRoot, generateResult.files, options);
    }

    // Write files
    if (!options.dryRun) {
      for (const file of generateResult.files) {
        const absolutePath = path.join(outputDir, file.path);

        try {
          // Ensure directory exists
          await fs.mkdir(path.dirname(absolutePath), { recursive: true });

          // Write file
          const content =
            typeof file.content === 'string' ? file.content : Buffer.from(file.content);
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
      // Dry-run mode, don't actually write
      for (const file of generateResult.files) {
        exportedFiles.push({
          path: file.path,
          absolutePath: path.join(outputDir, file.path),
          size: typeof file.content === 'string' ? file.content.length : file.content.length,
          created: false,
        });
      }
    }

    // Add warnings from generator
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
   * Export configuration to multiple tools
   */
  async exportMultiple(
    config: UnifiedConfig,
    projectRoot: string,
    targetTools: ToolId[],
    options?: Omit<ExportOptions, 'targetTool'>
  ): Promise<Map<ToolId, ExportResult>> {
    const results = new Map<ToolId, ExportResult>();

    await Promise.all(
      targetTools.map(async toolId => {
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
   * Preview export results (don't write files)
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
        errors: [
          {
            code: 'UNKNOWN_TOOL',
            message: `Unknown target tool: ${targetTool}`,
          },
        ],
      };
    }

    return adapter.generate(config, { ...options, dryRun: true });
  }

  // ============================================
  // Private methods
  // ============================================

  private checkCapabilities(config: UnifiedConfig, adapter: IAdapter): ExportWarning[] {
    const warnings: ExportWarning[] = [];

    // Check rules
    if (config.rules?.length && !adapter.hasCapability('rules' as any)) {
      warnings.push({
        code: 'CAPABILITY_NOT_SUPPORTED',
        message: `Target tool does not support rules`,
        suggestion: 'Rules will not be exported',
      });
    }

    // Check MCP
    if (config.mcp?.servers?.length && !adapter.hasCapability('mcp_servers' as any)) {
      warnings.push({
        code: 'CAPABILITY_NOT_SUPPORTED',
        message: `Target tool does not support MCP servers`,
        suggestion: 'MCP configuration will not be exported',
      });
    }

    // Check commands
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

// Export singleton
export const exporter = new Exporter();
