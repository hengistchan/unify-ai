/**
 * OpenCode Adapter
 *
 * OpenCode configuration format:
 * - opencode.json / opencode.jsonc - Main JSON config file
 * - .opencode/ - Directory for agents, commands, skills, tools, themes
 *
 * Supported capabilities:
 * - Rules: instructions array in JSON
 * - MCP: mcpServers object in JSON
 * - Settings: Various settings in JSON
 */

import { promises as fs } from 'fs';
import * as path from 'path';

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
 * OpenCode config.json structure
 */
interface OpenCodeConfig {
  $schema?: string;
  theme?: string;
  model?: string;
  small_model?: string;
  provider?: Record<string, unknown>;
  autoupdate?: boolean | 'notify';
  default_agent?: string;
  share?: 'manual' | 'auto' | 'disabled';
  instructions?: string[];
  disabled_providers?: string[];
  enabled_providers?: string[];
  mcp?: Record<string, unknown>;
  agent?: Record<string, unknown>;
  command?: Record<string, unknown>;
  keybinds?: Record<string, unknown>;
  formatter?: Record<string, unknown>;
  permission?: Record<string, unknown>;
  compaction?: Record<string, unknown>;
  watcher?: Record<string, unknown>;
  plugin?: string | string[];
  experimental?: Record<string, unknown>;
  tui?: Record<string, unknown>;
  server?: Record<string, unknown>;
}

/**
 * Adapter for OpenCode
 */
export class OpenCodeAdapter extends BaseAdapter implements IAdapter {
  readonly toolMeta: ToolMeta = {
    id: ToolId.OPENCODE,
    name: 'OpenCode',
    description: 'Open source AI coding agent',
    website: 'https://opencode.ai',
    repository: 'https://github.com/anomalyco/opencode',
  };

  readonly version = '1.0.0';

  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.opencode();
  }

  getFilePatterns(): FilePattern[] {
    return [
      {
        pattern: 'opencode.json',
        type: 'optional',
        capability: ConfigCapability.SETTINGS,
        description: 'OpenCode configuration',
      },
      {
        pattern: 'opencode.jsonc',
        type: 'optional',
        capability: ConfigCapability.SETTINGS,
        description: 'OpenCode configuration (with comments)',
      },
    ];
  }

  async parse(projectRoot: string, _options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    let config: OpenCodeConfig = {};

    const configFile = await this.findConfigFile(projectRoot, ['opencode.json', 'opencode.jsonc']);

    if (configFile) {
      try {
        const content = await fs.readFile(configFile, 'utf-8');
        config = this.parseJsonWithComments(content);
        sourceFiles.push({
          path: path.relative(projectRoot, configFile),
          absolutePath: configFile,
          exists: true,
        });
      } catch (error) {
        errors.push({
          code: 'PARSE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to read config',
          file: configFile,
          recoverable: true,
        });
      }
    }

    const rules: RuleConfig[] = [];
    const mcpServers: MCPServerConfig[] = [];

    if (config.instructions && Array.isArray(config.instructions)) {
      for (const instruction of config.instructions) {
        const rulePath = path.join(projectRoot, instruction);
        try {
          const content = await fs.readFile(rulePath, 'utf-8');
          const ruleId = this.generateRuleId(instruction);
          rules.push({
            id: ruleId,
            name: path.basename(instruction, path.extname(instruction)),
            content,
            enabled: true,
            metadata: {
              source: 'opencode',
              path: instruction,
            },
          });
          sourceFiles.push({
            path: path.relative(projectRoot, rulePath),
            absolutePath: rulePath,
            exists: true,
          });
        } catch {
          // File doesn't exist, skip
        }
      }
    }

    if (config.mcp && typeof config.mcp === 'object') {
      for (const [name, serverConfig] of Object.entries(config.mcp)) {
        const mcpConfig = serverConfig as Record<string, unknown>;
        if (typeof mcpConfig === 'object' && mcpConfig !== null) {
          mcpServers.push({
            name,
            command: String(mcpConfig.command || ''),
            args: Array.isArray(mcpConfig.args) ? mcpConfig.args.map(String) : undefined,
            env:
              typeof mcpConfig.env === 'object'
                ? (mcpConfig.env as Record<string, string>)
                : undefined,
            cwd: mcpConfig.cwd ? String(mcpConfig.cwd) : undefined,
            disabled: mcpConfig.enabled === true,
            metadata: {
              source: 'opencode',
              type: mcpConfig.type ? String(mcpConfig.type) : undefined,
              url: mcpConfig.url ? String(mcpConfig.url) : undefined,
            },
          });
        }
      }
    }

    const unifiedConfig: UnifiedConfig = {
      version: '1.0',
      rules,
      mcp: {
        servers: mcpServers,
      },
    };

    return {
      success: errors.filter(e => !e.recoverable).length === 0,
      data: unifiedConfig,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        sourceFiles,
        toolVersion: this.version,
        parseTime: Date.now() - startTime,
      },
    };
  }

  async generate(config: UnifiedConfig, _options?: ConvertOptions): Promise<GenerateResult> {
    const generatedFiles: GeneratedFile[] = [];

    const rules = config.rules || [];
    const mcpConfig = config.mcp?.servers || [];

    const instructions: string[] = [];
    const rulesContent: Record<string, string> = {};

    for (const rule of rules) {
      if (rule.metadata?.source === 'opencode') {
        const rulePath = rule.metadata?.path as string | undefined;
        if (rulePath) {
          instructions.push(rulePath);
          rulesContent[rulePath] = rule.content;
        }
      }
    }

    const mcpServers: Record<string, unknown> = {};
    for (const server of mcpConfig) {
      const serverConfig: Record<string, unknown> = {
        command: server.command,
      };
      if (server.args && server.args.length > 0) {
        serverConfig.args = server.args;
      }
      if (server.env && Object.keys(server.env).length > 0) {
        serverConfig.env = server.env;
      }
      if (server.cwd) {
        serverConfig.cwd = server.cwd;
      }
      if (server.disabled) {
        serverConfig.disabled = true;
      }
      if (server.metadata?.type) {
        serverConfig.type = server.metadata.type;
      }
      if (server.metadata?.url) {
        serverConfig.url = server.metadata.url;
      }
      mcpServers[server.name] = serverConfig;
    }

    const opencodeConfig: OpenCodeConfig = {
      $schema: 'https://opencode.ai/config.json',
      model: 'anthropic/claude-sonnet-4-5',
      autoupdate: true,
    };

    if (instructions.length > 0) {
      opencodeConfig.instructions = instructions;
    }

    if (Object.keys(mcpServers).length > 0) {
      opencodeConfig.mcp = mcpServers;
    }

    const configJson = JSON.stringify(opencodeConfig, null, 2);
    generatedFiles.push({
      path: 'opencode.json',
      content: configJson,
      encoding: 'utf-8',
      overwrite: true,
    });

    for (const [rulePath, ruleContent] of Object.entries(rulesContent)) {
      generatedFiles.push({
        path: rulePath,
        content: ruleContent,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    return {
      success: true,
      files: generatedFiles,
    };
  }

  private parseJsonWithComments(content: string): OpenCodeConfig {
    const withoutComments = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    try {
      return JSON.parse(withoutComments);
    } catch {
      return {};
    }
  }

  private generateRuleId(filePath: string): string {
    const name = path.basename(filePath, path.extname(filePath));
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `opencode-rule-${safeName}`;
  }

  private async findConfigFile(projectRoot: string, fileNames: string[]): Promise<string | null> {
    for (const fileName of fileNames) {
      const filePath = path.join(projectRoot, fileName);
      try {
        await fs.access(filePath);
        return filePath;
      } catch {
        continue;
      }
    }
    return null;
  }
}

export const opencodeAdapter = new OpenCodeAdapter();
