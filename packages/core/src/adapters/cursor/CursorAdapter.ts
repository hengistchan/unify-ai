/**
 * Cursor Adapter
 *
 * Cursor 配置格式:
 * - .cursor/rules/*.md - 规则文件 (Markdown + frontmatter)
 * - .cursor/mcp.json - MCP 服务器配置
 * - .cursor/settings - 设置
 *
 * 规则文件 Frontmatter 格式:
 * ---
 * name: Rule Name
 * globs: ["<glob pattern>"]
 * alwaysApply: true
 * ---
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { glob } from 'glob';

import { BaseAdapter } from '../base/BaseAdapter';
import type { IAdapter } from '../base/IAdapter';
import {
  ConfigCapability,
  CapabilityLevel,
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
 * Cursor 规则 Frontmatter
 */
interface CursorRuleFrontmatter {
  name?: string;
  description?: string;
  globs?: string | string[];
  alwaysApply?: boolean;
}

/**
 * Cursor MCP 配置格式
 */
interface CursorMCPConfig {
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
 * Cursor 适配器
 */
export class CursorAdapter extends BaseAdapter implements IAdapter {
  readonly toolMeta: ToolMeta = {
    id: ToolId.CURSOR,
    name: 'Cursor',
    description: 'AI-powered code editor',
    website: 'https://cursor.sh',
    repository: 'https://github.com/getcursor/cursor',
  };

  readonly version = '1.0.0';

  /**
   * 获取能力声明
   */
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.cursor();
  }

  /**
   * 获取文件模式
   */
  getFilePatterns(): FilePattern[] {
    return [
      {
        pattern: '.cursor/rules/*.md',
        type: 'optional',
        capability: ConfigCapability.RULES,
        description: 'Cursor rule files with Markdown and frontmatter',
      },
      {
        pattern: '.cursor/mcp.json',
        type: 'optional',
        capability: ConfigCapability.MCP_SERVERS,
        description: 'Cursor MCP server configuration',
      },
      {
        pattern: '.cursor/settings',
        type: 'optional',
        capability: ConfigCapability.SETTINGS,
        description: 'Cursor settings file',
      },
    ];
  }

  /**
   * 解析 Cursor 配置
   */
  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    let mcp: MCPConfig | undefined;

    // 1. 解析规则文件
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

    // 2. 解析 MCP 配置
    const mcpPath = path.join(projectRoot, '.cursor/mcp.json');
    const mcpExists = await this.fileExists(mcpPath);
    if (mcpExists) {
      sourceFiles.push({
        path: '.cursor/mcp.json',
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
      sourceTool: ToolId.CURSOR,
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
   * 生成 Cursor 配置
   */
  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    const files: GeneratedFile[] = [];

    // 1. 生成规则文件
    if (config.rules && this.hasCapability(ConfigCapability.RULES)) {
      for (const rule of config.rules) {
        if (rule.enabled !== false) {
          const content = this.generateRuleContent(rule);
          const fileName = this.getRuleFileName(rule);
          files.push({
            path: `.cursor/rules/${fileName}`,
            content,
            encoding: 'utf-8',
            overwrite: true,
          });
        }
      }
    }

    // 2. 生成 MCP 配置
    if (config.mcp?.servers?.length && this.hasCapability(ConfigCapability.MCP_SERVERS)) {
      const mcpContent = this.generateMCPContent(config.mcp);
      files.push({
        path: '.cursor/mcp.json',
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
    if (filePath.endsWith('.md')) {
      const result = await this.parseRuleContent(content, filePath);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.CURSOR,
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
          sourceTool: ToolId.CURSOR,
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

  private async discoverRuleFiles(projectRoot: string): Promise<FileInfo[]> {
    const pattern = path.join(projectRoot, '.cursor/rules/*.md');
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
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];

    // 解析 frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    let frontmatter: CursorRuleFrontmatter = {};
    let body = content;

    if (frontmatterMatch) {
      try {
        frontmatter = yaml.parse(frontmatterMatch[1]) as CursorRuleFrontmatter;
        body = frontmatterMatch[2];
      } catch (error) {
        errors.push({
          code: 'FRONTMATTER_PARSE_ERROR',
          message: `Failed to parse frontmatter: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: true,
        });
      }
    }

    // 构建规则配置
    const ruleName = path.basename(filePath, '.md');
    const rule: RuleConfig = {
      id: this.generateRuleId(ruleName),
      name: frontmatter.name || ruleName,
      description: frontmatter.description,
      content: body.trim(),
      globs: this.normalizeGlobs(frontmatter.globs),
      alwaysApply: frontmatter.alwaysApply,
      metadata: {
        source: 'cursor',
        originalPath: filePath,
      },
    };

    rules.push(rule);

    return { rules, errors: errors.length > 0 ? errors : undefined };
  }

  private generateRuleContent(rule: RuleConfig): string {
    const frontmatter: CursorRuleFrontmatter = {
      name: rule.name,
      description: rule.description,
      globs: rule.globs,
      alwaysApply: rule.alwaysApply,
    };

    // 过滤空值
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frontmatter)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }

    const frontmatterStr = Object.keys(filtered).length > 0
      ? `---\n${yaml.stringify(filtered)}---\n\n`
      : '';

    return `${frontmatterStr}${rule.content}`;
  }

  private getRuleFileName(rule: RuleConfig): string {
    // 使用规则名称或 ID 生成文件名
    const baseName = rule.name || rule.id;
    // 清理文件名，移除特殊字符
    const safeName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `${safeName}.md`;
  }

  private generateRuleId(name: string): string {
    return `cursor-rule-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

  private normalizeGlobs(globs?: string | string[]): string[] | undefined {
    if (!globs) return undefined;
    if (typeof globs === 'string') {
      // 支持逗号分隔的字符串
      return globs.split(',').map(g => g.trim()).filter(Boolean);
    }
    return globs;
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
      const cursorMCP = JSON.parse(content) as CursorMCPConfig;
      const servers: MCPServerConfig[] = [];

      if (cursorMCP.mcpServers) {
        for (const [name, server] of Object.entries(cursorMCP.mcpServers)) {
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
    const cursorMCP: CursorMCPConfig = {
      mcpServers: {},
    };

    for (const server of mcp.servers) {
      cursorMCP.mcpServers[server.name] = {
        command: server.command,
        args: server.args,
        env: server.env,
        cwd: server.cwd,
        disabled: server.disabled,
        autoApprove: server.autoApprove,
      };
    }

    return JSON.stringify(cursorMCP, null, 2);
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
export const cursorAdapter = new CursorAdapter();
