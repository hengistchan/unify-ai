/**
 * Capability Utilities
 * 能力声明工具函数和常量
 */

import {
  ConfigCapability,
  CapabilityLevel,
  type CapabilityDeclaration,
} from '../../core/types';

/**
 * 创建能力声明
 */
export function declareCapability(
  capability: ConfigCapability,
  level: CapabilityLevel,
  notes?: string
): CapabilityDeclaration {
  return { capability, level, notes };
}

/**
 * 预定义的能力声明集合
 */
export const Capabilities = {
  // 完全支持规则
  fullRules: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.RULES, CapabilityLevel.FULL),

  // 部分支持规则
  partialRules: (notes?: string): CapabilityDeclaration =>
    declareCapability(ConfigCapability.RULES, CapabilityLevel.PARTIAL, notes),

  // 完全支持 MCP
  fullMCP: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.MCP_SERVERS, CapabilityLevel.FULL),

  // 部分支持 MCP
  partialMCP: (notes?: string): CapabilityDeclaration =>
    declareCapability(ConfigCapability.MCP_SERVERS, CapabilityLevel.PARTIAL, notes),

  // 只读 MCP
  readOnlyMCP: (notes?: string): CapabilityDeclaration =>
    declareCapability(ConfigCapability.MCP_SERVERS, CapabilityLevel.READ_ONLY, notes),

  // 不支持 MCP
  noMCP: (notes?: string): CapabilityDeclaration =>
    declareCapability(ConfigCapability.MCP_SERVERS, CapabilityLevel.NONE, notes),

  // 完全支持设置
  fullSettings: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.FULL),

  // 部分支持设置
  partialSettings: (notes?: string): CapabilityDeclaration =>
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.PARTIAL, notes),

  // 完全支持命令
  fullCommands: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.COMMANDS, CapabilityLevel.FULL),

  // 完全支持提示词
  fullPrompts: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.PROMPTS, CapabilityLevel.FULL),

  // 完全支持上下文
  fullContext: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.CONTEXT, CapabilityLevel.FULL),

  // 完全支持环境变量
  fullEnvVars: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.ENV_VARS, CapabilityLevel.FULL),

  // 完全支持忽略模式
  fullIgnore: (): CapabilityDeclaration =>
    declareCapability(ConfigCapability.IGNORE_PATTERNS, CapabilityLevel.FULL),
};

/**
 * 各工具的典型能力配置
 */
export const ToolCapabilities = {
  /**
   * Cursor 能力
   * - 规则: Markdown + frontmatter
   * - MCP: 通过 .cursor/mcp.json 或配置
   */
  cursor: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.partialMCP('Cursor supports MCP but format differs from standard'),
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.PARTIAL, 'Via .cursor/settings'),
  ],

  /**
   * Claude Code 能力
   * - 规则: CLAUDE.md
   * - MCP: .mcp.json
   * - 设置: settings.json
   */
  claudeCode: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.fullMCP(),
    Capabilities.fullSettings(),
    Capabilities.fullCommands(),
  ],

  /**
   * OpenAI Codex 能力
   * - 规则: AGENTS.md
   * - MCP: .codex/config.toml
   */
  codex: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.fullMCP(),
    Capabilities.fullSettings(),
  ],

  /**
   * GitHub Copilot 能力
   * - 规则: .github/copilot-instructions.md
   * - 无 MCP 支持
   */
  copilot: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.noMCP('GitHub Copilot does not support MCP'),
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.NONE, 'Settings via GitHub UI'),
  ],

  /**
   * Windsurf 能力
   * - 规则: .windsurfrules
   * - MCP: 通过配置文件
   */
  windsurf: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.partialMCP(),
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.PARTIAL),
  ],

  /**
   * Cline 能力
   * - 规则: .clinerules/
   * - MCP: globalState.json 或配置
   */
  cline: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.fullMCP(),
    declareCapability(ConfigCapability.SETTINGS, CapabilityLevel.PARTIAL, 'Via VS Code settings'),
  ],

  /**
   * Aider 能力
   * - 规则: .aider.conf.yml
   * - 无原生 MCP 支持
   */
  aider: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.noMCP('Aider does not natively support MCP'),
    Capabilities.fullSettings(),
  ],

  /**
   * Continue.dev 能力
   * - 规则: config.yaml 中的 rules
   * - MCP: config.yaml 中的 mcpServers
   */
  continue: (): CapabilityDeclaration[] => [
    Capabilities.fullRules(),
    Capabilities.fullMCP(),
    Capabilities.fullSettings(),
    Capabilities.fullPrompts(),
  ],
};

/**
 * 检查能力是否可用
 */
export function isCapabilityAvailable(
  declaration: CapabilityDeclaration
): boolean {
  return declaration.level !== CapabilityLevel.NONE;
}

/**
 * 检查能力是否支持导出
 */
export function canExportCapability(
  declaration: CapabilityDeclaration
): boolean {
  return declaration.level === CapabilityLevel.FULL ||
         declaration.level === CapabilityLevel.PARTIAL;
}

/**
 * 检查能力是否支持导入
 */
export function canImportCapability(
  declaration: CapabilityDeclaration
): boolean {
  return declaration.level !== CapabilityLevel.NONE;
}

/**
 * 获取能力的兼容性说明
 */
export function getCompatibilityNotes(
  declarations: CapabilityDeclaration[]
): Record<ConfigCapability, string | undefined> {
  const result: Record<ConfigCapability, string | undefined> = {} as Record<ConfigCapability, string | undefined>;

  for (const decl of declarations) {
    result[decl.capability] = decl.notes;
  }

  return result;
}
