/**
 * Capability Utilities
 * Capability declaration utility functions and constants
 */

import { ConfigCapability, CapabilityLevel, type CapabilityDeclaration } from '../../core/types';

/**
 * Create capability declaration
 */
export function declareCapability(
  capability: ConfigCapability,
  level: CapabilityLevel,
  notes?: string
): CapabilityDeclaration {
  return { capability, level, notes };
}

/**
 * Predefined capability declaration collections
 */
export const Capabilities = {
  // Full rules support
  fullRules: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.RULES, CapabilityLevel.FULL),

  // Partial rules support
  partialRules: (notes?: string): CapabilityDeclaration =>
    declareCapability(ConfigCapability.RULES, CapabilityLevel.PARTIAL, notes),

  // Full MCP support
  fullMCP: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.MCP_SERVERS, CapabilityLevel.FULL),

  // Partial MCP support
  partialMCP: (notes?: string): CapabilityDeclaration =>
    declareCapability(ConfigCapability.MCP_SERVERS, CapabilityLevel.PARTIAL, notes),

  // Read-only MCP
  readOnlyMCP: (notes?: string): CapabilityDeclaration =>
    declareCapability(ConfigCapability.MCP_SERVERS, CapabilityLevel.READ_ONLY, notes),

  // No MCP support
  noMCP: (notes?: string): CapabilityDeclaration =>
    declareCapability(ConfigCapability.MCP_SERVERS, CapabilityLevel.NONE, notes),

  // Full settings support
  fullSettings: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.FULL),

  // Partial settings support
  partialSettings: (notes?: string): CapabilityDeclaration =>
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.PARTIAL, notes),

  // Full commands support
  fullCommands: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.COMMANDS, CapabilityLevel.FULL),

  // Full prompts support
  fullPrompts: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.PROMPTS, CapabilityLevel.FULL),

  // Full context support
  fullContext: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.CONTEXT, CapabilityLevel.FULL),

  // Full env vars support
  fullEnvVars: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.ENV_VARS, CapabilityLevel.FULL),

  // Full ignore patterns support
  fullIgnore: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.IGNORE_PATTERNS, CapabilityLevel.FULL),
};

/**
 * Typical capability configurations for each tool
 */
export const ToolCapabilities = {
  /**
   * Cursor capabilities
   * - Rules: Markdown + frontmatter
   * - MCP: via .cursor/mcp.json or config
   */
  cursor: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.partialMCP('Cursor supports MCP but format differs from standard'),
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.PARTIAL, 'Via .cursor/settings'),
  ],

  /**
   * Claude Code capabilities
   * - Rules: CLAUDE.md
   * - MCP: .mcp.json
   * - Settings: settings.json
   */
  claudeCode: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.fullMCP(),
    Capabilities.fullSettings(),
    Capabilities.fullCommands(),
  ],

  /**
   * OpenAI Codex capabilities
   * - Rules: AGENTS.md
   * - MCP: .codex/config.toml
   */
  codex: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.fullMCP(),
    Capabilities.fullSettings(),
  ],

  /**
   * GitHub Copilot capabilities
   * - Rules: .github/copilot-instructions.md
   * - No MCP support
   */
  copilot: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.noMCP('GitHub Copilot does not support MCP'),
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.NONE, 'Settings via GitHub UI'),
  ],

  /**
   * Windsurf capabilities
   * - Rules: .windsurfrules
   * - MCP: via config file
   */
  windsurf: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.partialMCP(),
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.PARTIAL),
  ],

  /**
   * Cline capabilities
   * - Rules: .clinerules/
   * - MCP: globalState.json or config
   */
  cline: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.fullMCP(),
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.PARTIAL, 'Via VS Code settings'),
  ],

  /**
   * Aider capabilities
   * - Rules: .aider.conf.yml
   * - No native MCP support
   */
  aider: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.noMCP('Aider does not natively support MCP'),
    Capabilities.fullSettings(),
  ],

  /**
   * Continue.dev capabilities
   * - Rules: rules in config.yaml
   * - MCP: mcpServers in config.yaml
   */
  continue: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.fullMCP(),
    Capabilities.fullSettings(),
    Capabilities.fullPrompts(),
  ],

  /**
   * OpenCode capabilities
   * - Rules: instructions array in opencode.json
   * - MCP: mcpServers in opencode.json
   */
  opencode: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.fullMCP(),
    Capabilities.fullSettings(),
  ],
};

/**
 * Check if capability is available
 */
export function isCapabilityAvailable(declaration: CapabilityDeclaration): boolean {
  return declaration.level !== CapabilityLevel.NONE;
}

/**
 * Check if capability supports export
 */
export function canExportCapability(declaration: CapabilityDeclaration): boolean {
  return (
    declaration.level === CapabilityLevel.FULL || declaration.level === CapabilityLevel.PARTIAL
  );
}

/**
 * Check if capability supports import
 */
export function canImportCapability(declaration: CapabilityDeclaration): boolean {
  return declaration.level !== CapabilityLevel.NONE;
}

/**
 * Get compatibility notes for capabilities
 */
export function getCompatibilityNotes(
  declarations: CapabilityDeclaration[]
): Record<ConfigCapability, string | undefined> {
  const result: Record<ConfigCapability, string | undefined> = {} as Record<
    ConfigCapability,
    string | undefined
  >;

  for (const decl of declarations) {
    result[decl.capability] = decl.notes;
  }

  return result;
}
