/**
 * Converter - Importer
 * Configuration import converter
 */

import type { IAdapter } from '../adapters/base/IAdapter';
import type {
  UnifiedConfig,
  ParseResult,
  ConvertOptions,
  ToolId,
  ParseError,
} from '../core/types';
import { adapterRegistry } from '../adapters/registry';

/**
 * Import options
 */
export interface ImportOptions extends ConvertOptions {
  /**
   * Source tool ID (auto-detect if not specified)
   */
  sourceTool?: ToolId;

  /**
   * Merge configurations from multiple tools
   */
  mergeMultiple?: boolean;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  config?: UnifiedConfig;
  errors?: ImportError[];
  warnings?: ImportWarning[];
  metadata?: {
    sourceTools: ToolId[];
    sourceFiles: string[];
    importTime: number;
  };
}

export interface ImportError {
  code: string;
  message: string;
  tool?: ToolId;
  file?: string;
}

export interface ImportWarning {
  code: string;
  message: string;
  tool?: ToolId;
  suggestion?: string;
}

/**
 * Configuration importer
 */
export class Importer {
  /**
   * Import configuration from project
   */
  async import(projectRoot: string, options?: ImportOptions): Promise<ImportResult> {
    const startTime = Date.now();
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];
    const sourceTools: ToolId[] = [];
    const sourceFiles: string[] = [];

    // Determine which adapter to use
    let adapters: IAdapter[];
    if (options?.sourceTool) {
      const adapter = adapterRegistry.get(options.sourceTool);
      if (!adapter) {
        return this.createErrorResult([{
          code: 'UNKNOWN_TOOL',
          message: `Unknown tool: ${options.sourceTool}`,
        }]);
      }
      adapters = [adapter];
    } else {
      // Auto-detect
      adapters = await adapterRegistry.detectForProject(projectRoot);
      if (adapters.length === 0) {
        return this.createErrorResult([{
          code: 'NO_CONFIG_FOUND',
          message: 'No AI tool configuration found in the project',
        }]);
      }
    }

    // Parse configuration
    const configs: UnifiedConfig[] = [];

    for (const adapter of adapters) {
      const result = await adapter.parse(projectRoot, options);

      if (result.success && result.data) {
        configs.push(result.data);
        sourceTools.push(adapter.toolMeta.id);
        if (result.metadata?.sourceFiles) {
          sourceFiles.push(...result.metadata.sourceFiles.map(f => f.path));
        }
      }

      if (result.errors) {
        for (const err of result.errors) {
          errors.push({
            code: err.code,
            message: err.message,
            tool: adapter.toolMeta.id,
            file: err.file,
          });
        }
      }

      if (result.warnings) {
        for (const warn of result.warnings) {
          warnings.push({
            code: warn.code,
            message: warn.message,
            tool: adapter.toolMeta.id,
          });
        }
      }
    }

    // Merge configurations
    let finalConfig: UnifiedConfig | undefined;
    if (configs.length === 1) {
      finalConfig = configs[0];
    } else if (configs.length > 1) {
      if (options?.mergeMultiple) {
        finalConfig = this.mergeConfigs(configs);
      } else {
        // Use the first successfully parsed configuration
        finalConfig = configs[0];
        warnings.push({
          code: 'MULTIPLE_CONFIGS',
          message: `Found configurations from ${configs.length} tools. Using the first one. Use mergeMultiple option to merge.`,
          suggestion: 'Set mergeMultiple: true to merge all configurations',
        });
      }
    }

    return {
      success: finalConfig !== undefined,
      config: finalConfig,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: {
        sourceTools,
        sourceFiles,
        importTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Import from specific tool
   */
  async importFrom(
    projectRoot: string,
    toolId: ToolId,
    options?: ConvertOptions
  ): Promise<ImportResult> {
    return this.import(projectRoot, { ...options, sourceTool: toolId });
  }

  /**
   * Import from file
   */
  async importFile(
    filePath: string,
    toolId: ToolId,
    options?: ConvertOptions
  ): Promise<ImportResult> {
    const adapter = adapterRegistry.get(toolId);
    if (!adapter) {
      return this.createErrorResult([{
        code: 'UNKNOWN_TOOL',
        message: `Unknown tool: ${toolId}`,
      }]);
    }

    const result = await adapter.parseFile(filePath, options);

    return {
      success: result.success,
      config: result.data,
      errors: result.errors?.map(e => ({
        code: e.code,
        message: e.message,
        tool: toolId,
        file: e.file,
      })),
      warnings: result.warnings?.map(w => ({
        code: w.code,
        message: w.message,
        tool: toolId,
      })),
      metadata: result.metadata ? {
        sourceTools: [toolId],
        sourceFiles: result.metadata.sourceFiles.map(f => f.path),
        importTime: result.metadata.parseTime,
      } : undefined,
    };
  }

  // ============================================
  // Private methods
  // ============================================

  private mergeConfigs(configs: UnifiedConfig[]): UnifiedConfig {
    const merged: UnifiedConfig = {
      version: '1.0',
      rules: [],
    };

    const seenRuleIds = new Set<string>();
    const seenServerNames = new Set<string>();

    for (const config of configs) {
      // Merge rules (deduplicate)
      if (config.rules) {
        for (const rule of config.rules) {
          if (!seenRuleIds.has(rule.id)) {
            merged.rules.push(rule);
            seenRuleIds.add(rule.id);
          }
        }
      }

      // Merge MCP
      if (config.mcp?.servers) {
        if (!merged.mcp) {
          merged.mcp = { servers: [] };
        }
        for (const server of config.mcp.servers) {
          if (!seenServerNames.has(server.name)) {
            merged.mcp.servers.push(server);
            seenServerNames.add(server.name);
          }
        }
      }

      // Merge settings
      if (config.settings) {
        merged.settings = this.mergeSettings(merged.settings, config.settings);
      }

      // Merge commands
      if (config.commands) {
        if (!merged.commands) {
          merged.commands = [];
        }
        merged.commands.push(...config.commands);
      }

      // Merge prompts
      if (config.prompts) {
        if (!merged.prompts) {
          merged.prompts = [];
        }
        merged.prompts.push(...config.prompts);
      }

      // Merge context files
      if (config.contextFiles) {
        if (!merged.contextFiles) {
          merged.contextFiles = [];
        }
        for (const file of config.contextFiles) {
          if (!merged.contextFiles.includes(file)) {
            merged.contextFiles.push(file);
          }
        }
      }

      // Merge environment variables
      if (config.envVars) {
        if (!merged.envVars) {
          merged.envVars = {};
        }
        Object.assign(merged.envVars, config.envVars);
      }

      // Merge ignore patterns
      if (config.ignorePatterns) {
        if (!merged.ignorePatterns) {
          merged.ignorePatterns = [];
        }
        for (const pattern of config.ignorePatterns) {
          if (!merged.ignorePatterns.includes(pattern)) {
            merged.ignorePatterns.push(pattern);
          }
        }
      }
    }

    return merged;
  }

  private mergeSettings(
    base?: UnifiedConfig['settings'],
    overlay?: UnifiedConfig['settings']
  ): UnifiedConfig['settings'] {
    if (!base) return overlay;
    if (!overlay) return base;

    return {
      model: {
        ...base.model,
        ...overlay.model,
        available: [...(base.model?.available ?? []), ...(overlay.model?.available ?? [])],
      },
      permissions: {
        allow: [...(base.permissions?.allow ?? []), ...(overlay.permissions?.allow ?? [])],
        deny: [...(base.permissions?.deny ?? []), ...(overlay.permissions?.deny ?? [])],
      },
      behavior: {
        ...base.behavior,
        ...overlay.behavior,
      },
      toolSpecific: {
        ...base.toolSpecific,
        ...overlay.toolSpecific,
      },
    };
  }

  private createErrorResult(errors: ImportError[]): ImportResult {
    return {
      success: false,
      errors,
    };
  }
}

// Export singleton
export const importer = new Importer();
