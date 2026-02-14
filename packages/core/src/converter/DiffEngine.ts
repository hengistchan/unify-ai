/**
 * Converter - DiffEngine
 * 差异检测引擎 - 比较 unified 配置与工具配置之间的差异
 */

import { promises as fs } from 'fs';

import type { IAdapter } from '../adapters/base/IAdapter';
import type {
  UnifiedConfig,
  ToolId,
} from '../core/types';
import { adapterRegistry } from '../adapters/registry';

// ============================================
// 类型定义
// ============================================

/**
 * 差异类型
 */
export enum DiffType {
  ADDED = 'added',
  REMOVED = 'removed',
  MODIFIED = 'modified',
  MOVED = 'moved',
}

/**
 * 差异条目
 */
export interface DiffEntry {
  /** 差异类型 */
  type: DiffType;
  /** 配置路径 (JSON Path) */
  path: string;
  /** 差异来源 */
  source: 'unified' | 'tool' | 'both';
  /** Unified 配置中的值 */
  unifiedValue?: unknown;
  /** 工具配置中的值 */
  toolValue?: unknown;
  /** 差异检测时间 */
  timestamp: string;
  /** 工具 ID */
  toolId?: string;
  /** 工具名称 */
  toolName?: string;
}

/**
 * 差异结果
 */
export interface DiffResult {
  /** 工具 ID */
  toolId: string;
  /** 工具名称 */
  toolName: string;
  /** 配置文件路径 */
  configPath: string;
  /** 差异条目列表 */
  entries: DiffEntry[];
  /** 是否存在冲突 */
  hasConflicts: boolean;
  /** 差异摘要 */
  summary: DiffSummary;
}

/**
 * 差异摘要
 */
export interface DiffSummary {
  /** 新增数量 */
  added: number;
  /** 删除数量 */
  removed: number;
  /** 修改数量 */
  modified: number;
  /** 冲突数量 */
  conflicts: number;
}

/**
 * 计算所有差异的选项
 */
export interface ComputeDiffOptions {
  /** 项目根目录 */
  projectRoot: string;
  /** 是否包含未检测到的工具配置 */
  includeUndetected?: boolean;
}

// ============================================
// DiffEngine 类
// ============================================

/**
 * 差异检测引擎
 * 用于比较 unified 配置与工具配置之间的差异
 */
export class DiffEngine {
  /**
   * 深度比较两个配置对象
   * @param unified Unified 配置
   * @param generated 工具配置
   * @param path 当前路径 (可选)
   * @returns 差异条目数组
   */
  deepDiff(
    unified: unknown,
    generated: unknown,
    path?: string
  ): DiffEntry[] {
    const diffs: DiffEntry[] = [];
    const currentPath = path ?? '';
    const timestamp = new Date().toISOString();

    // 处理 null 和 undefined
    if (unified === undefined && generated === undefined) {
      return diffs;
    }

    // 处理一边为 undefined/null 的情况
    if (unified === undefined || unified === null) {
      if (generated !== undefined && generated !== null) {
        diffs.push({
          type: DiffType.ADDED,
          path: currentPath,
          source: 'tool',
          toolValue: generated,
          timestamp,
        });
      }
      return diffs;
    }

    if (generated === undefined || generated === null) {
      diffs.push({
        type: DiffType.REMOVED,
        path: currentPath,
        source: 'unified',
        unifiedValue: unified,
        timestamp,
      });
      return diffs;
    }

    // 获取所有键
    const unifiedKeys = this.isObject(unified) ? Object.keys(unified as object) : [];
    const generatedKeys = this.isObject(generated) ? Object.keys(generated as object) : [];
    const allKeys = new Set([...unifiedKeys, ...generatedKeys]);

    // 遍历所有键进行比较
    for (const key of allKeys) {
      const keyPath = currentPath ? `${currentPath}.${key}` : key;
      const unifiedVal = (unified as Record<string, unknown>)[key];
      const generatedVal = (generated as Record<string, unknown>)[key];

      // 工具配置中有，但 unified 中没有 (新增)
      if (!(key in (unified as object))) {
        diffs.push({
          type: DiffType.ADDED,
          path: keyPath,
          source: 'tool',
          toolValue: generatedVal,
          timestamp,
        });
      }
      // Unified 中有，但工具配置中没有 (删除)
      else if (!(key in (generated as object))) {
        diffs.push({
          type: DiffType.REMOVED,
          path: keyPath,
          source: 'unified',
          unifiedValue: unifiedVal,
          timestamp,
        });
      }
      // 两者都是对象，递归比较
      else if (this.isObject(unifiedVal) && this.isObject(generatedVal)) {
        const nestedDiffs = this.deepDiff(unifiedVal, generatedVal, keyPath);
        diffs.push(...nestedDiffs);
      }
      // 值不相等 (修改)
      else if (!this.isEqual(unifiedVal, generatedVal)) {
        diffs.push({
          type: DiffType.MODIFIED,
          path: keyPath,
          source: 'both',
          unifiedValue: unifiedVal,
          toolValue: generatedVal,
          timestamp,
        });
      }
    }

    return diffs;
  }

  /**
   * 比较数组类型的配置
   * @param unified Unified 配置中的数组
   * @param generated 工具配置中的数组
   * @param path 当前路径
   * @param idField 用于识别相同元素的字段名
   * @returns 差异条目数组
   */
  diffArrays(
    unified: unknown[],
    generated: unknown[],
    path: string,
    idField: string = 'id'
  ): DiffEntry[] {
    const diffs: DiffEntry[] = [];
    const timestamp = new Date().toISOString();

    // 创建 ID 到元素的映射
    const unifiedMap = new Map<string, unknown>();
    const generatedMap = new Map<string, unknown>();

    for (const item of unified ?? []) {
      if (item && typeof item === 'object' && idField in item) {
        unifiedMap.set((item as Record<string, unknown>)[idField] as string, item);
      }
    }

    for (const item of generated ?? []) {
      if (item && typeof item === 'object' && idField in item) {
        generatedMap.set((item as Record<string, unknown>)[idField] as string, item);
      }
    }

    // 找出新增的元素 (在 generated 中但不在 unified 中)
    for (const [id, value] of generatedMap) {
      if (!unifiedMap.has(id)) {
        diffs.push({
          type: DiffType.ADDED,
          path: `${path}[${id}]`,
          source: 'tool',
          toolValue: value,
          timestamp,
        });
      }
    }

    // 找出删除的元素 (在 unified 中但不在 generated 中)
    for (const [id, value] of unifiedMap) {
      if (!generatedMap.has(id)) {
        diffs.push({
          type: DiffType.REMOVED,
          path: `${path}[${id}]`,
          source: 'unified',
          unifiedValue: value,
          timestamp,
        });
      }
    }

    // 找出修改的元素
    for (const [id, unifiedItem] of unifiedMap) {
      const generatedItem = generatedMap.get(id);
      if (generatedItem) {
        const itemPath = `${path}[${id}]`;
        const itemDiffs = this.deepDiff(unifiedItem, generatedItem, itemPath);
        diffs.push(...itemDiffs);
      }
    }

    return diffs;
  }

  /**
   * 计算所有工具的差异
   * @param unified Unified 配置
   * @param toolId 特定工具 ID (可选，不指定则计算所有工具)
   * @returns 差异结果数组
   */
  async computeAllDiffs(
    unified: UnifiedConfig,
    toolId?: string
  ): Promise<DiffResult[]> {
    const results: DiffResult[] = [];
    const adapters = this.getAdaptersToCompare(toolId);

    for (const adapter of adapters) {
      try {
        const diffResult = await this.computeDiffForTool(unified, adapter);
        results.push(diffResult);
      } catch (error) {
        // 即使出错也添加一个结果，只是标记为错误
        results.push({
          toolId: adapter.toolMeta.id,
          toolName: adapter.toolMeta.name,
          configPath: '',
          entries: [],
          hasConflicts: false,
          summary: {
            added: 0,
            removed: 0,
            modified: 0,
            conflicts: 0,
          },
        });
      }
    }

    return results;
  }

  /**
   * 计算特定工具的差异
   * @param unified Unified 配置
   * @param adapter 工具适配器
   * @returns 差异结果
   */
  async computeDiffForTool(
    unified: UnifiedConfig,
    adapter: IAdapter
  ): Promise<DiffResult> {
    const toolId = adapter.toolMeta.id;
    const toolName = adapter.toolMeta.name;
    const timestamp = new Date().toISOString();

    // 获取工具的配置文件路径
    const filePatterns = adapter.getFilePatterns();
    const configPaths = filePatterns.map(p => p.pattern);

    // 尝试读取工具配置
    let toolConfig: unknown = null;
    let configPath = '';

    for (const pattern of configPaths) {
      try {
        const absolutePath = pattern; // 假设 pattern 是绝对路径或相对于当前工作目录
        const content = await fs.readFile(absolutePath, 'utf-8');
        toolConfig = JSON.parse(content);
        configPath = absolutePath;
        break;
      } catch {
        // 文件不存在或无法读取，继续尝试下一个模式
        continue;
      }
    }

    // 如果没有找到配置文件，返回空差异
    if (toolConfig === null) {
      return {
        toolId,
        toolName,
        configPath,
        entries: [],
        hasConflicts: false,
        summary: {
          added: 0,
          removed: 0,
          modified: 0,
          conflicts: 0,
        },
      };
    }

    // 生成期望的工具配置
    const generateResult = await adapter.generate(unified, { dryRun: true });
    const expectedConfig = this.extractGeneratedConfig(generateResult);

    // 比较实际配置与期望配置
    let entries = this.deepDiff(expectedConfig, toolConfig);

    // 特别处理数组类型的配置 (如 rules, mcp.servers)
    const arrayDiffs = this.compareArrayConfigs(unified, toolConfig, adapter);
    entries = [...entries, ...arrayDiffs];

    // 计算摘要
    const summary = this.computeSummary(entries);

    // 检测冲突 (MODIFIED 类型且 source 为 'both' 视为潜在冲突)
    const hasConflicts = summary.modified > 0;

    // 添加工具信息到每个差异条目
    for (const entry of entries) {
      entry.toolId = toolId;
      entry.toolName = toolName;
      entry.timestamp = timestamp;
    }

    return {
      toolId,
      toolName,
      configPath,
      entries,
      hasConflicts,
      summary,
    };
  }

  /**
   * 比较两个 UnifiedConfig 的差异
   * @param unified1 第一个 Unified 配置
   * @param unified2 第二个 Unified 配置
   * @returns 差异条目数组
   */
  compareUnified(
    unified1: UnifiedConfig,
    unified2: UnifiedConfig
  ): DiffEntry[] {
    return this.deepDiff(unified1, unified2);
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 获取要比较的适配器列表
   */
  private getAdaptersToCompare(toolId?: string): IAdapter[] {
    if (toolId) {
      const adapter = adapterRegistry.get(toolId as ToolId);
      return adapter ? [adapter] : [];
    }
    return adapterRegistry.getAll();
  }

  /**
   * 从生成结果中提取配置
   */
  private extractGeneratedConfig(generateResult: { files: { content: string | Buffer }[] }): unknown {
    if (generateResult.files.length === 0) {
      return {};
    }

    try {
      const content = generateResult.files[0].content;
      if (typeof content === 'string') {
        return JSON.parse(content);
      }
      return JSON.parse(content.toString('utf-8'));
    } catch {
      return {};
    }
  }

  /**
   * 比较数组类型的配置
   */
  private compareArrayConfigs(
    unified: UnifiedConfig,
    toolConfig: unknown,
    adapter: IAdapter
  ): DiffEntry[] {
    const diffs: DiffEntry[] = [];
    const timestamp = new Date().toISOString();

    // 比较 rules
    if (unified.rules?.length) {
      const toolRules = (toolConfig as Record<string, unknown>)?.rules;
      if (Array.isArray(toolRules)) {
        const ruleDiffs = this.diffArrays(
          unified.rules,
          toolRules,
          'rules',
          'id'
        );
        diffs.push(...ruleDiffs);
      }
    }

    // 比较 MCP servers
    if (unified.mcp?.servers?.length) {
      const toolMcp = (toolConfig as Record<string, unknown>)?.mcp;
      if (toolMcp && typeof toolMcp === 'object') {
        const toolServers = (toolMcp as Record<string, unknown>)?.servers;
        if (Array.isArray(toolServers)) {
          const mcpDiffs = this.diffArrays(
            unified.mcp.servers,
            toolServers,
            'mcp.servers',
            'name'
          );
          diffs.push(...mcpDiffs);
        }
      }
    }

    return diffs;
  }

  /**
   * 计算差异摘要
   */
  private computeSummary(entries: DiffEntry[]): DiffSummary {
    const summary: DiffSummary = {
      added: 0,
      removed: 0,
      modified: 0,
      conflicts: 0,
    };

    for (const entry of entries) {
      switch (entry.type) {
        case DiffType.ADDED:
          summary.added++;
          break;
        case DiffType.REMOVED:
          summary.removed++;
          break;
        case DiffType.MODIFIED:
          summary.modified++;
          // 如果 source 是 'both'，则视为冲突
          if (entry.source === 'both') {
            summary.conflicts++;
          }
          break;
        case DiffType.MOVED:
          summary.modified++;
          break;
      }
    }

    return summary;
  }

  /**
   * 检查值是否为对象
   */
  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * 检查两个值是否相等
   */
  private isEqual(a: unknown, b: unknown): boolean {
    // 基本类型比较
    if (a === b) {
      return true;
    }

    // 处理 null 和 undefined
    if (a === null || a === undefined || b === null || b === undefined) {
      return a === b;
    }

    // 如果类型不同，不相等
    if (typeof a !== typeof b) {
      return false;
    }

    // 处理日期
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    // 处理数组
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }
      for (let i = 0; i < a.length; i++) {
        if (!this.isEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }

    // 处理对象
    if (typeof a === 'object' && typeof b === 'object') {
      const aKeys = Object.keys(a as object);
      const bKeys = Object.keys(b as object);

      if (aKeys.length !== bKeys.length) {
        return false;
      }

      for (const key of aKeys) {
        if (!this.isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
          return false;
        }
      }

      return true;
    }

    return false;
  }
}

// ============================================
// 导出单例
// ============================================

/**
 * DiffEngine 单例实例
 */
export const diffEngine: DiffEngine = new DiffEngine();
