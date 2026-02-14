/**
 * Aider Adapter
 *
 * Aider 配置格式:
 * - .aider.conf.yml - 主配置文件 (YAML 格式)
 *
 * Aider 规则可以通过 YAML 中的 rules 字段定义:
 * - 引用外部文件: rules: [{file: path/to/rule.md}]
 * - 内联内容: rules: [{content: "Rule content here"}]
 *
 * 不支持 MCP。
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { glob } from 'glob';

import { BaseAdapter } from '../base/BaseAdapter';
import type { IAdapter } from '../base/IAdapter';
import {
  ConfigCapability,
  ToolId,
  type UnifiedConfig,
  type RuleConfig,
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
 * Aider 配置文件格式
 */
interface AiderConfig {
  rules?: AiderRule[];
  [key: string]: unknown;
}

/**
 * Aider 规则定义
 * 可以是文件引用或内联内容
 */
interface AiderRule {
  file?: string;
  content?: string;
}

/**
 * Aider 适配器
 */
export class AiderAdapter extends BaseAdapter implements IAdapter {
  readonly toolMeta: ToolMeta = {
    id: ToolId.AIDER,
    name: 'Aider',
    description: 'AI pair programming in terminal',
    website: 'https://aider.chat',
    repository: 'https://github.com/paul-gauthier/aider',
  };

  readonly version = '1.0.0';

  /**
   * 获取能力声明
   */
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.aider();
  }

  /**
   * 获取文件模式
   */
  getFilePatterns(): FilePattern[] {
    return [
      {
        pattern: '.aider.conf.yml',
        type: 'required',
        capability: ConfigCapability.RULES,
        description: 'Aider main configuration file (YAML format)',
      },
      {
        pattern: '.aider.rules/',
        type: 'optional',
        capability: ConfigCapability.RULES,
        description: 'Aider rule files directory',
      },
    ];
  }

  /**
   * 解析 Aider 配置
   */
  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    let settings: ToolSettings | undefined;

    // 1. 解析主配置文件
    const configPath = path.join(projectRoot, '.aider.conf.yml');
    const configExists = await this.fileExists(configPath);

    if (configExists) {
      sourceFiles.push({
        path: '.aider.conf.yml',
        absolutePath: configPath,
        exists: true,
      });

      const configResult = await this.parseConfigFile(configPath);
      if (configResult.rules) {
        rules.push(...configResult.rules);
      }
      if (configResult.settings) {
        settings = configResult.settings;
      }
      if (configResult.errors) {
        errors.push(...configResult.errors);
      }
    }

    // 2. 解析规则目录中的规则文件
    const ruleFiles = await this.discoverRuleFiles(projectRoot);
    for (const fileInfo of ruleFiles) {
      sourceFiles.push(fileInfo);
      const result = await this.parseRuleFile(fileInfo.absolutePath);
      if (result.rules) {
        rules.push(...result.rules);
      }
      if (result.errors) {
        errors.push(...result.errors);
      }
    }

    // 构建统一配置
    const config: UnifiedConfig = {
      version: '1.0',
      sourceTool: ToolId.AIDER,
      rules,
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
   * 生成 Aider 配置
   */
  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    const files: GeneratedFile[] = [];

    // 生成主配置文件
    const aiderConfig: AiderConfig = {};

    // 1. 生成规则
    if (config.rules && config.rules.length > 0 && this.hasCapability(ConfigCapability.RULES)) {
      const aiderRules: AiderRule[] = [];

      for (const rule of config.rules) {
        if (rule.enabled === false) continue;

        // 如果规则引用外部文件，保留引用
        if (rule.metadata?.externalFile) {
          aiderRules.push({ file: rule.metadata.externalFile as string });
        } else {
          // 否则作为内联规则
          aiderRules.push({ content: rule.content });
        }
      }

      if (aiderRules.length > 0) {
        aiderConfig.rules = aiderRules;
      }
    }

    // 2. 生成设置
    if (config.settings && this.hasCapability(ConfigCapability.SETTINGS)) {
      // 将设置添加到配置中
      for (const [key, value] of Object.entries(config.settings)) {
        if (key !== 'permissions' && key !== 'toolSpecific' && value !== undefined) {
          aiderConfig[key] = value;
        }
      }

      // 处理 toolSpecific 设置
      if (config.settings.toolSpecific) {
        for (const [key, value] of Object.entries(config.settings.toolSpecific)) {
          if (value !== undefined) {
            aiderConfig[key] = value;
          }
        }
      }
    }

    // 生成 YAML 内容
    const configContent = yaml.stringify(aiderConfig, { lineWidth: 0 });

    files.push({
      path: '.aider.conf.yml',
      content: configContent,
      encoding: 'utf-8',
      overwrite: true,
    });

    // 3. 生成外部规则文件（如果需要）
    if (config.rules && config.rules.length > 0) {
      for (const rule of config.rules) {
        if (rule.enabled === false) continue;
        if (rule.metadata?.externalFile) {
          // 外部规则文件
          const externalRulePath = path.join(
            '.',
            rule.metadata.externalFile as string
          );
          files.push({
            path: externalRulePath,
            content: rule.content,
            encoding: 'utf-8',
            overwrite: true,
          });
        }
      }
    }

    return {
      success: true,
      files,
    };
  }

  /**
   * 从内容解析
   */
  async parseContent(content: string, filePath: string, options?: ConvertOptions): Promise<ParseResult> {
    const fileName = path.basename(filePath);

    if (fileName === '.aider.conf.yml' || fileName.endsWith('.yml') || fileName.endsWith('.yaml')) {
      const result = await this.parseConfigContent(content, filePath);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.AIDER,
          rules: result.rules || [],
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

    // 规则文件
    if (filePath.includes('.aider.rules/') || filePath.endsWith('.md')) {
      const result = await this.parseRuleContent(content, filePath);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.AIDER,
          rules: result.rules || [],
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
  // 私有方法 - 配置文件解析
  // ============================================

  private async parseConfigFile(filePath: string): Promise<{
    rules?: RuleConfig[];
    settings?: ToolSettings;
    errors?: ParseError[];
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseConfigContent(content, filePath);
    } catch (error) {
      return {
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: false,
        }],
      };
    }
  }

  private async parseConfigContent(content: string, filePath: string): Promise<{
    rules?: RuleConfig[];
    settings?: ToolSettings;
    errors?: ParseError[];
  }> {
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    const settings: ToolSettings = {};

    try {
      const aiderConfig = yaml.parse(content) as AiderConfig;

      // 解析规则
      if (aiderConfig.rules) {
        for (let i = 0; i < aiderConfig.rules.length; i++) {
          const ruleDef = aiderConfig.rules[i];

          if (ruleDef.file) {
            // 文件引用
            const rule: RuleConfig = {
              id: this.generateRuleId(ruleDef.file),
              name: path.basename(ruleDef.file, '.md'),
              content: `Referenced from: ${ruleDef.file}`,
              metadata: {
                source: 'aider',
                originalPath: filePath,
                externalFile: ruleDef.file,
              },
            };
            rules.push(rule);
          } else if (ruleDef.content) {
            // 内联规则
            const rule: RuleConfig = {
              id: this.generateRuleId(`inline-${i}`),
              name: `Rule ${i + 1}`,
              content: ruleDef.content,
              metadata: {
                source: 'aider',
                originalPath: filePath,
              },
            };
            rules.push(rule);
          }
        }
      }

      // 解析其他设置
      for (const [key, value] of Object.entries(aiderConfig)) {
        if (key !== 'rules' && value !== undefined) {
          (settings as Record<string, unknown>)[key] = value;
        }
      }

      return { rules, settings: Object.keys(settings).length > 0 ? settings : undefined };
    } catch (error) {
      return {
        errors: [{
          code: 'YAML_PARSE_ERROR',
          message: `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: true,
        }],
      };
    }
  }

  // ============================================
  // 私有方法 - 规则文件解析
  // ============================================

  private async discoverRuleFiles(projectRoot: string): Promise<FileInfo[]> {
    const rulesDir = path.join(projectRoot, '.aider.rules');

    try {
      const stats = await fs.stat(rulesDir);
      if (!stats.isDirectory()) {
        return [];
      }
    } catch {
      // 目录不存在
      return [];
    }

    const pattern = path.join(rulesDir, '*');
    const matches = await glob(pattern, { nodir: true });

    return Promise.all(matches.map(async (absolutePath) => {
      const stats = await fs.stat(absolutePath);
      return {
        path: path.relative(projectRoot, absolutePath),
        absolutePath,
        exists: true,
        size: stats.size,
        lastModified: stats.mtime,
      };
    }));
  }

  private async parseRuleFile(filePath: string): Promise<{
    rules: RuleConfig[];
    errors?: ParseError[];
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseRuleContent(content, filePath);
    } catch (error) {
      return {
        rules: [],
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read rule file: ${error instanceof Error ? error.message : String(error)}`,
          file: filePath,
          recoverable: true,
        }],
      };
    }
  }

  private parseRuleContent(content: string, filePath: string): {
    rules: RuleConfig[];
    errors?: ParseError[];
  } {
    const fileName = path.basename(filePath);
    const ruleName = path.basename(fileName, path.extname(fileName));

    const rule: RuleConfig = {
      id: this.generateRuleId(ruleName),
      name: ruleName,
      content: content.trim(),
      metadata: {
        source: 'aider',
        originalPath: filePath,
        externalFile: `.aider.rules/${fileName}`,
      },
    };

    return { rules: [rule] };
  }

  private generateRuleId(name: string): string {
    return `aider-rule-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

  // ============================================
  // 辅助方法
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

// 导出单例
export const aiderAdapter = new AiderAdapter();
