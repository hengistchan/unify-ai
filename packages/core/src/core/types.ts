/**
 * Unify-AI Core Types
 * 统一的配置类型定义
 */

// ============================================
// 能力定义
// ============================================

/**
 * 配置能力枚举
 * 声明工具支持哪些类型的配置
 */
export enum ConfigCapability {
  // 基础能力
  RULES = 'rules',              // 自定义规则/指令
  MCP_SERVERS = 'mcp_servers',  // MCP 服务器配置
  SETTINGS = 'settings',        // 工具设置

  // 扩展能力
  COMMANDS = 'commands',        // 自定义命令
  PROMPTS = 'prompts',          // 提示词模板
  CONTEXT = 'context',          // 上下文文件引用
  ENV_VARS = 'env_vars',        // 环境变量
  IGNORE_PATTERNS = 'ignore',   // 忽略模式
}

/**
 * 能力支持级别
 */
export enum CapabilityLevel {
  FULL = 'full',       // 完全支持，可以 import 和 export
  PARTIAL = 'partial', // 部分支持，某些字段可能丢失
  READ_ONLY = 'read_only',   // 只能 import，不能完整 export
  NONE = 'none',       // 不支持
}

/**
 * 能力声明
 */
export interface CapabilityDeclaration {
  capability: ConfigCapability;
  level: CapabilityLevel;
  notes?: string;  // 特殊说明，如部分支持的原因
}

// ============================================
// 工具标识
// ============================================

/**
 * 支持的 AI 工具枚举
 */
export enum ToolId {
  CURSOR = 'cursor',
  CLAUDE_CODE = 'claude-code',
  CODEX = 'codex',
  COPILOT = 'copilot',
  WINDSURF = 'windsurf',
  CLINE = 'cline',
  AIDER = 'aider',
  CONTINUE = 'continue',
}

/**
 * 工具元信息
 */
export interface ToolMeta {
  id: ToolId;
  name: string;
  description: string;
  website?: string;
  repository?: string;
}

// ============================================
// 统一配置模型
// ============================================

/**
 * 规则配置
 * AI 工具的自定义指令/规则
 */
export interface RuleConfig {
  id: string;                    // 规则唯一标识
  name?: string;                 // 规则名称
  description?: string;          // 规则描述
  content: string;               // 规则内容 (Markdown)
  globs?: string[];              // 适用的文件 glob 模式
  alwaysApply?: boolean;         // 是否始终应用
  priority?: number;             // 优先级 (用于排序)
  enabled?: boolean;             // 是否启用
  metadata?: Record<string, unknown>;  // 工具特定的元数据
}

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  name: string;                  // 服务器名称
  command: string;               // 启动命令
  args?: string[];               // 命令参数
  env?: Record<string, string>;  // 环境变量
  cwd?: string;                  // 工作目录
  disabled?: boolean;            // 是否禁用
  autoApprove?: string[];        // 自动批准的权限列表
  metadata?: Record<string, unknown>;  // 工具特定字段
}

/**
 * MCP 配置
 */
export interface MCPConfig {
  servers: MCPServerConfig[];
  globalEnv?: Record<string, string>;
}

/**
 * 工具设置
 * 各工具的通用设置项
 */
export interface ToolSettings {
  // 模型配置
  model?: {
    default?: string;
    available?: string[];
  };

  // 权限配置
  permissions?: {
    allow?: string[];
    deny?: string[];
  };

  // 行为配置
  behavior?: {
    autoSave?: boolean;
    verbose?: boolean;
    timeout?: number;
  };

  // 工具特定的设置
  toolSpecific?: Record<string, unknown>;
}

/**
 * 自定义命令
 */
export interface CommandConfig {
  id: string;
  name: string;
  description?: string;
  template: string;              // 命令模板
  arguments?: CommandArgument[];
  enabled?: boolean;
}

export interface CommandArgument {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: unknown;
  description?: string;
}

/**
 * 提示词模板
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  variables?: PromptVariable[];
}

export interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'array';
  required?: boolean;
  default?: unknown;
}

/**
 * 统一配置
 * 所有工具配置的统一表示
 */
export interface UnifiedConfig {
  // 元信息
  version: string;               // 配置版本
  sourceTool?: ToolId;           // 来源工具
  lastModified?: string;         // 最后修改时间

  // 核心配置
  rules: RuleConfig[];
  mcp?: MCPConfig;
  settings?: ToolSettings;

  // 扩展配置
  commands?: CommandConfig[];
  prompts?: PromptTemplate[];
  contextFiles?: string[];       // 上下文文件路径
  envVars?: Record<string, string>;
  ignorePatterns?: string[];

  // 原始数据 (用于保留无法转换的字段)
  raw?: Record<string, unknown>;
}

// ============================================
// 转换相关类型
// ============================================

/**
 * 文件信息
 */
export interface FileInfo {
  path: string;                  // 相对于项目根目录的路径
  absolutePath: string;          // 绝对路径
  exists: boolean;
  size?: number;
  lastModified?: Date;
}

/**
 * 解析结果
 */
export interface ParseResult<T = UnifiedConfig> {
  success: boolean;
  data?: T;
  errors?: ParseError[];
  warnings?: ParseWarning[];
  metadata?: {
    sourceFiles: FileInfo[];
    toolVersion?: string;
    parseTime: number;
  };
}

export interface ParseError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  recoverable: boolean;          // 是否可以继续解析
}

export interface ParseWarning {
  code: string;
  message: string;
  file?: string;
  line?: number;
}

/**
 * 生成结果
 */
export interface GenerateResult {
  success: boolean;
  files: GeneratedFile[];
  errors?: GenerateError[];
  warnings?: GenerateWarning[];
}

export interface GeneratedFile {
  path: string;                  // 相对路径
  content: string | Buffer;
  encoding: 'utf-8' | 'binary';
  overwrite: boolean;            // 是否覆盖现有文件
}

export interface GenerateError {
  code: string;
  message: string;
}

export interface GenerateWarning {
  code: string;
  message: string;
  suggestion?: string;           // 建议的解决方案
}

/**
 * 转换选项
 */
export interface ConvertOptions {
  // 导入选项
  includeRaw?: boolean;          // 是否保留原始数据
  validateSchema?: boolean;      // 是否验证 schema
  strict?: boolean;              // 严格模式，任何错误都中断

  // 导出选项
  overwrite?: boolean;           // 是否覆盖现有文件
  backupExisting?: boolean;      // 是否备份现有文件
  dryRun?: boolean;              // 试运行，不实际写入

  // 冲突解决
  conflictStrategy?: 'skip' | 'overwrite' | 'merge' | 'ask';

  // 过滤
  includeCapabilities?: ConfigCapability[];
  excludeCapabilities?: ConfigCapability[];
}

// ============================================
// 适配器类型
// ============================================

/**
 * 适配器状态
 */
export enum AdapterStatus {
  READY = 'ready',
  INITIALIZING = 'initializing',
  ERROR = 'error',
  UNSUPPORTED = 'unsupported',
}

/**
 * 适配器信息
 */
export interface AdapterInfo {
  tool: ToolMeta;
  version: string;
  capabilities: CapabilityDeclaration[];
  status: AdapterStatus;
  filePatterns: FilePattern[];
}

/**
 * 文件发现模式
 */
export interface FilePattern {
  pattern: string;               // glob 模式
  type: 'required' | 'optional';
  capability: ConfigCapability;
  description?: string;
}
