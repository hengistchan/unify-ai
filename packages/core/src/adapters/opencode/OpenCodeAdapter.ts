/**
 * OpenCode Adapter
 *
 * OpenCode configuration format:
 * - opencode.json / opencode.jsonc - Main JSON config file
 * - AGENTS.md - Primary rules file (project root)
 * - CLAUDE.md - Fallback rules file (Claude Code compatibility)
 * - ~/.config/opencode/AGENTS.md - Global rules
 *
 * Supported capabilities:
 * - Rules: AGENTS.md (primary), CLAUDE.md (fallback), instructions array references
 * - MCP: mcp object with local/remote type support
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

interface OpenCodeLocalMCP {
  type: 'local';
  command: string[];
  enabled?: boolean;
  environment?: Record<string, string>;
}

interface OpenCodeRemoteMCP {
  type: 'remote';
  url: string;
  enabled?: boolean;
  headers?: Record<string, string>;
}

type OpenCodeMCPConfig = OpenCodeLocalMCP | OpenCodeRemoteMCP;

interface OpenCodeCommandConfig {
  template: string;
  description?: string;
  agent?: string;
  subtask?: boolean;
  model?: string;
}

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
  mcp?: Record<string, OpenCodeMCPConfig>;
  agent?: Record<string, unknown>;
  command?: Record<string, OpenCodeCommandConfig>;
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
      {
        pattern: 'AGENTS.md',
        type: 'optional',
        capability: ConfigCapability.RULES,
        description: 'OpenCode rules file (primary)',
      },
      {
        pattern: '.opencode/commands/*.md',
        type: 'optional',
        capability: ConfigCapability.COMMANDS,
        description: 'OpenCode custom commands',
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
    const commands: CommandConfig[] = [];

    const agentsMdPath = path.join(projectRoot, 'AGENTS.md');
    const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');

    let hasPrimaryRules = false;
    try {
      const content = await fs.readFile(agentsMdPath, 'utf-8');
      rules.push({
        id: 'opencode-agents',
        name: 'AGENTS.md',
        content,
        enabled: true,
        metadata: {
          source: 'opencode',
          path: 'AGENTS.md',
          primary: true,
        },
      });
      sourceFiles.push({
        path: 'AGENTS.md',
        absolutePath: agentsMdPath,
        exists: true,
      });
      hasPrimaryRules = true;
    } catch {
      // AGENTS.md doesn't exist
    }

    if (!hasPrimaryRules) {
      try {
        const content = await fs.readFile(claudeMdPath, 'utf-8');
        rules.push({
          id: 'opencode-claude-compat',
          name: 'CLAUDE.md',
          content,
          enabled: true,
          metadata: {
            source: 'opencode',
            path: 'CLAUDE.md',
            primary: true,
            compatibility: 'claude-code',
          },
        });
        sourceFiles.push({
          path: 'CLAUDE.md',
          absolutePath: claudeMdPath,
          exists: true,
        });
      } catch {
        // CLAUDE.md doesn't exist
      }
    }

    if (config.instructions && Array.isArray(config.instructions)) {
      for (const instruction of config.instructions) {
        if (instruction === 'AGENTS.md' || instruction === 'CLAUDE.md') {
          continue;
        }
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
        if (typeof serverConfig !== 'object' || serverConfig === null) {
          continue;
        }

        const mcpType = serverConfig.type;

        if (mcpType === 'local') {
          const localConfig = serverConfig as OpenCodeLocalMCP;
          const commandArray = localConfig.command || [];
          mcpServers.push({
            name,
            command: commandArray[0] || '',
            args: commandArray.length > 1 ? commandArray.slice(1) : undefined,
            env: localConfig.environment,
            disabled: localConfig.enabled === false,
            metadata: {
              source: 'opencode',
              type: 'local',
            },
          });
        } else if (mcpType === 'remote') {
          const remoteConfig = serverConfig as OpenCodeRemoteMCP;
          mcpServers.push({
            name,
            command: '',
            disabled: remoteConfig.enabled === false,
            metadata: {
              source: 'opencode',
              type: 'remote',
              url: remoteConfig.url,
              headers: remoteConfig.headers,
            },
          });
        }
      }
    }

    if (config.command && typeof config.command === 'object') {
      for (const [name, cmdConfig] of Object.entries(config.command)) {
        if (typeof cmdConfig !== 'object' || cmdConfig === null) {
          continue;
        }
        commands.push({
          id: `opencode-cmd-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name,
          description: cmdConfig.description,
          template: cmdConfig.template || '',
          enabled: true,
        });
      }
    }

    const commandsDir = path.join(projectRoot, '.opencode', 'commands');
    try {
      const commandFiles = await fs.readdir(commandsDir);
      for (const file of commandFiles) {
        if (!file.endsWith('.md')) {
          continue;
        }
        const filePath = path.join(commandsDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const parsed = this.parseCommandMarkdown(content, file);
          if (parsed) {
            commands.push(parsed);
            sourceFiles.push({
              path: path.relative(projectRoot, filePath),
              absolutePath: filePath,
              exists: true,
            });
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Commands directory doesn't exist
    }

    const unifiedConfig: UnifiedConfig = {
      version: '1.0',
      rules,
      mcp: {
        servers: mcpServers,
      },
      commands: commands.length > 0 ? commands : undefined,
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
    const commands = config.commands || [];

    const instructions: string[] = [];
    let primaryRuleContent: string | null = null;
    let primaryRulePath = 'AGENTS.md';

    for (const rule of rules) {
      if (rule.metadata?.primary === true) {
        primaryRuleContent = rule.content;
        primaryRulePath = (rule.metadata?.path as string) || 'AGENTS.md';
      } else if (rule.metadata?.path && typeof rule.metadata.path === 'string') {
        const rulePath = rule.metadata.path;
        instructions.push(rulePath);
        generatedFiles.push({
          path: rulePath,
          content: rule.content,
          encoding: 'utf-8',
          overwrite: true,
        });
      } else {
        const ruleFileName = rule.name
          ? `${rule.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`
          : `rule-${rule.id}.md`;
        const rulePath = `.opencode/rules/${ruleFileName}`;
        instructions.push(rulePath);
        generatedFiles.push({
          path: rulePath,
          content: rule.content,
          encoding: 'utf-8',
          overwrite: true,
        });
      }
    }

    if (primaryRuleContent !== null) {
      generatedFiles.push({
        path: primaryRulePath,
        content: primaryRuleContent,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    const mcpServers: Record<string, OpenCodeMCPConfig> = {};
    for (const server of mcpConfig) {
      const mcpType = (server.metadata?.type as string) || 'local';

      if (mcpType === 'remote') {
        const remoteMcp: OpenCodeRemoteMCP = {
          type: 'remote',
          url: (server.metadata?.url as string) || '',
          enabled: !server.disabled,
        };
        if (server.metadata?.headers && typeof server.metadata.headers === 'object') {
          remoteMcp.headers = server.metadata.headers as Record<string, string>;
        }
        mcpServers[server.name] = remoteMcp;
      } else {
        const commandArray: string[] = [];
        if (server.command) {
          commandArray.push(server.command);
        }
        if (server.args && server.args.length > 0) {
          commandArray.push(...server.args);
        }
        const localMcp: OpenCodeLocalMCP = {
          type: 'local',
          command: commandArray,
          enabled: !server.disabled,
        };
        if (server.env && Object.keys(server.env).length > 0) {
          localMcp.environment = server.env;
        }
        mcpServers[server.name] = localMcp;
      }
    }

    for (const cmd of commands) {
      const cmdFileName = cmd.name
        ? `${cmd.name.replace(/[^a-zA-Z0-9_-]/g, '-')}.md`
        : `command-${cmd.id}.md`;

      let cmdContent = '';

      const frontmatterLines: string[] = [];
      if (cmd.description) {
        frontmatterLines.push(`description: ${cmd.description}`);
      }
      if (cmd.metadata?.agent) {
        frontmatterLines.push(`agent: ${cmd.metadata.agent}`);
      }
      if (cmd.metadata?.subtask !== undefined) {
        frontmatterLines.push(`subtask: ${cmd.metadata.subtask}`);
      }
      if (cmd.metadata?.model) {
        frontmatterLines.push(`model: ${cmd.metadata.model}`);
      }

      if (frontmatterLines.length > 0) {
        cmdContent = `---\n${frontmatterLines.join('\n')}\n---\n\n${cmd.template}`;
      } else {
        cmdContent = cmd.template;
      }

      generatedFiles.push({
        path: `.opencode/commands/${cmdFileName}`,
        content: cmdContent,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    const opencodeConfig: OpenCodeConfig = {
      $schema: 'https://opencode.ai/config.json',
    };

    if (instructions.length > 0) {
      opencodeConfig.instructions = instructions;
    }

    if (Object.keys(mcpServers).length > 0) {
      opencodeConfig.mcp = mcpServers;
    }

    const hasConfig = Object.keys(mcpServers).length > 0 || instructions.length > 0;

    if (hasConfig) {
      const configJson = JSON.stringify(opencodeConfig, null, 2);
      generatedFiles.push({
        path: 'opencode.json',
        content: configJson,
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
    let result = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];

      if (escape) {
        result += char;
        escape = false;
        continue;
      }

      if (char === '\\' && inString) {
        result += char;
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        result += char;
        continue;
      }

      if (!inString) {
        if (char === '/' && nextChar === '/') {
          while (i < content.length && content[i] !== '\n') {
            i++;
          }
          continue;
        }
        if (char === '/' && nextChar === '*') {
          i += 2;
          while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) {
            i++;
          }
          i++;
          continue;
        }
      }

      result += char;
    }

    try {
      return JSON.parse(result);
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

  private parseCommandMarkdown(content: string, fileName: string): CommandConfig | null {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      const name = path.basename(fileName, '.md');
      return {
        id: `opencode-cmd-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name,
        template: content.trim(),
        enabled: true,
      };
    }

    const frontmatter = match[1];
    const template = match[2].trim();
    const name = path.basename(fileName, '.md');

    const metadata: Record<string, unknown> = {};
    const lines = frontmatter.split('\n');
    let description: string | undefined;

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (key === 'description') {
        description = value;
      } else if (key === 'agent') {
        metadata.agent = value;
      } else if (key === 'subtask') {
        metadata.subtask = value.toLowerCase() === 'true';
      } else if (key === 'model') {
        metadata.model = value;
      }
    }

    return {
      id: `opencode-cmd-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name,
      description,
      template,
      enabled: true,
      metadata,
    };
  }
}

export const opencodeAdapter = new OpenCodeAdapter();
