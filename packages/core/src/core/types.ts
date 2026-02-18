/**
 * Unify-AI Core Types
 * Unified configuration type definitions
 */

// ============================================
// Capability Definitions
// ============================================

/**
 * Configuration capability enum
 * Declares which config types a tool supports
 */
export enum ConfigCapability {
  // Basic capabilities
  RULES = 'rules', // Custom rules/instructions
  MCP_SERVERS = 'mcp_servers', // MCP server configuration
  SETTINGS = 'settings', // Tool settings

  // Extended capabilities
  COMMANDS = 'commands', // Custom commands
  PROMPTS = 'prompts', // Prompt templates
  CONTEXT = 'context', // Context file references
  ENV_VARS = 'env_vars', // Environment variables
  IGNORE_PATTERNS = 'ignore', // Ignore patterns
}

/**
 * Capability support level
 */
export enum CapabilityLevel {
  FULL = 'full', // Full support, can import and export
  PARTIAL = 'partial', // Partial support, some fields may be lost
  READ_ONLY = 'read_only', // Can only import, cannot fully export
  NONE = 'none', // Not supported
}

/**
 * Capability declaration
 */
export interface CapabilityDeclaration {
  capability: ConfigCapability;
  level: CapabilityLevel;
  notes?: string; // Special notes, e.g., reasons for partial support
}

// ============================================
// Tool Identifiers
// ============================================

/**
 * Supported AI tools enum
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
 * Tool metadata
 */
export interface ToolMeta {
  id: ToolId;
  name: string;
  description: string;
  website?: string;
  repository?: string;
}

// ============================================
// Unified Config Model
// ============================================

/**
 * Rule configuration
 * Custom instructions/rules for AI tools
 */
export interface RuleConfig {
  id: string; // Unique rule identifier
  name?: string; // Rule name
  description?: string; // Rule description
  content: string; // Rule content (Markdown)
  globs?: string[]; // Applicable file glob patterns
  alwaysApply?: boolean; // Whether to always apply
  priority?: number; // Priority (for sorting)
  enabled?: boolean; // Whether enabled
  metadata?: Record<string, unknown>; // Tool-specific metadata
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  name: string; // Server name
  command: string; // Launch command
  args?: string[]; // Command arguments
  env?: Record<string, string>; // Environment variables
  cwd?: string; // Working directory
  disabled?: boolean; // Whether disabled
  autoApprove?: string[]; // Auto-approved permissions list
  metadata?: Record<string, unknown>; // Tool-specific fields
}

/**
 * MCP configuration
 */
export interface MCPConfig {
  servers: MCPServerConfig[];
  globalEnv?: Record<string, string>;
}

/**
 * Tool settings
 * Common settings for various tools
 */
export interface ToolSettings {
  // Model configuration
  model?: {
    default?: string;
    available?: string[];
  };

  // Permission configuration
  permissions?: {
    allow?: string[];
    deny?: string[];
  };

  // Behavior configuration
  behavior?: {
    autoSave?: boolean;
    verbose?: boolean;
    timeout?: number;
  };

  // Tool-specific settings
  toolSpecific?: Record<string, unknown>;
}

/**
 * Custom command
 */
export interface CommandConfig {
  id: string;
  name: string;
  description?: string;
  template: string; // Command template
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
 * Prompt template
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
 * Unified configuration
 * Unified representation of all tool configurations
 */
export interface UnifiedConfig {
  // Metadata
  version: string; // Config version
  sourceTool?: ToolId; // Source tool
  lastModified?: string; // Last modified time

  // Core configuration
  rules: RuleConfig[];
  mcp?: MCPConfig;
  settings?: ToolSettings;

  // Extended configuration
  commands?: CommandConfig[];
  prompts?: PromptTemplate[];
  contextFiles?: string[]; // Context file paths
  envVars?: Record<string, string>;
  ignorePatterns?: string[];

  // Raw data (for preserving non-convertible fields)
  raw?: Record<string, unknown>;
}

// ============================================
// Conversion Related Types
// ============================================

/**
 * File information
 */
export interface FileInfo {
  path: string; // Path relative to project root
  absolutePath: string; // Absolute path
  exists: boolean;
  size?: number;
  lastModified?: Date;
}

/**
 * Parse result
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
  recoverable: boolean; // Whether parsing can continue
}

export interface ParseWarning {
  code: string;
  message: string;
  file?: string;
  line?: number;
}

/**
 * Generate result
 */
export interface GenerateResult {
  success: boolean;
  files: GeneratedFile[];
  errors?: GenerateError[];
  warnings?: GenerateWarning[];
}

export interface GeneratedFile {
  path: string; // Relative path
  content: string | Buffer;
  encoding: 'utf-8' | 'binary';
  overwrite: boolean; // Whether to overwrite existing file
}

export interface GenerateError {
  code: string;
  message: string;
}

export interface GenerateWarning {
  code: string;
  message: string;
  suggestion?: string; // Suggested solution
}

/**
 * Conversion options
 */
export interface ConvertOptions {
  // Import options
  includeRaw?: boolean; // Whether to preserve raw data
  validateSchema?: boolean; // Whether to validate schema
  strict?: boolean; // Strict mode, any error interrupts

  // Export options
  overwrite?: boolean; // Whether to overwrite existing files
  backupExisting?: boolean; // Whether to backup existing files
  dryRun?: boolean; // Dry run, don't actually write

  // Conflict resolution
  conflictStrategy?: 'skip' | 'overwrite' | 'merge' | 'ask';

  // Filtering
  includeCapabilities?: ConfigCapability[];
  excludeCapabilities?: ConfigCapability[];
}

// ============================================
// Adapter Types
// ============================================

/**
 * Adapter status
 */
export enum AdapterStatus {
  READY = 'ready',
  INITIALIZING = 'initializing',
  ERROR = 'error',
  UNSUPPORTED = 'unsupported',
}

/**
 * Adapter information
 */
export interface AdapterInfo {
  tool: ToolMeta;
  version: string;
  capabilities: CapabilityDeclaration[];
  status: AdapterStatus;
  filePatterns: FilePattern[];
}

/**
 * File discovery pattern
 */
export interface FilePattern {
  pattern: string; // Glob pattern
  type: 'required' | 'optional';
  capability: ConfigCapability;
  description?: string;
}
