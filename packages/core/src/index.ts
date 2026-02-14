/**
 * Unify-AI
 * 统一的 AI Agent 工具配置管理库
 *
 * 支持的工具有:
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
 * // 导入配置
 * const result = await importer.import('/path/to/project');
 *
 * // 导出配置
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

// 便捷导出
import { adapterRegistry } from './adapters/registry';
import { importer } from './converter/Importer';
import { exporter } from './converter/Exporter';
import { fileDiscovery } from './discovery/FileDiscovery';

export const unify = {
  /**
   * 适配器注册表
   */
  registry: adapterRegistry,

  /**
   * 配置导入器
   */
  importer,

  /**
   * 配置导出器
   */
  exporter,

  /**
   * 文件发现器
   */
  discovery: fileDiscovery,

  /**
   * 快速导入配置
   */
  async importConfig(projectRoot: string) {
    return importer.import(projectRoot);
  },

  /**
   * 快速导出配置
   */
  async exportConfig(
    config: import('./core/types').UnifiedConfig,
    projectRoot: string,
    targetTool: import('./core/types').ToolId
  ) {
    return exporter.export(config, projectRoot, { targetTool });
  },

  /**
   * 检测项目使用的工具
   */
  async detectTools(projectRoot: string) {
    return fileDiscovery.detectTools(projectRoot);
  },
};
