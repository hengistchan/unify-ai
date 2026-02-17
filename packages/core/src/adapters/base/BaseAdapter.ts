/**
 * BaseAdapter
 * Abstract base class for adapters, providing common implementations
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
 * Abstract adapter base class
 */
export abstract class BaseAdapter implements IAdapter {
  // ============================================
  // Abstract properties and methods (must be implemented by subclasses)
  // ============================================

  abstract readonly toolMeta: ToolMeta;
  abstract readonly version: string;

  /**
   * Get capability declarations
   */
  abstract getCapabilities(): CapabilityDeclaration[];

  /**
   * Get file patterns
   */
  abstract getFilePatterns(): FilePattern[];

  /**
   * Parse configuration
   */
  abstract parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult>;

  /**
   * Generate configuration
   */
  abstract generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult>;

  // ============================================
  // Common implementations
  // ============================================

  /**
   * Get full adapter information
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
   * Check if a specific capability is supported
   */
  hasCapability(capability: ConfigCapability): boolean {
    const cap = this.getCapabilities().find(c => c.capability === capability);
    return cap !== undefined && cap.level !== 'none';
  }

  /**
   * Get support level for a specific capability
   */
  getCapabilityLevel(capability: ConfigCapability): CapabilityLevel | undefined {
    const cap = this.getCapabilities().find(c => c.capability === capability);
    return cap?.level;
  }

  /**
   * Discover configuration files
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
   * Detect if project uses this tool
   */
  async detect(projectRoot: string): Promise<boolean> {
    const patterns = this.getFilePatterns();
    const requiredPatterns = patterns.filter(p => p.type === 'required');

    if (requiredPatterns.length === 0) {
      // If no required files, check if any config files exist
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
   * Parse from specific file
   * Default implementation, can be overridden by subclasses
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
   * Parse from content string
   * Default implementation, must be overridden by subclasses
   */
  async parseContent(content: string, filePath: string, options?: ConvertOptions): Promise<ParseResult> {
    throw new Error('parseContent must be implemented by subclass');
  }

  /**
   * Generate configuration to specified directory
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

      // Ensure directory exists
      await fs.promises.mkdir(dir, { recursive: true });

      // Write file
      const content = typeof file.content === 'string'
        ? file.content
        : file.content;
      await fs.promises.writeFile(fullPath, content, { encoding: file.encoding });
    }

    return result;
  }

  /**
   * Validate configuration
   */
  async validate(config: UnifiedConfig): Promise<ValidationResult> {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    // Basic validation
    if (!config.version) {
      errors.push({
        path: 'version',
        message: 'Configuration version is required',
      });
    }

    // Validate rules
    if (config.rules) {
      for (let i = 0; i < config.rules.length; i++) {
        const rule = config.rules[i];
        if (!rule.id) {
          errors.push({
            path: `rules[${i}].id`,
            message: 'Rule ID is required',
          });
        }
        // Skip empty content as warning, not error
        if (!rule.content || rule.content.trim() === '') {
          warnings.push({
            path: `rules[${i}].content`,
            message: `Rule "${rule.id || i}" has empty content and will be skipped`,
            suggestion: 'Add content to the rule or remove it from configuration',
          });
          // Remove empty rule from config
          config.rules.splice(i, 1);
          i--; // Adjust index after removal
        }
      }
    }

    // Validate MCP configuration
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
  // Helper methods
  // ============================================

  /**
   * Create success result
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
   * Create error result
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
   * Merge parse results
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
   * Deep merge objects
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
          // Arrays use concatenation strategy
          result[key] = [...(target[key] as unknown[]), ...(source[key] as unknown[])] as T[Extract<keyof T, string>];
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `${this.toolMeta.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
