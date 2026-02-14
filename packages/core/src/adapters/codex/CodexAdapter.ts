/**
 * Codex Adapter
 *
 * Codex configuration format:
 * - AGENTS.md - Main rule file (Markdown)
 * - .codex/config.toml - Codex configuration file (TOML)
 * - .codex/mcp.toml - MCP server configuration (TOML)
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
 * Codex MCP configuration format (TOML)
 */
interface CodexMCPConfig {
  mcpServers: Record<string, {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    disabled?: boolean;
  }>;
}

/**
 * Codex adapter
 */
export class CodexAdapter extends BaseAdapter implements IAdapter {
  readonly toolMeta: ToolMeta = {
    id: ToolId.CODEX,
    name: 'Codex',
    description: 'OpenAI AI coding assistant',
    website: 'https://codex.ai',
  };

  readonly version = '1.0.0';

  /**
   * Get capability declarations
   */
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.codex();
  }

  /**
   * Get file patterns
   */
  getFilePatterns(): FilePattern[] {
    return [
      {
        pattern: 'AGENTS.md',
        type: 'optional',
        capability: ConfigCapability.RULES,
        description: 'Codex agent instructions',
      },
      {
        pattern: '.codex/config.toml',
        type: 'optional',
        capability: ConfigCapability.SETTINGS,
        description: 'Codex configuration',
      },
      {
        pattern: '.codex/mcp.toml',
        type: 'optional',
        capability: ConfigCapability.MCP_SERVERS,
        description: 'Codex MCP configuration',
      },
    ];
  }

  /**
   * Parse Codex configuration
   */
  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    let mcp: MCPConfig | undefined;
    let settings: ToolSettings | undefined;

    // 1. Parse rule file AGENTS.md
    const agentsMdPath = path.join(projectRoot, 'AGENTS.md');
    if (await this.fileExists(agentsMdPath)) {
      sourceFiles.push({
        path: 'AGENTS.md',
        absolutePath: agentsMdPath,
        exists: true,
      });
      const result = await this.parseAgentsMd(agentsMdPath);
      if (result.rules) {
        rules.push(...result.rules);
      }
      if (result.errors) {
        errors.push(...result.errors);
      }
    }

    // 2. Parse MCP configuration
    const mcpPath = path.join(projectRoot, '.codex/mcp.toml');
    if (await this.fileExists(mcpPath)) {
      sourceFiles.push({
        path: '.codex/mcp.toml',
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

    // 3. Parse settings
    const configPath = path.join(projectRoot, '.codex/config.toml');
    if (await this.fileExists(configPath)) {
      sourceFiles.push({
        path: '.codex/config.toml',
        absolutePath: configPath,
        exists: true,
      });
      const settingsResult = await this.parseSettingsFile(configPath);
      if (settingsResult.settings) {
        settings = settingsResult.settings;
      }
      if (settingsResult.errors) {
        errors.push(...settingsResult.errors);
      }
    }

    // Build unified configuration
    const config: UnifiedConfig = {
      version: '1.0',
      sourceTool: ToolId.CODEX,
      rules,
      mcp,
      settings,
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
   * Generate Codex configuration
   */
  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    const files: GeneratedFile[] = [];

    // 1. Generate AGENTS.md
    if (config.rules && config.rules.length > 0) {
      const content = this.generateAgentsMd(config.rules);
      files.push({
        path: 'AGENTS.md',
        content,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    // 2. Generate MCP configuration
    if (config.mcp?.servers?.length && this.hasCapability(ConfigCapability.MCP_SERVERS)) {
      const mcpContent = this.generateMCPContent(config.mcp);
      files.push({
        path: '.codex/mcp.toml',
        content: mcpContent,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    // 3. Generate settings
    if (config.settings && this.hasCapability(ConfigCapability.SETTINGS)) {
      const settingsContent = this.generateSettingsContent(config.settings);
      files.push({
        path: '.codex/config.toml',
        content: settingsContent,
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

    if (fileName === 'AGENTS.md' || filePath.endsWith('.md')) {
      const result = await this.parseMarkdownContent(content, filePath);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.CODEX,
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

    if (fileName === 'mcp.toml' || filePath.endsWith('.codex/mcp.toml')) {
      const result = await this.parseMCPContent(content);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.CODEX,
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

    if (fileName === 'config.toml' || filePath.endsWith('.codex/config.toml')) {
      const result = await this.parseSettingsContent(content);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.CODEX,
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
  // Private methods - Rule parsing
  // ============================================

  private async parseAgentsMd(filePath: string): Promise<{
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
          message: `Failed to read AGENTS.md: ${error instanceof Error ? error.message : String(error)}`,
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

    // Create main rule - Codex rule files are pure Markdown
    const rule: RuleConfig = {
      id: this.generateRuleId(fileName),
      name: fileName === 'AGENTS' ? 'Project Instructions' : fileName,
      content: content.trim(),
      metadata: {
        source: 'codex',
        originalPath: filePath,
      },
    };

    rules.push(rule);
    return { rules };
  }

  private generateAgentsMd(rules: RuleConfig[]): string {
    const sections: string[] = [];

    // If there's only one rule, output its content directly
    if (rules.length === 1) {
      return rules[0].content;
    }

    // Multiple rules: combine into a single document
    for (const rule of rules) {
      if (rule.enabled !== false) {
        sections.push(`## ${rule.name || rule.id}\n\n${rule.content}`);
      }
    }

    return sections.join('\n\n---\n\n');
  }

  private generateRuleId(name: string): string {
    return `codex-rule-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

  // ============================================
  // Private methods - TOML parsing
  // ============================================

  /**
   * Simple TOML parser
   * Supports: strings, numbers, booleans, arrays, tables
   */
  private parseTOML(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = content.split('\n');
    let currentTable: Record<string, unknown> = result;
    let currentTablePath: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }

      // Table header [table.name]
      const tableMatch = line.match(/^\[([^\]]+)\]$/);
      if (tableMatch) {
        const tablePath = tableMatch[1].split('.');
        currentTablePath = tablePath;

        // Create nested object
        let obj = result;
        for (const key of tablePath) {
          if (!obj[key]) {
            obj[key] = {};
          }
          obj = obj[key] as Record<string, unknown>;
        }
        currentTable = obj;
        continue;
      }

      // Key-value pair key = value
      const keyValueMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*=\s*(.*)$/);
      if (keyValueMatch) {
        const key = keyValueMatch[1];
        const value = this.parseTOMLValue(keyValueMatch[2]);
        currentTable[key] = value;
      }
    }

    return result;
  }

  private parseTOMLValue(valueStr: string): unknown {
    valueStr = valueStr.trim();

    // Strings
    if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
      return valueStr.slice(1, -1);
    }
    if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
      return valueStr.slice(1, -1);
    }

    // Booleans
    if (valueStr === 'true') return true;
    if (valueStr === 'false') return false;

    // Numbers
    const num = Number(valueStr);
    if (!isNaN(num)) return num;

    // Arrays
    if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
      const arrayStr = valueStr.slice(1, -1).trim();
      if (!arrayStr) return [];

      const items: unknown[] = [];
      // Simple parsing - split by comma
      const parts = this.splitTOMLArray(arrayStr);
      for (const part of parts) {
        items.push(this.parseTOMLValue(part));
      }
      return items;
    }

    return valueStr;
  }

  private splitTOMLArray(str: string): string[] {
    const items: string[] = [];
    let current = '';
    let inString = false;
    let depth = 0;

    for (const char of str) {
      if (char === '"' && (current.length === 0 || current[current.length - 1] !== '\\')) {
        inString = !inString;
        current += char;
      } else if (!inString && char === '[') {
        depth++;
        current += char;
      } else if (!inString && char === ']') {
        depth--;
        current += char;
      } else if (!inString && depth === 0 && char === ',') {
        items.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      items.push(current.trim());
    }

    return items;
  }

  /**
   * Generate simple TOML
   */
  private generateTOML(obj: Record<string, unknown>, prefix = ''): string {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;

      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value === null) {
        lines.push(`${key} = ""`);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        lines.push(`[${fullKey}]`);
        lines.push(this.generateTOML(value as Record<string, unknown>));
      } else if (Array.isArray(value)) {
        lines.push(`${key} = ${this.generateTOMLArray(value)}`);
      } else if (typeof value === 'string') {
        lines.push(`${key} = "${value}"`);
      } else if (typeof value === 'boolean') {
        lines.push(`${key} = ${value}`);
      } else if (typeof value === 'number') {
        lines.push(`${key} = ${value}`);
      } else {
        lines.push(`${key} = "${String(value)}"`);
      }
    }

    return lines.join('\n');
  }

  private generateTOMLArray(arr: unknown[]): string {
    const items = arr.map(item => {
      if (typeof item === 'string') {
        return `"${item}"`;
      }
      if (typeof item === 'number' || typeof item === 'boolean') {
        return String(item);
      }
      return `"${String(item)}"`;
    });
    return `[${items.join(', ')}]`;
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
      const raw = this.parseTOML(content);
      const toml = (raw as unknown as { mcpServers?: CodexMCPConfig['mcpServers'] }) || { mcpServers: {} };
      const servers: MCPServerConfig[] = [];

      if (toml.mcpServers) {
        for (const [name, server] of Object.entries(toml.mcpServers)) {
          const serverConfig = server as { command?: string; args?: string[]; env?: Record<string, string>; url?: string; disabled?: boolean };
          servers.push({
            name,
            command: serverConfig.command || '',
            args: serverConfig.args,
            env: serverConfig.env,
            disabled: serverConfig.disabled,
            metadata: serverConfig.url ? { url: serverConfig.url } : undefined,
          });
        }
      }

      return { config: { servers } };
    } catch (error) {
      return {
        errors: [{
          code: 'TOML_PARSE_ERROR',
          message: `Failed to parse TOML: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: false,
        }],
      };
    }
  }

  private generateMCPContent(mcp: MCPConfig): string {
    const mcpToml: CodexMCPConfig = {
      mcpServers: {},
    };

    for (const server of mcp.servers) {
      const serverConfig: { command?: string; args?: string[]; env?: Record<string, string>; url?: string; disabled?: boolean } = {
        command: server.command,
        args: server.args,
        env: server.env,
        disabled: server.disabled,
      };
      // Add url from metadata if present
      if (server.metadata && typeof server.metadata === 'object' && 'url' in server.metadata) {
        serverConfig.url = server.metadata.url as string;
      }
      mcpToml.mcpServers[server.name] = serverConfig;
    }

    return this.generateTOML(mcpToml as unknown as Record<string, unknown>);
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
      const toml = this.parseTOML(content);

      const settings: ToolSettings = {
        toolSpecific: {},
      };

      // Codex-specific configuration items
      if (toml.model) {
        (settings.toolSpecific as Record<string, unknown>).model = toml.model;
      }
      if (toml.temperature) {
        (settings.toolSpecific as Record<string, unknown>).temperature = toml.temperature;
      }
      if (toml.maxTokens) {
        (settings.toolSpecific as Record<string, unknown>).maxTokens = toml.maxTokens;
      }
      if (toml.apiBaseUrl) {
        (settings.toolSpecific as Record<string, unknown>).apiBaseUrl = toml.apiBaseUrl;
      }

      return { settings };
    } catch (error) {
      return {
        errors: [{
          code: 'TOML_PARSE_ERROR',
          message: `Failed to parse TOML: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: true,
        }],
      };
    }
  }

  private generateSettingsContent(settings: ToolSettings): string {
    const tomlObj: Record<string, unknown> = {};

    // Add tool-specific settings
    if (settings.toolSpecific) {
      for (const [key, value] of Object.entries(settings.toolSpecific)) {
        if (value !== undefined) {
          tomlObj[key] = value;
        }
      }
    }

    return this.generateTOML(tomlObj);
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
export const codexAdapter = new CodexAdapter();
