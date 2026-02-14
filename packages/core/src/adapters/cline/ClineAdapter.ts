/**
 * Cline Adapter
 *
 * Cline configuration format:
 * - .clinerules/*.md - Rule files (Markdown, one rule per file)
 * - .cline/state.json - MCP server configuration and other state
 *
 * Rules are stored in a directory, one rule per file, with the filename as the rule name.
 * Similar to Claude Code's .claude/rules/ pattern.
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
 * Cline state.json format
 */
interface ClineState {
  mcpServers: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    disabled?: boolean;
    autoApprove?: string[];
  }>;
  [key: string]: unknown;
}

/**
 * Cline adapter
 */
export class ClineAdapter extends BaseAdapter implements IAdapter {
  readonly toolMeta: ToolMeta = {
    id: ToolId.CLINE,
    name: 'Cline',
    description: 'Autonomous coding agent for VS Code',
    website: 'https://cline.bot',
    repository: 'https://github.com/cline/cline',
  };

  readonly version = '1.0.0';

  /**
   * Get capability declarations
   */
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.cline();
  }

  /**
   * Get file patterns
   */
  getFilePatterns(): FilePattern[] {
    return [
      {
        pattern: '.clinerules/*.md',
        type: 'optional',
        capability: ConfigCapability.RULES,
        description: 'Cline rule files (Markdown)',
      },
      {
        pattern: '.cline/state.json',
        type: 'optional',
        capability: ConfigCapability.MCP_SERVERS,
        description: 'Cline state and MCP configuration',
      },
    ];
  }

  /**
   * Parse Cline configuration
   */
  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    let mcp: MCPConfig | undefined;

    // 1. Parse rule files
    const ruleFiles = await this.discoverRuleFiles(projectRoot);
    for (const fileInfo of ruleFiles) {
      sourceFiles.push(fileInfo);
      const result = await this.parseRuleFile(fileInfo.absolutePath);
      if (result.rules) {
        rules.push(...result.rules);
      }
      if (result.errors) {
        errors.push(...result.errors);
      }
    }

    // 2. Parse MCP configuration
    const statePath = path.join(projectRoot, '.cline/state.json');
    if (await this.fileExists(statePath)) {
      sourceFiles.push({
        path: '.cline/state.json',
        absolutePath: statePath,
        exists: true,
      });
      const mcpResult = await this.parseStateFile(statePath);
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
      sourceTool: ToolId.CLINE,
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
   * Generate Cline configuration
   */
  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    const files: GeneratedFile[] = [];

    // 1. Generate rule files
    if (config.rules && this.hasCapability(ConfigCapability.RULES)) {
      for (const rule of config.rules) {
        if (rule.enabled !== false) {
          const content = rule.content;
          const fileName = this.getRuleFileName(rule);
          files.push({
            path: `.clinerules/${fileName}`,
            content,
            encoding: 'utf-8',
            overwrite: true,
          });
        }
      }
    }

    // 2. Generate MCP configuration
    if (config.mcp?.servers?.length && this.hasCapability(ConfigCapability.MCP_SERVERS)) {
      // Read existing state.json to preserve other configuration
      const existingState = await this.loadExistingState('.');
      const mcpContent = this.generateStateContent(config.mcp, existingState);
      files.push({
        path: '.cline/state.json',
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
  async parseContent(content: string, filePath: string, options?: ConvertOptions): Promise<ParseResult> {
    const fileName = path.basename(filePath);

    // Determine file type
    if (filePath.endsWith('.md') || fileName.endsWith('.md')) {
      // Possibly a rule file
      const result = await this.parseRuleContent(content, filePath);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.CLINE,
          rules: result.rules,
        },
        errors: result.errors,
        metadata: {
          sourceFiles: [{
            path: filePath,
            absolutePath: filePath,
            exists: true,
          }],
          parseTime: Date.now(),
        },
      };
    }

    if (fileName === 'state.json' || filePath.includes('.cline/state.json')) {
      const result = await this.parseStateContent(content);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.CLINE,
          rules: [],
          mcp: result.config,
        },
        errors: result.errors,
        metadata: {
          sourceFiles: [{
            path: filePath,
            absolutePath: filePath,
            exists: true,
          }],
          parseTime: Date.now(),
        },
      };
    }

    return this.createErrorResult([{
      code: 'UNKNOWN_FILE_TYPE',
      message: `Unknown file type: ${filePath}`,
      file: filePath,
      recoverable: false,
    }]);
  }

  // ============================================
  // Private methods - Rule parsing
  // ============================================

  private async discoverRuleFiles(projectRoot: string): Promise<FileInfo[]> {
    const pattern = path.join(projectRoot, '.clinerules/*.md');
    const matches = await glob(pattern, { nodir: true });

    return Promise.all(matches.map(async (absolutePath) => {
      const stats = await fs.stat(absolutePath);
      return {
        path: path.relative(projectRoot, absolutePath),
        absolutePath,
        exists: true,
        size: stats.size,
        lastModified: stats.mtime,
      };
    }));
  }

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
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read rule file: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: false,
        }],
      };
    }
  }

  private async parseRuleContent(content: string, filePath: string): Promise<{
    rules: RuleConfig[];
    errors?: ParseError[];
  }> {
    const rules: RuleConfig[] = [];
    const fileName = path.basename(filePath, '.md');

    // Cline rule: filename is the rule name, content is the rule content
    const rule: RuleConfig = {
      id: this.generateRuleId(fileName),
      name: fileName,
      content: content.trim(),
      metadata: {
        source: 'cline',
        originalPath: filePath,
      },
    };

    rules.push(rule);
    return { rules };
  }

  private getRuleFileName(rule: RuleConfig): string {
    // Use rule name or ID to generate filename
    const baseName = rule.name || rule.id;
    // Sanitize filename, remove special characters
    const safeName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `${safeName}.md`;
  }

  private generateRuleId(name: string): string {
    return `cline-rule-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

  // ============================================
  // Private methods - MCP/State parsing
  // ============================================

  private async loadExistingState(targetDir: string): Promise<ClineState | null> {
    try {
      const statePath = path.join(targetDir, '.cline/state.json');
      const content = await fs.readFile(statePath, 'utf-8');
      return JSON.parse(content) as ClineState;
    } catch {
      return null;
    }
  }

  private async parseStateFile(filePath: string): Promise<{
    config?: MCPConfig;
    errors?: ParseError[];
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseStateContent(content);
    } catch (error) {
      return {
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read state file: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: false,
        }],
      };
    }
  }

  private async parseStateContent(content: string): Promise<{
    config?: MCPConfig;
    errors?: ParseError[];
  }> {
    try {
      const state = JSON.parse(content) as ClineState;
      const servers: MCPServerConfig[] = [];

      if (state.mcpServers) {
        for (const [name, server] of Object.entries(state.mcpServers)) {
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
        errors: [{
          code: 'JSON_PARSE_ERROR',
          message: `Failed to parse state JSON: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: false,
        }],
      };
    }
  }

  private generateStateContent(mcp: MCPConfig, existingState: ClineState | null): string {
    // Merge existing state with new MCP configuration
    const state: ClineState = existingState
      ? { ...existingState, mcpServers: existingState.mcpServers || {} }
      : { mcpServers: {} };

    state.mcpServers = {};
    for (const server of mcp.servers) {
      state.mcpServers[server.name] = {
        command: server.command,
        args: server.args,
        env: server.env,
        cwd: server.cwd,
        disabled: server.disabled,
        autoApprove: server.autoApprove,
      };
    }

    return JSON.stringify(state, null, 2);
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
export const clineAdapter = new ClineAdapter();
