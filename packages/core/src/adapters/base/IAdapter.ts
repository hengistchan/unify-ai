/**
 * Adapter Interface
 * 所有适配器必须实现的接口
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
 * 适配器接口
 * 所有工具适配器必须实现此接口
 */
export interface IAdapter {
  // ============================================
  // 元信息
  // ============================================

  /**
   * 获取工具元信息
   */
  readonly toolMeta: ToolMeta;

  /**
   * 获取适配器版本
   */
  readonly version: string;

  /**
   * 获取适配器完整信息
   */
  getInfo(): AdapterInfo;

  // ============================================
  // 能力声明
  // ============================================

  /**
   * 获取支持的所有能力
   */
  getCapabilities(): CapabilityDeclaration[];

  /**
   * 检查是否支持特定能力
   */
  hasCapability(capability: ConfigCapability): boolean;

  /**
   * 获取特定能力的支持级别
   */
  getCapabilityLevel(capability: ConfigCapability): CapabilityDeclaration['level'] | undefined;

  // ============================================
  // 文件发现
  // ============================================

  /**
   * 获取配置文件模式
   */
  getFilePatterns(): FilePattern[];

  /**
   * 发现项目中的配置文件
   */
  discoverFiles(projectRoot: string): Promise<FileInfo[]>;

  /**
   * 检查项目是否使用此工具
   */
  detect(projectRoot: string): Promise<boolean>;

  // ============================================
  // 解析 (Import)
  // ============================================

  /**
   * 从项目目录解析配置
   */
  parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult>;

  /**
   * 从特定文件解析配置
   */
  parseFile(filePath: string, options?: ConvertOptions): Promise<ParseResult>;

  /**
   * 从内容字符串解析配置
   */
  parseContent(content: string, filePath: string, options?: ConvertOptions): Promise<ParseResult>;

  // ============================================
  // 生成 (Export)
  // ============================================

  /**
   * 将统一配置生成为工具特定格式
   */
  generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult>;

  /**
   * 生成配置文件到指定目录
   */
  generateTo(
    config: UnifiedConfig,
    targetDir: string,
    options?: ConvertOptions
  ): Promise<GenerateResult>;

  // ============================================
  // 验证
  // ============================================

  /**
   * 验证配置是否有效
   */
  validate(config: UnifiedConfig): Promise<ValidationResult>;

  // ============================================
  // 生命周期
  // ============================================

  /**
   * 初始化适配器
   */
  initialize?(): Promise<void>;

  /**
   * 清理资源
   */
  dispose?(): Promise<void>;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;                  // 配置路径，如 "rules[0].content"
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

// ============================================
// 分层接口 (可选实现)
// ============================================

/**
 * 规则解析器接口
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
 * MCP 解析器接口
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
 * 设置解析器接口
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

// 导入需要的类型
import type {
  ParseError,
  ParseWarning,
  RuleConfig,
  MCPConfig,
  ToolSettings,
} from '../../core/types';
