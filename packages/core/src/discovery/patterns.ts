/**
 * File Pattern Definitions
 * File pattern constants for each tool
 */

import { ToolId, ConfigCapability, type FilePattern } from '../core/types';

/**
 * Cursor file patterns
 */
export const CURSOR_PATTERNS: FilePattern[] = [
  {
    pattern: '.cursor/rules/*.md',
    type: 'optional',
    capability: ConfigCapability.RULES,
    description: 'Cursor rule files',
  },
  {
    pattern: '.cursor/mcp.json',
    type: 'optional',
    capability: ConfigCapability.MCP_SERVERS,
    description: 'Cursor MCP configuration',
  },
  {
    pattern: '.cursor/settings',
    type: 'optional',
    capability: ConfigCapability.SETTINGS,
    description: 'Cursor settings',
  },
];

/**
 * Claude Code file patterns
 */
export const CLAUDE_CODE_PATTERNS: FilePattern[] = [
  {
    pattern: 'CLAUDE.md',
    type: 'optional',
    capability: ConfigCapability.RULES,
    description: 'Main Claude Code instructions',
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
    description: 'Claude Code settings',
  },
  {
    pattern: '.claude/settings.local.json',
    type: 'optional',
    capability: ConfigCapability.SETTINGS,
    description: 'Claude Code local settings',
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

/**
 * OpenAI Codex file patterns
 */
export const CODEX_PATTERNS: FilePattern[] = [
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

/**
 * GitHub Copilot file patterns
 */
export const COPILOT_PATTERNS: FilePattern[] = [
  {
    pattern: '.github/copilot-instructions.md',
    type: 'optional',
    capability: ConfigCapability.RULES,
    description: 'Copilot instructions',
  },
];

/**
 * Windsurf file patterns
 */
export const WINDSURF_PATTERNS: FilePattern[] = [
  {
    pattern: '.windsurfrules',
    type: 'optional',
    capability: ConfigCapability.RULES,
    description: 'Windsurf rules',
  },
  {
    pattern: '.windsurf/mcp.json',
    type: 'optional',
    capability: ConfigCapability.MCP_SERVERS,
    description: 'Windsurf MCP configuration',
  },
];

/**
 * Cline file patterns
 */
export const CLINE_PATTERNS: FilePattern[] = [
  {
    pattern: '.clinerules/*',
    type: 'optional',
    capability: ConfigCapability.RULES,
    description: 'Cline rules',
  },
  {
    pattern: '.cline/globalState.json',
    type: 'optional',
    capability: ConfigCapability.SETTINGS,
    description: 'Cline global state',
  },
  {
    pattern: '.cline/mcp.json',
    type: 'optional',
    capability: ConfigCapability.MCP_SERVERS,
    description: 'Cline MCP configuration',
  },
];

/**
 * Aider file patterns
 */
export const AIDER_PATTERNS: FilePattern[] = [
  {
    pattern: '.aider.conf.yml',
    type: 'optional',
    capability: ConfigCapability.SETTINGS,
    description: 'Aider configuration',
  },
  {
    pattern: '.aider.conf.yaml',
    type: 'optional',
    capability: ConfigCapability.SETTINGS,
    description: 'Aider configuration (yaml)',
  },
];

/**
 * Continue.dev file patterns
 */
export const CONTINUE_PATTERNS: FilePattern[] = [
  {
    pattern: '.continue/config.yaml',
    type: 'optional',
    capability: ConfigCapability.SETTINGS,
    description: 'Continue configuration',
  },
  {
    pattern: '.continue/config.yml',
    type: 'optional',
    capability: ConfigCapability.SETTINGS,
    description: 'Continue configuration (yml)',
  },
  {
    pattern: '.continue/config.json',
    type: 'optional',
    capability: ConfigCapability.SETTINGS,
    description: 'Continue configuration (json)',
  },
];

/**
 * File pattern mapping for all tools
 */
export const TOOL_PATTERNS: Record<ToolId, FilePattern[]> = {
  [ToolId.CURSOR]: CURSOR_PATTERNS,
  [ToolId.CLAUDE_CODE]: CLAUDE_CODE_PATTERNS,
  [ToolId.CODEX]: CODEX_PATTERNS,
  [ToolId.COPILOT]: COPILOT_PATTERNS,
  [ToolId.WINDSURF]: WINDSURF_PATTERNS,
  [ToolId.CLINE]: CLINE_PATTERNS,
  [ToolId.AIDER]: AIDER_PATTERNS,
  [ToolId.CONTINUE]: CONTINUE_PATTERNS,
};

/**
 * Union pattern for all config files
 */
export const ALL_CONFIG_PATTERNS: string[] = [
  // Cursor
  '.cursor/rules/*.md',
  '.cursor/mcp.json',
  '.cursor/settings',
  // Claude Code
  'CLAUDE.md',
  '.claude/rules/*.md',
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.mcp.json',
  '.claude/commands/*.md',
  // Codex
  'AGENTS.md',
  '.codex/config.toml',
  // Copilot
  '.github/copilot-instructions.md',
  // Windsurf
  '.windsurfrules',
  '.windsurf/mcp.json',
  // Cline
  '.clinerules/*',
  '.cline/globalState.json',
  '.cline/mcp.json',
  // Aider
  '.aider.conf.yml',
  '.aider.conf.yaml',
  // Continue
  '.continue/config.yaml',
  '.continue/config.yml',
  '.continue/config.json',
];
