/**
 * Aider Adapter
 *
 * Aider configuration format:
 * - .aider.conf.yml - Main configuration file (YAML format)
 *
 * Aider rules can be defined via the rules field in YAML:
 * - External file reference: rules: [{file: path/to/rule.md}]
 * - Inline content: rules: [{content: "Rule content here"}]
 *
 * MCP is not supported.
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
 * Aider configuration file format
 */
interface AiderConfig {
  rules?: AiderRule[];
  [key: string]: unknown;
}

/**
 * Aider rule definition
 * Can be a file reference or inline content
 */
interface AiderRule {
  file?: string;
  content?: string;
}

/**
 * Aider adapter
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
   * Get capability declarations
   */
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.aider();
  }

  /**
   * Get file patterns
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
   * Parse Aider configuration
   */
  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    let settings: ToolSettings | undefined;

    // 1. Parse main configuration file
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

    // 2. Parse rule files from rules directory
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

    // Build unified configuration
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
   * Generate Aider configuration
   */
  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    const files: GeneratedFile[] = [];

    // Generate main configuration file
    const aiderConfig: AiderConfig = {};

    // 1. Generate rules
    if (config.rules && config.rules.length > 0 && this.hasCapability(ConfigCapability.RULES)) {
      const aiderRules: AiderRule[] = [];

      for (const rule of config.rules) {
        if (rule.enabled === false) continue;

        // If rule references external file, keep the reference
        if (rule.metadata?.externalFile) {
          aiderRules.push({ file: rule.metadata.externalFile as string });
        } else {
          // Otherwise as inline rule
          aiderRules.push({ content: rule.content });
        }
      }

      if (aiderRules.length > 0) {
        aiderConfig.rules = aiderRules;
      }
    }

    // 2. Generate settings
    if (config.settings && this.hasCapability(ConfigCapability.SETTINGS)) {
      // Add settings to configuration
      for (const [key, value] of Object.entries(config.settings)) {
        if (key !== 'permissions' && key !== 'toolSpecific' && value !== undefined) {
          aiderConfig[key] = value;
        }
      }

      // Handle toolSpecific settings
      if (config.settings.toolSpecific) {
        for (const [key, value] of Object.entries(config.settings.toolSpecific)) {
          if (value !== undefined) {
            aiderConfig[key] = value;
          }
        }
      }
    }

    // Generate YAML content
    const configContent = yaml.stringify(aiderConfig, { lineWidth: 0 });

    files.push({
      path: '.aider.conf.yml',
      content: configContent,
      encoding: 'utf-8',
      overwrite: true,
    });

    // 3. Generate external rule files (if needed)
    if (config.rules && config.rules.length > 0) {
      for (const rule of config.rules) {
        if (rule.enabled === false) continue;
        if (rule.metadata?.externalFile) {
          // External rule file
          const externalRulePath = path.join('.', rule.metadata.externalFile as string);
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
   * Parse from content
   */
  async parseContent(
    content: string,
    filePath: string,
    options?: ConvertOptions
  ): Promise<ParseResult> {
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
          sourceFiles: [
            {
              path: filePath,
              absolutePath: filePath,
              exists: true,
            },
          ],
          parseTime: Date.now(),
        },
      };
    }

    // Rule files
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
          sourceFiles: [
            {
              path: filePath,
              absolutePath: filePath,
              exists: true,
            },
          ],
          parseTime: Date.now(),
        },
      };
    }

    return this.createErrorResult([
      {
        code: 'UNKNOWN_FILE_TYPE',
        message: `Unknown file type: ${filePath}`,
        file: filePath,
        recoverable: false,
      },
    ]);
  }

  // ============================================
  // Private methods - Configuration file parsing
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
        errors: [
          {
            code: 'FILE_READ_ERROR',
            message: `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`,
            file: filePath,
            recoverable: false,
          },
        ],
      };
    }
  }

  private async parseConfigContent(
    content: string,
    filePath: string
  ): Promise<{
    rules?: RuleConfig[];
    settings?: ToolSettings;
    errors?: ParseError[];
  }> {
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    const settings: ToolSettings = {};

    try {
      const aiderConfig = yaml.parse(content) as AiderConfig;

      // Parse rules
      if (aiderConfig.rules) {
        for (let i = 0; i < aiderConfig.rules.length; i++) {
          const ruleDef = aiderConfig.rules[i];

          if (ruleDef.file) {
            // File reference
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
            // Inline rule
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

      // Parse other settings
      for (const [key, value] of Object.entries(aiderConfig)) {
        if (key !== 'rules' && value !== undefined) {
          (settings as Record<string, unknown>)[key] = value;
        }
      }

      return { rules, settings: Object.keys(settings).length > 0 ? settings : undefined };
    } catch (error) {
      return {
        errors: [
          {
            code: 'YAML_PARSE_ERROR',
            message: `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
            file: filePath,
            recoverable: true,
          },
        ],
      };
    }
  }

  // ============================================
  // Private methods - Rule file parsing
  // ============================================

  private async discoverRuleFiles(projectRoot: string): Promise<FileInfo[]> {
    const rulesDir = path.join(projectRoot, '.aider.rules');

    try {
      const stats = await fs.stat(rulesDir);
      if (!stats.isDirectory()) {
        return [];
      }
    } catch {
      // Directory does not exist
      return [];
    }

    const pattern = path.join(rulesDir, '*');
    const matches = await glob(pattern, { nodir: true });

    return Promise.all(
      matches.map(async absolutePath => {
        const stats = await fs.stat(absolutePath);
        return {
          path: path.relative(projectRoot, absolutePath),
          absolutePath,
          exists: true,
          size: stats.size,
          lastModified: stats.mtime,
        };
      })
    );
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
        errors: [
          {
            code: 'FILE_READ_ERROR',
            message: `Failed to read rule file: ${error instanceof Error ? error.message : String(error)}`,
            file: filePath,
            recoverable: true,
          },
        ],
      };
    }
  }

  private parseRuleContent(
    content: string,
    filePath: string
  ): {
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
  // Helper methods
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

// Export singleton
export const aiderAdapter = new AiderAdapter();
