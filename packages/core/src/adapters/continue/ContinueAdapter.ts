/**
 * Continue.dev Adapter
 *
 * Continue.dev configuration format:
 * - .continue/config.yaml - Single YAML file containing all configuration
 *
 * Supported capabilities:
 * - Rules: rules array in YAML
 * - MCP: mcpServers object in YAML
 * - Settings: Various settings in YAML
 * - Prompts: prompts array in YAML
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

import { BaseAdapter } from '../base/BaseAdapter';
import type { IAdapter } from '../base/IAdapter';
import {
  ConfigCapability,
  ToolId,
  type UnifiedConfig,
  type RuleConfig,
  type MCPServerConfig,
  type MCPConfig,
  type ToolSettings,
  type PromptTemplate,
  type PromptVariable,
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
 * Continue.dev config.yaml structure
 */
interface ContinueConfig {
  models?: Array<{
    name: string;
    provider: string;
    model?: string;
    apiBase?: string;
    apiKey?: string;
    contextLength?: number;
    [key: string]: unknown;
  }>;

  rules?: string[];

  mcpServers: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    disabled?: boolean;
    [key: string]: unknown;
  }>;

  prompts?: Array<{
    name: string;
    description?: string;
    template: string;
    [key: string]: unknown;
  }>;

  context?: string[];

  tabAutocompleteModel?: {
    name: string;
    provider: string;
    [key: string]: unknown;
  };

  embeddingsModel?: {
    name: string;
    provider: string;
    [key: string]: unknown;
  };

  reranker?: {
    name: string;
    provider: string;
    [key: string]: unknown;
  };

  [key: string]: unknown;
}

/**
 * Continue.dev Adapter
 */
export class ContinueAdapter extends BaseAdapter implements IAdapter {
  readonly toolMeta: ToolMeta = {
    id: ToolId.CONTINUE,
    name: 'Continue',
    description: 'Open-source AI code assistant extension',
    website: 'https://continue.dev',
    repository: 'https://github.com/continuedev/continue',
  };

  readonly version = '1.0.0';

  /**
   * Get capability declarations
   */
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.continue();
  }

  /**
   * Get file patterns
   */
  getFilePatterns(): FilePattern[] {
    return [
      {
        pattern: '.continue/config.yaml',
        type: 'required',
        capability: ConfigCapability.RULES,
        description: 'Continue.dev main configuration file',
      },
      {
        pattern: '.continue/config.yml',
        type: 'optional',
        capability: ConfigCapability.RULES,
        description: 'Continue.dev configuration file (alternate extension)',
      },
    ];
  }

  /**
   * Parse Continue.dev configuration
   */
  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];
    let mcp: MCPConfig | undefined;
    let settings: ToolSettings | undefined;
    const prompts: PromptTemplate[] = [];

    // Find config file
    const configPath = await this.findConfigFile(projectRoot);

    if (!configPath) {
      return this.createErrorResult([{
        code: 'CONFIG_NOT_FOUND',
        message: 'Continue.dev config.yaml not found',
        recoverable: false,
      }]);
    }

    sourceFiles.push({
      path: path.relative(projectRoot, configPath),
      absolutePath: configPath,
      exists: true,
    });

    // Parse config file
    const parseResult = await this.parseConfigFile(configPath);
    if (parseResult.errors) {
      errors.push(...parseResult.errors);
    }

    if (parseResult.config) {
      // Extract rules
      if (parseResult.config.rules) {
        for (let i = 0; i < parseResult.config.rules.length; i++) {
          const ruleContent = parseResult.config.rules[i];
          rules.push({
            id: this.generateRuleId(`rule-${i + 1}`),
            name: `Rule ${i + 1}`,
            content: ruleContent,
            metadata: {
              source: 'continue',
              index: i,
            },
          });
        }
      }

      // Extract MCP servers
      if (parseResult.config.mcpServers) {
        const servers: MCPServerConfig[] = [];
        for (const [name, server] of Object.entries(parseResult.config.mcpServers)) {
          servers.push({
            name,
            command: server.command,
            args: server.args,
            env: server.env,
            cwd: server.cwd,
            disabled: server.disabled,
            metadata: {
              source: 'continue',
              originalConfig: server,
            },
          });
        }
        mcp = { servers };
      }

      // Extract prompts
      if (parseResult.config.prompts) {
        for (let i = 0; i < parseResult.config.prompts.length; i++) {
          const prompt = parseResult.config.prompts[i];
          prompts.push({
            id: this.generatePromptId(prompt.name, i),
            name: prompt.name,
            description: prompt.description,
            template: prompt.template,
            variables: this.extractPromptVariables(prompt.template),
          });
        }
      }

      // Extract settings
      settings = this.extractSettings(parseResult.config);
    }

    // Build unified config
    const config: UnifiedConfig = {
      version: '1.0',
      sourceTool: ToolId.CONTINUE,
      rules,
      mcp,
      settings,
      prompts: prompts.length > 0 ? prompts : undefined,
      contextFiles: parseResult.config?.context,
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
   * Generate Continue.dev configuration
   */
  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    const files: GeneratedFile[] = [];
    const continueConfig: ContinueConfig = { mcpServers: {} };

    // 1. Generate rules
    if (config.rules && config.rules.length > 0 && this.hasCapability(ConfigCapability.RULES)) {
      continueConfig.rules = config.rules
        .filter(rule => rule.enabled !== false)
        .map(rule => rule.content);
    }

    // 2. Generate MCP servers
    if (config.mcp?.servers?.length && this.hasCapability(ConfigCapability.MCP_SERVERS)) {
      continueConfig.mcpServers = {};
      for (const server of config.mcp.servers) {
        continueConfig.mcpServers[server.name] = {
          command: server.command,
          args: server.args,
          env: server.env,
          cwd: server.cwd,
          disabled: server.disabled,
        };
      }
    }

    // 3. Generate prompts
    if (config.prompts?.length && this.hasCapability(ConfigCapability.PROMPTS)) {
      continueConfig.prompts = config.prompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        template: prompt.template,
      }));
    }

    // 4. Generate settings
    if (config.settings && this.hasCapability(ConfigCapability.SETTINGS)) {
      this.applySettings(continueConfig, config.settings);
    }

    // 5. Generate context files
    if (config.contextFiles?.length) {
      continueConfig.context = config.contextFiles;
    }

    // Generate YAML content
    const yamlContent = this.generateYaml(continueConfig);
    files.push({
      path: '.continue/config.yaml',
      content: yamlContent,
      encoding: 'utf-8',
      overwrite: true,
    });

    return {
      success: true,
      files,
    };
  }

  /**
   * Parse from content string
   */
  async parseContent(content: string, filePath: string, options?: ConvertOptions): Promise<ParseResult> {
    const result = await this.parseConfigContent(content);

    if (result.errors && result.errors.length > 0) {
      return {
        success: false,
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

    const rules: RuleConfig[] = [];
    let mcp: MCPConfig | undefined;
    let settings: ToolSettings | undefined;
    const prompts: PromptTemplate[] = [];

    if (result.config) {
      // Extract rules
      if (result.config.rules) {
        for (let i = 0; i < result.config.rules.length; i++) {
          const ruleContent = result.config.rules[i];
          rules.push({
            id: this.generateRuleId(`rule-${i + 1}`),
            name: `Rule ${i + 1}`,
            content: ruleContent,
            metadata: {
              source: 'continue',
              index: i,
            },
          });
        }
      }

      // Extract MCP servers
      if (result.config.mcpServers) {
        const servers: MCPServerConfig[] = [];
        for (const [name, server] of Object.entries(result.config.mcpServers)) {
          servers.push({
            name,
            command: server.command,
            args: server.args,
            env: server.env,
            cwd: server.cwd,
            disabled: server.disabled,
          });
        }
        mcp = { servers };
      }

      // Extract prompts
      if (result.config.prompts) {
        for (let i = 0; i < result.config.prompts.length; i++) {
          const prompt = result.config.prompts[i];
          prompts.push({
            id: this.generatePromptId(prompt.name, i),
            name: prompt.name,
            description: prompt.description,
            template: prompt.template,
            variables: this.extractPromptVariables(prompt.template),
          });
        }
      }

      // Extract settings
      settings = this.extractSettings(result.config);
    }

    return {
      success: true,
      data: {
        version: '1.0',
        sourceTool: ToolId.CONTINUE,
        rules,
        mcp,
        settings,
        prompts: prompts.length > 0 ? prompts : undefined,
        contextFiles: result.config?.context,
      },
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

  // ============================================
  // Private Methods - Config File Handling
  // ============================================

  private async findConfigFile(projectRoot: string): Promise<string | null> {
    const yamlPath = path.join(projectRoot, '.continue/config.yaml');
    const ymlPath = path.join(projectRoot, '.continue/config.yml');

    if (await this.fileExists(yamlPath)) {
      return yamlPath;
    }
    if (await this.fileExists(ymlPath)) {
      return ymlPath;
    }
    return null;
  }

  private async parseConfigFile(filePath: string): Promise<{
    config?: ContinueConfig;
    errors?: ParseError[];
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseConfigContent(content);
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

  private async parseConfigContent(content: string): Promise<{
    config?: ContinueConfig;
    errors?: ParseError[];
  }> {
    try {
      const config = yaml.parse(content) as ContinueConfig;
      return { config };
    } catch (error) {
      return {
        errors: [{
          code: 'YAML_PARSE_ERROR',
          message: `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: false,
        }],
      };
    }
  }

  // ============================================
  // Private Methods - Settings Extraction
  // ============================================

  private extractSettings(config: ContinueConfig): ToolSettings {
    const settings: ToolSettings = {
      toolSpecific: {},
    };

    // Extract model configuration
    if (config.models && config.models.length > 0) {
      settings.model = {
        default: config.models[0].name,
        available: config.models.map(m => m.name),
      };
      settings.toolSpecific!.models = config.models;
    }

    // Extract tab autocomplete model
    if (config.tabAutocompleteModel) {
      settings.toolSpecific!.tabAutocompleteModel = config.tabAutocompleteModel;
    }

    // Extract embeddings model
    if (config.embeddingsModel) {
      settings.toolSpecific!.embeddingsModel = config.embeddingsModel;
    }

    // Extract reranker
    if (config.reranker) {
      settings.toolSpecific!.reranker = config.reranker;
    }

    return settings;
  }

  private applySettings(config: ContinueConfig, settings: ToolSettings): void {
    // Apply model configuration
    if (settings.model) {
      const models = settings.toolSpecific?.models as ContinueConfig['models'];
      if (models) {
        config.models = models;
      } else if (settings.model.default) {
        config.models = [{
          name: settings.model.default,
          provider: 'anthropic', // Default provider
        }];
      }
    }

    // Apply tool-specific settings
    if (settings.toolSpecific) {
      if (settings.toolSpecific.tabAutocompleteModel) {
        config.tabAutocompleteModel = settings.toolSpecific.tabAutocompleteModel as ContinueConfig['tabAutocompleteModel'];
      }
      if (settings.toolSpecific.embeddingsModel) {
        config.embeddingsModel = settings.toolSpecific.embeddingsModel as ContinueConfig['embeddingsModel'];
      }
      if (settings.toolSpecific.reranker) {
        config.reranker = settings.toolSpecific.reranker as ContinueConfig['reranker'];
      }
    }
  }

  // ============================================
  // Private Methods - Prompt Variables
  // ============================================

  private extractPromptVariables(template: string): PromptVariable[] | undefined {
    const variables: PromptVariable[] = [];
    // Match {variableName} pattern
    const varPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const seen = new Set<string>();
    let match;

    while ((match = varPattern.exec(template)) !== null) {
      const varName = match[1];
      if (!seen.has(varName)) {
        seen.add(varName);
        variables.push({
          name: varName,
          type: 'string',
          required: true,
        });
      }
    }

    return variables.length > 0 ? variables : undefined;
  }

  // ============================================
  // Private Methods - YAML Generation
  // ============================================

  private generateYaml(config: ContinueConfig): string {
    // Filter out undefined/null values
    const cleaned = this.removeEmptyValues(config);
    return yaml.stringify(cleaned, {
      indent: 2,
      lineWidth: 0, // Don't wrap lines
      defaultStringType: 'QUOTE_DOUBLE',
      defaultKeyType: 'PLAIN',
    });
  }

  private removeEmptyValues(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value) && value.length === 0) {
        continue;
      }
      if (typeof value === 'object' && !Array.isArray(value)) {
        const cleaned = this.removeEmptyValues(value as Record<string, unknown>);
        if (Object.keys(cleaned).length === 0) {
          continue;
        }
        result[key] = cleaned;
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  // ============================================
  // Private Methods - ID Generation
  // ============================================

  private generateRuleId(name: string): string {
    return `continue-rule-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  }

  private generatePromptId(name: string, index: number): string {
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `continue-prompt-${safeName}-${index}`;
  }

  // ============================================
  // Private Methods - Utilities
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

// Export singleton instance
export const continueAdapter = new ContinueAdapter();
