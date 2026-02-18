/**
 * Unify-AI
 * Unified AI Agent tool configuration management library
 *
 * Supported tools:
 * - Cursor
 * - Claude Code
 * - OpenAI Codex
 * - GitHub Copilot
 * - Windsurf
 * - Cline
 * - Aider
 * - Continue.dev
 *
 * @example
 * ```typescript
 * import { importer, exporter, adapterRegistry } from 'unify-ai';
 *
 * // Import configuration
 * const result = await importer.import('/path/to/project');
 *
 * // Export configuration
 * await exporter.export(result.config, '/path/to/project', {
 *   targetTool: 'claude-code',
 * });
 * ```
 */

// Core
export * from './core';

// Adapters
export * from './adapters';

// Discovery
export * from './discovery';

// Converter
export * from './converter';

// Model Configuration Management
export * from './model';

// Convenience exports
import { adapterRegistry } from './adapters/registry';
import { importer } from './converter/Importer';
import { exporter } from './converter/Exporter';
import { fileDiscovery } from './discovery/FileDiscovery';

export const unify = {
  /**
   * Adapter registry
   */
  registry: adapterRegistry,

  /**
   * Configuration importer
   */
  importer,

  /**
   * Configuration exporter
   */
  exporter,

  /**
   * File discoverer
   */
  discovery: fileDiscovery,

  /**
   * Quick import configuration
   */
  async importConfig(projectRoot: string) {
    return importer.import(projectRoot);
  },

  /**
   * Quick export configuration
   */
  async exportConfig(
    config: import('./core/types').UnifiedConfig,
    projectRoot: string,
    targetTool: import('./core/types').ToolId
  ) {
    return exporter.export(config, projectRoot, { targetTool });
  },

  /**
   * Detect tools used in project
   */
  async detectTools(projectRoot: string) {
    return fileDiscovery.detectTools(projectRoot);
  },
};
