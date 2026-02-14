/**
 * Converter - DiffEngine
 * Diff detection engine - compares differences between unified config and tool config
 */

import { promises as fs } from 'fs';

import type { IAdapter } from '../adapters/base/IAdapter';
import type {
  UnifiedConfig,
  ToolId,
} from '../core/types';
import { adapterRegistry } from '../adapters/registry';

// ============================================
// Type definitions
// ============================================

/**
 * Diff type
 */
export enum DiffType {
  ADDED = 'added',
  REMOVED = 'removed',
  MODIFIED = 'modified',
  MOVED = 'moved',
}

/**
 * Diff entry
 */
export interface DiffEntry {
  /** Diff type */
  type: DiffType;
  /** Configuration path (JSON Path) */
  path: string;
  /** Diff source */
  source: 'unified' | 'tool' | 'both';
  /** Value in Unified config */
  unifiedValue?: unknown;
  /** Value in tool config */
  toolValue?: unknown;
  /** Diff detection time */
  timestamp: string;
  /** Tool ID */
  toolId?: string;
  /** Tool name */
  toolName?: string;
}

/**
 * Diff result
 */
export interface DiffResult {
  /** Tool ID */
  toolId: string;
  /** Tool name */
  toolName: string;
  /** Configuration file path */
  configPath: string;
  /** Diff entry list */
  entries: DiffEntry[];
  /** Whether there are conflicts */
  hasConflicts: boolean;
  /** Diff summary */
  summary: DiffSummary;
}

/**
 * Diff summary
 */
export interface DiffSummary {
  /** Number added */
  added: number;
  /** Number removed */
  removed: number;
  /** Number modified */
  modified: number;
  /** Number of conflicts */
  conflicts: number;
}

/**
 * Options for computing all diffs
 */
export interface ComputeDiffOptions {
  /** Project root directory */
  projectRoot: string;
  /** Whether to include undetected tool configurations */
  includeUndetected?: boolean;
}

// ============================================
// DiffEngine class
// ============================================

/**
 * Diff detection engine
 * Used to compare differences between unified config and tool config
 */
export class DiffEngine {
  /**
   * Deep compare two configuration objects
   * @param unified Unified config
   * @param generated tool config
   * @param path Current path (optional)
   * @returns Diff entry array
   */
  deepDiff(
    unified: unknown,
    generated: unknown,
    path?: string
  ): DiffEntry[] {
    const diffs: DiffEntry[] = [];
    const currentPath = path ?? '';
    const timestamp = new Date().toISOString();

    // Handle null and undefined
    if (unified === undefined && generated === undefined) {
      return diffs;
    }

    // Handle case where one side is undefined/null
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

    // Get all keys
    const unifiedKeys = this.isObject(unified) ? Object.keys(unified as object) : [];
    const generatedKeys = this.isObject(generated) ? Object.keys(generated as object) : [];
    const allKeys = new Set([...unifiedKeys, ...generatedKeys]);

    // Iterate through all keys to compare
    for (const key of allKeys) {
      const keyPath = currentPath ? `${currentPath}.${key}` : key;
      const unifiedVal = (unified as Record<string, unknown>)[key];
      const generatedVal = (generated as Record<string, unknown>)[key];

      // Tool config has but unified doesn't have (added)
      if (!(key in (unified as object))) {
        diffs.push({
          type: DiffType.ADDED,
          path: keyPath,
          source: 'tool',
          toolValue: generatedVal,
          timestamp,
        });
      }
      // Unified has but tool config doesn't have (removed)
      else if (!(key in (generated as object))) {
        diffs.push({
          type: DiffType.REMOVED,
          path: keyPath,
          source: 'unified',
          unifiedValue: unifiedVal,
          timestamp,
        });
      }
      // Both are objects, recursively compare
      else if (this.isObject(unifiedVal) && this.isObject(generatedVal)) {
        const nestedDiffs = this.deepDiff(unifiedVal, generatedVal, keyPath);
        diffs.push(...nestedDiffs);
      }
      // Values not equal (modified)
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
   * Compare array-type configurations
   * @param unified Array in Unified config
   * @param generated Array in tool config
   * @param path Current path
   * @param idField Field name for identifying same elements
   * @returns Diff entry array
   */
  diffArrays(
    unified: unknown[],
    generated: unknown[],
    path: string,
    idField: string = 'id'
  ): DiffEntry[] {
    const diffs: DiffEntry[] = [];
    const timestamp = new Date().toISOString();

    // Create ID to element mapping
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

    // Find added elements (in generated but not in unified)
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

    // Find removed elements (in unified but not in generated)
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

    // Find modified elements
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
   * Compute diffs for all tools
   * @param unified Unified config
   * @param toolId Specific tool ID (optional, if not specified compute all tools)
   * @returns Diff result array
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
        // Even if error, add a result, just mark as error
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
   * Compute diff for specific tool
   * @param unified Unified config
   * @param adapter Tool adapter
   * @returns Diff result
   */
  async computeDiffForTool(
    unified: UnifiedConfig,
    adapter: IAdapter
  ): Promise<DiffResult> {
    const toolId = adapter.toolMeta.id;
    const toolName = adapter.toolMeta.name;
    const timestamp = new Date().toISOString();

    // Get tool's configuration file paths
    const filePatterns = adapter.getFilePatterns();
    const configPaths = filePatterns.map(p => p.pattern);

    // Try to read tool config
    let toolConfig: unknown = null;
    let configPath = '';

    for (const pattern of configPaths) {
      try {
        const absolutePath = pattern; // Assume pattern is absolute or relative to current working directory
        const content = await fs.readFile(absolutePath, 'utf-8');
        toolConfig = JSON.parse(content);
        configPath = absolutePath;
        break;
      } catch {
        // File doesn't exist or can't be read, continue trying next pattern
        continue;
      }
    }

    // If no config file found, return empty diff
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

    // Generate expected tool config
    const generateResult = await adapter.generate(unified, { dryRun: true });
    const expectedConfig = this.extractGeneratedConfig(generateResult);

    // Compare actual config with expected config
    let entries = this.deepDiff(expectedConfig, toolConfig);

    // Specially handle array-type configs (like rules, mcp.servers)
    const arrayDiffs = this.compareArrayConfigs(unified, toolConfig, adapter);
    entries = [...entries, ...arrayDiffs];

    // Compute summary
    const summary = this.computeSummary(entries);

    // Detect conflicts (MODIFIED type with source 'both' is considered potential conflict)
    const hasConflicts = summary.modified > 0;

    // Add tool info to each diff entry
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
   * Compare differences between two UnifiedConfig
   * @param unified1 First Unified config
   * @param unified2 Second Unified config
   * @returns Array of diff entries
   */
  compareUnified(
    unified1: UnifiedConfig,
    unified2: UnifiedConfig
  ): DiffEntry[] {
    return this.deepDiff(unified1, unified2);
  }

  // ============================================
  // Private methods
  // ============================================

  /**
   * Get list of adapters to compare
   */
  private getAdaptersToCompare(toolId?: string): IAdapter[] {
    if (toolId) {
      const adapter = adapterRegistry.get(toolId as ToolId);
      return adapter ? [adapter] : [];
    }
    return adapterRegistry.getAll();
  }

  /**
   * Extract config from generation result
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
   * Compare array-type configurations
   */
  private compareArrayConfigs(
    unified: UnifiedConfig,
    toolConfig: unknown,
    adapter: IAdapter
  ): DiffEntry[] {
    const diffs: DiffEntry[] = [];
    const timestamp = new Date().toISOString();

    // Compare rules
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

    // Compare MCP servers
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
   * Compute diff summary
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
          // If source is 'both', consider as conflict
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
   * Check if value is object
   */
  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Check if two values are equal
   */
  private isEqual(a: unknown, b: unknown): boolean {
    // Basic type comparison
    if (a === b) {
      return true;
    }

    // Handle null and undefined
    if (a === null || a === undefined || b === null || b === undefined) {
      return a === b;
    }

    // If types different, not equal
    if (typeof a !== typeof b) {
      return false;
    }

    // Handle dates
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    // Handle arrays
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

    // Handle objects
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
// Export singleton
// ============================================

/**
 * DiffEngine singleton instance
 */
export const diffEngine: DiffEngine = new DiffEngine();
