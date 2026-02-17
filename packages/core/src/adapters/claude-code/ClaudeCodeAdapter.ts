/**
 * Claude Code Adapter
 *
 * Claude Code configuration format:
 * - CLAUDE.md - Main rule file (Markdown)
 * - .claude/settings.json / settings.local.json - Settings
 * - .mcp.json - MCP server configuration
 * - .claude/commands/*.md - Custom commands
 *
 * CLAUDE.md can reference other files:
 * - Use @file.md syntax to reference other rule files
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
 * Claude Code settings format
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
 * MCP JSON format
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
 * Claude Code adapter
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
   * Get capability declarations
   */
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.claudeCode();
  }

  /**
   * Get file patterns
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
   * Parse Claude Code configuration
   */
  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    let mcp: MCPConfig | undefined;
    let settings: ToolSettings | undefined;
    const commands: CommandConfig[] = [];

    // 1. Parse main rule file CLAUDE.md
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

    // 2. Parse modular rule files
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

    // 3. Parse MCP configuration
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

    // 4. Parse settings
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

    // 5. Parse commands
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

    // Build unified configuration
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
   * Generate Claude Code configuration
   */
  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    const files: GeneratedFile[] = [];

    // 1. Generate rules to .claude/rules/ and CLAUDE.md as entry point
    if (config.rules && config.rules.length > 0) {
      // Generate individual rule files
      const imports: string[] = [];

      for (const rule of config.rules) {
        if (rule.enabled !== false) {
          const ruleFileName = this.getRuleFileName(rule);
          const rulePath = `.claude/rules/${ruleFileName}`;
          files.push({
            path: rulePath,
            content: rule.content,
            encoding: 'utf-8',
            overwrite: true,
          });
          imports.push(`@${rulePath}`);
        }
      }

      // Generate CLAUDE.md as entry point with imports
      const claudeMdContent = imports.length > 0
        ? `# Project Rules\n\n${imports.join('\n')}\n`
        : '';
      files.push({
        path: 'CLAUDE.md',
        content: claudeMdContent,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    // 2. Generate MCP configuration
    if (config.mcp?.servers?.length && this.hasCapability(ConfigCapability.MCP_SERVERS)) {
      const mcpContent = this.generateMCPContent(config.mcp);
      files.push({
        path: '.mcp.json',
        content: mcpContent,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    // 3. Generate settings
    if (config.settings && this.hasCapability(ConfigCapability.SETTINGS)) {
      const settingsContent = this.generateSettingsContent(config.settings);
      files.push({
        path: '.claude/settings.json',
        content: settingsContent,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    // 4. Generate commands
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

  private getRuleFileName(rule: RuleConfig): string {
    // Use rule name or id to create a filename
    const baseName = rule.name || rule.id;
    // Sanitize filename: replace spaces and special chars with dashes
    const sanitized = baseName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `${sanitized}.md`;
  }

  /**
   * Parse from content
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
  // Private methods - CLAUDE.md parsing
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

    // Parse @ references
    const references = this.extractReferences(content);

    // Create main rule
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
    // Match @file.md or @path/to/file.md format
    const refPattern = /@([a-zA-Z0-9_\-./]+\.md)/g;
    const references: string[] = [];
    let match;

    while ((match = refPattern.exec(content)) !== null) {
      references.push(match[1]);
    }

    return references;
  }

  // ============================================
  // Private methods - Rule files
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
  // Private methods - Settings parsing
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

    // Remove undefined values
    const cleaned = Object.fromEntries(
      Object.entries(claudeSettings).filter(([_, v]) => v !== undefined)
    );

    return JSON.stringify(cleaned, null, 2);
  }

  // ============================================
  // Private methods - Commands parsing
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

      // Simple command parsing - first line as description, rest as template
      const lines = content.split('\n');
      let description: string | undefined;
      let templateStart = 0;

      if (lines[0]?.startsWith('# ')) {
        description = lines[0].slice(2).trim();
        templateStart = 1;
        // Skip empty lines
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
export const claudeCodeAdapter = new ClaudeCodeAdapter();
