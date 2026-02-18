/**
 * Windsurf Adapter
 *
 * Windsurf configuration format:
 * - .windsurfrules - Rule file (pure Markdown, no frontmatter)
 * - .windsurf/mcp.json - MCP server configuration (same format as Cursor)
 *
 * Windsurf is an AI code editor based on Codeium
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';

import { BaseAdapter } from '../base/BaseAdapter';
import type { IAdapter } from '../base/IAdapter';
import {
  ConfigCapability,
  ToolId,
  type UnifiedConfig,
  type RuleConfig,
  type MCPServerConfig,
  type MCPConfig,
  type ParseResult,
  type GenerateResult,
  type ConvertOptions,
  type FileInfo,
  type FilePattern,
  type ToolMeta,
  type CapabilityDeclaration,
  type GeneratedFile,
  type ParseError,
} from '../../core/types';
import { ToolCapabilities } from '../base/Capability';

/**
 * Windsurf MCP configuration format (same as Cursor)
 */
interface WindsurfMCPConfig {
  mcpServers: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
      disabled?: boolean;
      autoApprove?: string[];
    }
  >;
}

/**
 * Windsurf adapter
 */
export class WindsurfAdapter extends BaseAdapter implements IAdapter {
  readonly toolMeta: ToolMeta = {
    id: ToolId.WINDSURF,
    name: 'Windsurf',
    description: 'AI-powered code editor by Codeium',
    website: 'https://windsurf.com',
    repository: 'https://github.com/codeium/windsurf',
  };

  readonly version = '1.0.0';

  /**
   * Get capability declarations
   */
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.windsurf();
  }

  /**
   * Get file patterns
   */
  getFilePatterns(): FilePattern[] {
    return [
      {
        pattern: '.windsurfrules',
        type: 'optional',
        capability: ConfigCapability.RULES,
        description: 'Windsurf rule file (Markdown without frontmatter)',
      },
      {
        pattern: '.windsurf/mcp.json',
        type: 'optional',
        capability: ConfigCapability.MCP_SERVERS,
        description: 'Windsurf MCP server configuration',
      },
    ];
  }

  /**
   * Parse Windsurf configuration
   */
  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    let mcp: MCPConfig | undefined;

    // 1. Parse rule file
    const rulePath = path.join(projectRoot, '.windsurfrules');
    const ruleExists = await this.fileExists(rulePath);

    if (ruleExists) {
      const stats = await fs.stat(rulePath);
      sourceFiles.push({
        path: '.windsurfrules',
        absolutePath: rulePath,
        exists: true,
        size: stats.size,
        lastModified: stats.mtime,
      });

      const result = await this.parseRuleFile(rulePath);
      if (result.rules) {
        rules.push(...result.rules);
      }
      if (result.errors) {
        errors.push(...result.errors);
      }
    }

    // 2. Parse MCP configuration
    const mcpPath = path.join(projectRoot, '.windsurf/mcp.json');
    const mcpExists = await this.fileExists(mcpPath);

    if (mcpExists) {
      sourceFiles.push({
        path: '.windsurf/mcp.json',
        absolutePath: mcpPath,
        exists: true,
      });
      const mcpResult = await this.parseMCPFile(mcpPath);
      if (mcpResult.config) {
        mcp = mcpResult.config;
      }
      if (mcpResult.errors) {
        errors.push(...mcpResult.errors);
      }
    }

    // Build unified configuration
    const config: UnifiedConfig = {
      version: '1.0',
      sourceTool: ToolId.WINDSURF,
      rules,
      mcp,
    };

    return {
      success: errors.filter(e => !e.recoverable).length === 0,
      data: config,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        sourceFiles,
        parseTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Generate Windsurf configuration
   */
  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    const files: GeneratedFile[] = [];

    // 1. Generate rule file
    if (config.rules && config.rules.length > 0 && this.hasCapability(ConfigCapability.RULES)) {
      // Merge all rules into a single .windsurfrules file
      const content = this.generateRuleContent(config.rules);
      files.push({
        path: '.windsurfrules',
        content,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    // 2. Generate MCP configuration
    if (config.mcp?.servers?.length && this.hasCapability(ConfigCapability.MCP_SERVERS)) {
      const mcpContent = this.generateMCPContent(config.mcp);
      files.push({
        path: '.windsurf/mcp.json',
        content: mcpContent,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    return {
      success: true,
      files,
    };
  }

  /**
   * Parse from content
   */
  async parseContent(
    content: string,
    filePath: string,
    options?: ConvertOptions
  ): Promise<ParseResult> {
    // Determine file type
    if (filePath === '.windsurfrules' || filePath.endsWith('.windsurfrules')) {
      const result = await this.parseRuleContent(content, filePath);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.WINDSURF,
          rules: result.rules,
        },
        errors: result.errors,
        metadata: {
          sourceFiles: [
            {
              path: filePath,
              absolutePath: filePath,
              exists: true,
            },
          ],
          parseTime: Date.now(),
        },
      };
    }

    if (filePath.endsWith('mcp.json')) {
      const result = await this.parseMCPContent(content);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.WINDSURF,
          rules: [],
          mcp: result.config,
        },
        errors: result.errors,
        metadata: {
          sourceFiles: [
            {
              path: filePath,
              absolutePath: filePath,
              exists: true,
            },
          ],
          parseTime: Date.now(),
        },
      };
    }

    return this.createErrorResult([
      {
        code: 'UNKNOWN_FILE_TYPE',
        message: `Unknown file type: ${filePath}`,
        file: filePath,
        recoverable: false,
      },
    ]);
  }

  // ============================================
  // Private methods - Rule parsing
  // ============================================

  private async parseRuleFile(filePath: string): Promise<{
    rules: RuleConfig[];
    errors?: ParseError[];
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseRuleContent(content, filePath);
    } catch (error) {
      return {
        rules: [],
        errors: [
          {
            code: 'FILE_READ_ERROR',
            message: `Failed to read rule file: ${error instanceof Error ? error.message : String(error)}`,
            file: filePath,
            recoverable: false,
          },
        ],
      };
    }
  }

  private async parseRuleContent(
    content: string,
    filePath: string
  ): Promise<{
    rules: RuleConfig[];
    errors?: ParseError[];
  }> {
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];

    // Windsurf rule files are pure Markdown without frontmatter
    // The entire file content becomes the rule content
    const ruleName = path.basename(filePath, '.windsurfrules') || 'default';

    const rule: RuleConfig = {
      id: this.generateRuleId(ruleName),
      name: ruleName,
      content: content.trim(),
      metadata: {
        source: 'windsurf',
        originalPath: filePath,
      },
    };

    rules.push(rule);

    return { rules, errors: errors.length > 0 ? errors : undefined };
  }

  private generateRuleContent(rules: RuleConfig[]): string {
    // Windsurf uses a single .windsurfrules file
    // Multiple rules can be joined with separators, or only the first rule used
    // Here we concatenate all rule contents
    return rules
      .filter(rule => rule.enabled !== false)
      .map(rule => rule.content)
      .join('\n\n---\n\n');
  }

  private generateRuleId(name: string): string {
    return `windsurf-rule-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

  // ============================================
  // Private methods - MCP parsing
  // ============================================

  private async parseMCPFile(filePath: string): Promise<{
    config?: MCPConfig;
    errors?: ParseError[];
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseMCPContent(content);
    } catch (error) {
      return {
        errors: [
          {
            code: 'FILE_READ_ERROR',
            message: `Failed to read MCP file: ${error instanceof Error ? error.message : String(error)}`,
            file: filePath,
            recoverable: false,
          },
        ],
      };
    }
  }

  private async parseMCPContent(content: string): Promise<{
    config?: MCPConfig;
    errors?: ParseError[];
  }> {
    try {
      const windsurfMCP = JSON.parse(content) as WindsurfMCPConfig;
      const servers: MCPServerConfig[] = [];

      if (windsurfMCP.mcpServers) {
        for (const [name, server] of Object.entries(windsurfMCP.mcpServers)) {
          servers.push({
            name,
            command: server.command,
            args: server.args,
            env: server.env,
            cwd: server.cwd,
            disabled: server.disabled,
            autoApprove: server.autoApprove,
          });
        }
      }

      return {
        config: { servers },
      };
    } catch (error) {
      return {
        errors: [
          {
            code: 'JSON_PARSE_ERROR',
            message: `Failed to parse MCP JSON: ${error instanceof Error ? error.message : String(error)}`,
            recoverable: false,
          },
        ],
      };
    }
  }

  private generateMCPContent(mcp: MCPConfig): string {
    const windsurfMCP: WindsurfMCPConfig = {
      mcpServers: {},
    };

    for (const server of mcp.servers) {
      windsurfMCP.mcpServers[server.name] = {
        command: server.command,
        args: server.args,
        env: server.env,
        cwd: server.cwd,
        disabled: server.disabled,
        autoApprove: server.autoApprove,
      };
    }

    return JSON.stringify(windsurfMCP, null, 2);
  }

  // ============================================
  // Helper methods
  // ============================================

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton
export const windsurfAdapter = new WindsurfAdapter();
