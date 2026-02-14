/**
 * Windsurf Adapter
 *
 * Windsurf 配置格式:
 * - .windsurfrules - 规则文件 (纯 Markdown，无 frontmatter)
 * - .windsurf/mcp.json - MCP 服务器配置 (与 Cursor 相同格式)
 *
 * Windsurf 是基于 Codeium 的 AI 代码编辑器
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
 * Windsurf MCP 配置格式 (与 Cursor 相同)
 */
interface WindsurfMCPConfig {
  mcpServers: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    disabled?: boolean;
    autoApprove?: string[];
  }>;
}

/**
 * Windsurf 适配器
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
   * 获取能力声明
   */
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.windsurf();
  }

  /**
   * 获取文件模式
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
   * 解析 Windsurf 配置
   */
  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    let mcp: MCPConfig | undefined;

    // 1. 解析规则文件
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

    // 2. 解析 MCP 配置
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

    // 构建统一配置
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
   * 生成 Windsurf 配置
   */
  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    const files: GeneratedFile[] = [];

    // 1. 生成规则文件
    if (config.rules && config.rules.length > 0 && this.hasCapability(ConfigCapability.RULES)) {
      // 将所有规则合并为一个 .windsurfrules 文件
      const content = this.generateRuleContent(config.rules);
      files.push({
        path: '.windsurfrules',
        content,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    // 2. 生成 MCP 配置
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
   * 从内容解析
   */
  async parseContent(content: string, filePath: string, options?: ConvertOptions): Promise<ParseResult> {
    // 判断文件类型
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
          sourceFiles: [{
            path: filePath,
            absolutePath: filePath,
            exists: true,
          }],
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
  // 私有方法 - 规则解析
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
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];

    // Windsurf 规则文件是纯 Markdown，没有 frontmatter
    // 整个文件内容作为规则内容
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
    // Windsurf 使用单个 .windsurfrules 文件
    // 可以将多个规则用分隔符连接，或者只取第一个规则
    // 这里我们将所有规则内容连接起来
    return rules
      .filter(rule => rule.enabled !== false)
      .map(rule => rule.content)
      .join('\n\n---\n\n');
  }

  private generateRuleId(name: string): string {
    return `windsurf-rule-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

  // ============================================
  // 私有方法 - MCP 解析
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
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read MCP file: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: false,
        }],
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
        errors: [{
          code: 'JSON_PARSE_ERROR',
          message: `Failed to parse MCP JSON: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: false,
        }],
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
  // 辅助方法
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

// 导出单例
export const windsurfAdapter = new WindsurfAdapter();
