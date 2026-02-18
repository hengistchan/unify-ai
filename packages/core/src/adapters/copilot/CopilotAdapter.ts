/**
 * GitHub Copilot Adapter
 *
 * GitHub Copilot configuration format:
 * - .github/copilot-instructions.md - Custom instructions (Markdown)
 *
 * Note: GitHub Copilot only supports rules/custom instructions.
 * MCP servers and settings are not supported via file configuration.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import { BaseAdapter } from '../base/BaseAdapter';
import type { IAdapter } from '../base/IAdapter';
import {
  ConfigCapability,
  ToolId,
  type UnifiedConfig,
  type RuleConfig,
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
 * GitHub Copilot adapter
 */
export class CopilotAdapter extends BaseAdapter implements IAdapter {
  readonly toolMeta: ToolMeta = {
    id: ToolId.COPILOT,
    name: 'GitHub Copilot',
    description: 'AI pair programmer by GitHub',
    website: 'https://github.com/features/copilot',
    repository: 'https://github.com/github/copilot',
  };

  readonly version = '1.0.0';

  /**
   * Get capability declarations
   */
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.copilot();
  }

  /**
   * Get file patterns
   */
  getFilePatterns(): FilePattern[] {
    return [
      {
        pattern: '.github/copilot-instructions.md',
        type: 'optional',
        capability: ConfigCapability.RULES,
        description: 'GitHub Copilot custom instructions file',
      },
    ];
  }

  /**
   * Parse GitHub Copilot configuration
   */
  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    const startTime = Date.now();
    const sourceFiles: FileInfo[] = [];
    const errors: ParseError[] = [];
    const rules: RuleConfig[] = [];

    // Parse the copilot-instructions.md file
    const instructionsPath = path.join(projectRoot, '.github/copilot-instructions.md');
    if (await this.fileExists(instructionsPath)) {
      sourceFiles.push({
        path: '.github/copilot-instructions.md',
        absolutePath: instructionsPath,
        exists: true,
      });
      const result = await this.parseInstructionsFile(instructionsPath);
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
      sourceTool: ToolId.COPILOT,
      rules,
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
   * Generate GitHub Copilot configuration
   */
  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    const files: GeneratedFile[] = [];

    // Generate copilot-instructions.md
    // Note: Copilot only supports rules, not MCP or settings
    if (config.rules && config.rules.length > 0 && this.hasCapability(ConfigCapability.RULES)) {
      const content = this.generateInstructionsContent(config.rules);
      files.push({
        path: '.github/copilot-instructions.md',
        content,
        encoding: 'utf-8',
        overwrite: true,
      });
    }

    return {
      success: true,
      files,
    };
  }

  /**
   * Parse from content string
   */
  async parseContent(
    content: string,
    filePath: string,
    options?: ConvertOptions
  ): Promise<ParseResult> {
    const fileName = path.basename(filePath);

    if (fileName === 'copilot-instructions.md' || filePath.endsWith('.md')) {
      const result = await this.parseMarkdownContent(content, filePath);
      return {
        success: result.errors === undefined || result.errors.length === 0,
        data: {
          version: '1.0',
          sourceTool: ToolId.COPILOT,
          rules: result.rules,
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
  // Private methods - Instructions parsing
  // ============================================

  private async parseInstructionsFile(filePath: string): Promise<{
    rules: RuleConfig[];
    errors?: ParseError[];
  }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseMarkdownContent(content, filePath);
    } catch (error) {
      return {
        rules: [],
        errors: [
          {
            code: 'FILE_READ_ERROR',
            message: `Failed to read copilot-instructions.md: ${error instanceof Error ? error.message : String(error)}`,
            file: filePath,
            recoverable: false,
          },
        ],
      };
    }
  }

  private async parseMarkdownContent(
    content: string,
    filePath: string
  ): Promise<{
    rules: RuleConfig[];
    errors?: ParseError[];
  }> {
    const rules: RuleConfig[] = [];

    // GitHub Copilot uses a single instructions file
    // We treat the entire content as a single rule
    const rule: RuleConfig = {
      id: 'copilot-instructions',
      name: 'Copilot Instructions',
      description: 'Custom instructions for GitHub Copilot',
      content: content.trim(),
      metadata: {
        source: 'copilot',
        originalPath: filePath,
      },
    };

    rules.push(rule);
    return { rules };
  }

  private generateInstructionsContent(rules: RuleConfig[]): string {
    // If there's only one rule, output its content directly
    if (rules.length === 1) {
      return rules[0].content;
    }

    // Multiple rules: combine them into a single document
    const sections: string[] = [];

    for (const rule of rules) {
      if (rule.enabled !== false) {
        const header = rule.name ? `## ${rule.name}\n\n` : '';
        sections.push(`${header}${rule.content}`);
      }
    }

    return sections.join('\n\n---\n\n');
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

// Export singleton instance
export const copilotAdapter = new CopilotAdapter();
