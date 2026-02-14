/**
 * Adapter Interface
 * Interface that all adapters must implement
 */

import type {
  UnifiedConfig,
  ParseResult,
  GenerateResult,
  ConvertOptions,
  AdapterInfo,
  FileInfo,
  ToolMeta,
  CapabilityDeclaration,
  FilePattern,
  ConfigCapability,
} from '../../core/types';

/**
 * Adapter interface
 * All tool adapters must implement this interface
 */
export interface IAdapter {
  // ============================================
  // Metadata
  // ============================================

  /**
   * Get tool metadata
   */
  readonly toolMeta: ToolMeta;

  /**
   * Get adapter version
   */
  readonly version: string;

  /**
   * Get full adapter information
   */
  getInfo(): AdapterInfo;

  // ============================================
  // Capability declarations
  // ============================================

  /**
   * Get all supported capabilities
   */
  getCapabilities(): CapabilityDeclaration[];

  /**
   * Check if a specific capability is supported
   */
  hasCapability(capability: ConfigCapability): boolean;

  /**
   * Get support level for a specific capability
   */
  getCapabilityLevel(capability: ConfigCapability): CapabilityDeclaration['level'] | undefined;

  // ============================================
  // File discovery
  // ============================================

  /**
   * Get configuration file patterns
   */
  getFilePatterns(): FilePattern[];

  /**
   * Discover configuration files in project
   */
  discoverFiles(projectRoot: string): Promise<FileInfo[]>;

  /**
   * Check if project uses this tool
   */
  detect(projectRoot: string): Promise<boolean>;

  // ============================================
  // Parsing (Import)
  // ============================================

  /**
   * Parse configuration from project directory
   */
  parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult>;

  /**
   * Parse configuration from specific file
   */
  parseFile(filePath: string, options?: ConvertOptions): Promise<ParseResult>;

  /**
   * Parse configuration from content string
   */
  parseContent(content: string, filePath: string, options?: ConvertOptions): Promise<ParseResult>;

  // ============================================
  // Generation (Export)
  // ============================================

  /**
   * Generate tool-specific format from unified configuration
   */
  generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult>;

  /**
   * Generate configuration files to specified directory
   */
  generateTo(
    config: UnifiedConfig,
    targetDir: string,
    options?: ConvertOptions
  ): Promise<GenerateResult>;

  // ============================================
  // Validation
  // ============================================

  /**
   * Validate if configuration is valid
   */
  validate(config: UnifiedConfig): Promise<ValidationResult>;

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Initialize adapter
   */
  initialize?(): Promise<void>;

  /**
   * Cleanup resources
   */
  dispose?(): Promise<void>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;                  // Config path, e.g., "rules[0].content"
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

// ============================================
// Layered interfaces (optional to implement)
// ============================================

/**
 * Rule parser interface
 */
export interface IRuleParser {
  parseRules(content: string, context?: ParseContext): Promise<RuleParseResult>;
  generateRules(rules: RuleConfig[], options?: ConvertOptions): Promise<string>;
}

export interface RuleParseResult {
  rules: RuleConfig[];
  errors?: ParseError[];
  warnings?: ParseWarning[];
}

export interface ParseContext {
  filePath: string;
  projectRoot: string;
}

/**
 * MCP parser interface
 */
export interface IMCPParser {
  parseMCP(content: string, context?: ParseContext): Promise<MCPParseResult>;
  generateMCP(config: MCPConfig, options?: ConvertOptions): Promise<string>;
}

export interface MCPParseResult {
  config: MCPConfig;
  errors?: ParseError[];
  warnings?: ParseWarning[];
}

/**
 * Settings parser interface
 */
export interface ISettingsParser {
  parseSettings(content: string, context?: ParseContext): Promise<SettingsParseResult>;
  generateSettings(settings: ToolSettings, options?: ConvertOptions): Promise<string>;
}

export interface SettingsParseResult {
  settings: ToolSettings;
  errors?: ParseError[];
  warnings?: ParseWarning[];
}

// Import required types
import type {
  ParseError,
  ParseWarning,
  RuleConfig,
  MCPConfig,
  ToolSettings,
} from '../../core/types';
