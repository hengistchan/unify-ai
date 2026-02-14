/**
 * Claude Code Adapter
 *
 * Claude Code 配置格式:
 * - CLAUDE.md - 主要规则文件 (Markdown)
 * - .claude/settings.json / settings.local.json - 设置
 * - .mcp.json - MCP 服务器配置
 * - .claude/commands/*.md - 自定义命令
 *
 * CLAUDE.md 可以引用其他文件:
 * - 使用 @file.md 语法引用其他规则文件
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
  type ToolSettings,
  type CommandConfig,
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
 * Claude Code 设置格式
 */
interface ClaudeCodeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  enableAllProjectMcpServers?: boolean;
  enabledMcpjsonServers?: string[];
  env?: Record<string, string>;
}

/**
 * MCP JSON 格式
 */
interface MCPJsonConfig {
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
 * Claude Code 适配器
 */
export class ClaudeCodeAdapter extends BaseAdapter implements IAdapter {
  readonly toolMeta: ToolMeta = {
    id: ToolId.CLAUDE_CODE,
    name: 'Claude Code',
    description: 'Anthropic official AI coding assistant',
    website: 'https://claude.ai/code',
  };

  readonly version = '1.0.0';

  /**
   * 获取能力声明
   */
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.claudeCode();
  }

  /**
   * 获取文件模式
   */
  getFilePatterns(): FilePattern[] {
    return [
      {
        pattern: 'CLAUDE.md',
        type: 'optional',
        capability: ConfigCapability.RULES,
        description: 'Main Claude Code instructions file',
      },
      {
        pattern: '.claude/rules/*.md',
        type: 'optional',
        capability: ConfigCapability.RULES,
        description: 'Claude Code modular rules',
      },
      {
        pattern: '.claude/settings.json',
        type: 'optional',
        capability: ConfigCapability.SETTINGS,
        description: 'Claude Code project settings',
      },
      {
        pattern: '.claude/settings.local.json',
        type: 'optional',
        capability: ConfigCapability.SETTINGS,
        description: 'Claude Code local settings (git-ignored)',
      },
      {
        pattern: '.mcp.json',
        type: 'optional',
        capability: ConfigCapability.MCP_SERVERS,
        description: 'MCP server configuration',
      },
      {
        pattern: '.claude/commands/*.md',
        type: 'optional',
        capability: ConfigCapability.COMMANDS,
        description: 'Custom slash commands',
      },
    ];
  }

  /**
   * 解析 Claude Code 配置
   */
  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    let mcp: MCPConfig | undefined;
    let settings: ToolSettings | undefined;
    const commands: CommandConfig[] = [];

    // 1. 解析主规则文件 CLAUDE.md
    const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
    if (await this.fileExists(claudeMdPath)) {
      sourceFiles.push({
        path: 'CLAUDE.md',
        absolutePath: claudeMdPath,
        exists: true,
      });
      const result = await this.parseClaudeMd(claudeMdPath);
      if (result.rules) {
        rules.push(...result.rules);
      }
      if (result.errors) {
        errors.push(...result.errors);
      }
    }

    // 2. 解析模块化规则文件
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

    // 3. 解析 MCP 配置
    const mcpPath = path.join(projectRoot, '.mcp.json');
    if (await this.fileExists(mcpPath)) {
      sourceFiles.push({
        path: '.mcp.json',
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

    // 4. 解析设置
    const settingsPaths = [
      path.join(projectRoot, '.claude/settings.json'),
      path.join(projectRoot, '.claude/settings.local.json'),
    ];

    for (const settingsPath of settingsPaths) {
      if (await this.fileExists(settingsPath)) {
        sourceFiles.push({
          path: path.relative(projectRoot, settingsPath),
          absolutePath: settingsPath,
          exists: true,
        });
        const settingsResult = await this.parseSettingsFile(settingsPath);
        if (settingsResult.settings) {
          settings = settings ? this.mergeSettings(settings, settingsResult.settings) : settingsResult.settings;
        }
        if (settingsResult.errors) {
          errors.push(...settingsResult.errors);
        }
      }
    }

    // 5. 解析命令
    const commandFiles = await this.discoverCommandFiles(projectRoot);
    for (const fileInfo of commandFiles) {
      sourceFiles.push(fileInfo);
      const result = await this.parseCommandFile(fileInfo.absolutePath);
      if (result.command) {
        commands.push(result.command);
      }
      if (result.errors) {
        errors.push(...result.errors);
      }
    }

    // 构建统一配置
    const config: UnifiedConfig = {
      version: '1.0',
      sourceTool: ToolId.CLAUDE_CODE,
      rules,
      mcp,
      settings,
      commands: commands.length > 0 ? commands : undefined,
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
   * 生成 Claude Code 配置
   */
  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    const files: GeneratedFile[] = [];

    // 1. 生成 CLAUDE.md
    if (config.rules && config.rules.length > 0) {
      const content = this.generateClaudeMd(config.rules);
      files.push({
        path: 'CLAUDE.md',
        content,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    // 2. 生成 MCP 配置
    if (config.mcp?.servers?.length && this.hasCapability(ConfigCapability.MCP_SERVERS)) {
      const mcpContent = this.generateMCPContent(config.mcp);
      files.push({
        path: '.mcp.json',
        content: mcpContent,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    // 3. 生成设置
    if (config.settings && this.hasCapability(ConfigCapability.SETTINGS)) {
      const settingsContent = this.generateSettingsContent(config.settings);
      files.push({
        path: '.claude/settings.json',
        content: settingsContent,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    // 4. 生成命令
    if (config.commands?.length && this.hasCapability(ConfigCapability.COMMANDS)) {
      for (const command of config.commands) {
        const content = this.generateCommandContent(command);
        files.push({
          path: `.claude/commands/${command.name}.md`,
          content,
          encoding: 'utf-8',
          overwrite: true,
        });
      }
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
    const fileName = path.basename(filePath);

    if (fileName === 'CLAUDE.md' || filePath.endsWith('.md')) {
      const result = await this.parseMarkdownContent(content, filePath);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.CLAUDE_CODE,
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

    if (fileName === '.mcp.json' || fileName === 'mcp.json') {
      const result = await this.parseMCPContent(content);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.CLAUDE_CODE,
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

    if (fileName.includes('settings')) {
      const result = await this.parseSettingsContent(content);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.CLAUDE_CODE,
          rules: [],
          settings: result.settings,
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
  // 私有方法 - CLAUDE.md 解析
  // ============================================

  private async parseClaudeMd(filePath: string): Promise<{
    rules: RuleConfig[];
    errors?: ParseError[];
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseMarkdownContent(content, filePath);
    } catch (error) {
      return {
        rules: [],
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read CLAUDE.md: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: false,
        }],
      };
    }
  }

  private async parseMarkdownContent(content: string, filePath: string): Promise<{
    rules: RuleConfig[];
    errors?: ParseError[];
  }> {
    const rules: RuleConfig[] = [];
    const fileName = path.basename(filePath, '.md');

    // 解析 @ 引用
    const references = this.extractReferences(content);

    // 创建主规则
    const rule: RuleConfig = {
      id: this.generateRuleId(fileName),
      name: fileName === 'CLAUDE' ? 'Project Instructions' : fileName,
      content: content.trim(),
      metadata: {
        source: 'claude-code',
        originalPath: filePath,
        references,
      },
    };

    rules.push(rule);
    return { rules };
  }

  private extractReferences(content: string): string[] {
    // 匹配 @file.md 或 @path/to/file.md 格式
    const refPattern = /@([a-zA-Z0-9_\-./]+\.md)/g;
    const references: string[] = [];
    let match;

    while ((match = refPattern.exec(content)) !== null) {
      references.push(match[1]);
    }

    return references;
  }

  private generateClaudeMd(rules: RuleConfig[]): string {
    const sections: string[] = [];

    // 如果只有一个规则，直接输出内容
    if (rules.length === 1) {
      return rules[0].content;
    }

    // 多个规则合并为一个文档
    for (const rule of rules) {
      if (rule.enabled !== false) {
        sections.push(`## ${rule.name || rule.id}\n\n${rule.content}`);
      }
    }

    return sections.join('\n\n---\n\n');
  }

  // ============================================
  // 私有方法 - 规则文件
  // ============================================

  private async discoverRuleFiles(projectRoot: string): Promise<FileInfo[]> {
    const pattern = path.join(projectRoot, '.claude/rules/*.md');
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
      const fileName = path.basename(filePath, '.md');

      const rule: RuleConfig = {
        id: this.generateRuleId(fileName),
        name: fileName,
        content: content.trim(),
        metadata: {
          source: 'claude-code',
          originalPath: filePath,
        },
      };

      return { rules: [rule] };
    } catch (error) {
      return {
        rules: [],
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read rule file: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: true,
        }],
      };
    }
  }

  private generateRuleId(name: string): string {
    return `claude-rule-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
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
      const mcpJson = JSON.parse(content) as MCPJsonConfig;
      const servers: MCPServerConfig[] = [];

      if (mcpJson.mcpServers) {
        for (const [name, server] of Object.entries(mcpJson.mcpServers)) {
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

      return { config: { servers } };
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
    const mcpJson: MCPJsonConfig = {
      mcpServers: {},
    };

    for (const server of mcp.servers) {
      mcpJson.mcpServers[server.name] = {
        command: server.command,
        args: server.args,
        env: server.env,
        cwd: server.cwd,
        disabled: server.disabled,
        autoApprove: server.autoApprove,
      };
    }

    return JSON.stringify(mcpJson, null, 2);
  }

  // ============================================
  // 私有方法 - 设置解析
  // ============================================

  private async parseSettingsFile(filePath: string): Promise<{
    settings?: ToolSettings;
    errors?: ParseError[];
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseSettingsContent(content);
    } catch (error) {
      return {
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read settings file: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: true,
        }],
      };
    }
  }

  private async parseSettingsContent(content: string): Promise<{
    settings?: ToolSettings;
    errors?: ParseError[];
  }> {
    try {
      const claudeSettings = JSON.parse(content) as ClaudeCodeSettings;

      const settings: ToolSettings = {
        permissions: claudeSettings.permissions,
        toolSpecific: {
          enableAllProjectMcpServers: claudeSettings.enableAllProjectMcpServers,
          enabledMcpjsonServers: claudeSettings.enabledMcpjsonServers,
          env: claudeSettings.env,
        },
      };

      return { settings };
    } catch (error) {
      return {
        errors: [{
          code: 'JSON_PARSE_ERROR',
          message: `Failed to parse settings JSON: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: true,
        }],
      };
    }
  }

  private mergeSettings(base: ToolSettings, overlay: ToolSettings): ToolSettings {
    return {
      ...base,
      ...overlay,
      permissions: {
        ...base.permissions,
        ...overlay.permissions,
        allow: [...(base.permissions?.allow || []), ...(overlay.permissions?.allow || [])],
        deny: [...(base.permissions?.deny || []), ...(overlay.permissions?.deny || [])],
      },
      toolSpecific: {
        ...base.toolSpecific,
        ...overlay.toolSpecific,
      },
    };
  }

  private generateSettingsContent(settings: ToolSettings): string {
    const claudeSettings: ClaudeCodeSettings = {
      permissions: settings.permissions,
      enableAllProjectMcpServers: settings.toolSpecific?.enableAllProjectMcpServers as boolean,
      enabledMcpjsonServers: settings.toolSpecific?.enabledMcpjsonServers as string[],
      env: settings.toolSpecific?.env as Record<string, string>,
    };

    // 移除 undefined 值
    const cleaned = Object.fromEntries(
      Object.entries(claudeSettings).filter(([_, v]) => v !== undefined)
    );

    return JSON.stringify(cleaned, null, 2);
  }

  // ============================================
  // 私有方法 - 命令解析
  // ============================================

  private async discoverCommandFiles(projectRoot: string): Promise<FileInfo[]> {
    const pattern = path.join(projectRoot, '.claude/commands/*.md');
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

  private async parseCommandFile(filePath: string): Promise<{
    command?: CommandConfig;
    errors?: ParseError[];
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath, '.md');

      // 简单的命令解析 - 第一行作为描述，其余作为模板
      const lines = content.split('\n');
      let description: string | undefined;
      let templateStart = 0;

      if (lines[0]?.startsWith('# ')) {
        description = lines[0].slice(2).trim();
        templateStart = 1;
        // 跳过空行
        while (templateStart < lines.length && lines[templateStart].trim() === '') {
          templateStart++;
        }
      }

      const template = lines.slice(templateStart).join('\n').trim();

      const command: CommandConfig = {
        id: `claude-cmd-${fileName}`,
        name: fileName,
        description,
        template,
      };

      return { command };
    } catch (error) {
      return {
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read command file: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: true,
        }],
      };
    }
  }

  private generateCommandContent(command: CommandConfig): string {
    const parts: string[] = [];

    if (command.description) {
      parts.push(`# ${command.description}`);
      parts.push('');
    }

    parts.push(command.template);

    return parts.join('\n');
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
export const claudeCodeAdapter = new ClaudeCodeAdapter();
