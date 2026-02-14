/**
 * Conflict Resolver
 * 配置冲突解决器
 */

import type { UnifiedConfig, RuleConfig, MCPServerConfig } from '../core/types';
import type { ToolId } from '../core/types';

/**
 * 冲突类型
 */
export enum ConflictType {
  RULE_DUPLICATE = 'rule_duplicate',
  RULE_CONTENT_DIFF = 'rule_content_diff',
  MCP_DUPLICATE = 'mcp_duplicate',
  MCP_CONFIG_DIFF = 'mcp_config_diff',
  SETTINGS_CONFLICT = 'settings_conflict',
}

/**
 * 冲突信息
 */
export interface Conflict {
  type: ConflictType;
  description: string;
  sources: ToolId[];
  data: {
    existing: unknown;
    incoming: unknown;
  };
  resolution?: ConflictResolution;
}

/**
 * 冲突解决策略
 */
export type ConflictStrategy = 'skip' | 'overwrite' | 'merge' | 'ask';

/**
 * 冲突解决结果
 */
export interface ConflictResolution {
  action: 'keep_existing' | 'use_incoming' | 'merge' | 'skip';
  result?: unknown;
}

/**
 * 冲突解决器
 */
export class ConflictResolver {
  private strategy: ConflictStrategy;
  private customResolver?: (conflict: Conflict) => ConflictResolution;

  constructor(
    strategy: ConflictStrategy = 'merge',
    customResolver?: (conflict: Conflict) => ConflictResolution
  ) {
    this.strategy = strategy;
    this.customResolver = customResolver;
  }

  /**
   * 解决规则冲突
   */
  resolveRuleConflicts(
    existing: RuleConfig[],
    incoming: RuleConfig[],
    sourceTool: ToolId
  ): { rules: RuleConfig[]; conflicts: Conflict[] } {
    const conflicts: Conflict[] = [];
    const result: RuleConfig[] = [...existing];
    const existingIds = new Map(existing.map(r => [r.id, r]));

    for (const rule of incoming) {
      const existingRule = existingIds.get(rule.id);

      if (!existingRule) {
        // 无冲突，直接添加
        result.push(rule);
        continue;
      }

      // 检测冲突
      if (this.isRuleContentDifferent(existingRule, rule)) {
        const conflict: Conflict = {
          type: ConflictType.RULE_CONTENT_DIFF,
          description: `Rule "${rule.name || rule.id}" has different content`,
          sources: [sourceTool],
          data: {
            existing: existingRule,
            incoming: rule,
          },
        };

        const resolution = this.resolveConflict(conflict);
        conflict.resolution = resolution;

        conflicts.push(conflict);

        if (resolution.action === 'use_incoming') {
          const index = result.findIndex(r => r.id === rule.id);
          if (index >= 0) {
            result[index] = rule;
          }
        } else if (resolution.action === 'merge') {
          const merged = this.mergeRules(existingRule, rule);
          const index = result.findIndex(r => r.id === rule.id);
          if (index >= 0) {
            result[index] = merged;
          }
        }
        // 'keep_existing' 和 'skip' 不做任何操作
      }
    }

    return { rules: result, conflicts };
  }

  /**
   * 解决 MCP 服务器冲突
   */
  resolveMCPConflicts(
    existing: MCPServerConfig[],
    incoming: MCPServerConfig[],
    sourceTool: ToolId
  ): { servers: MCPServerConfig[]; conflicts: Conflict[] } {
    const conflicts: Conflict[] = [];
    const result: MCPServerConfig[] = [...existing];
    const existingNames = new Map(existing.map(s => [s.name, s]));

    for (const server of incoming) {
      const existingServer = existingNames.get(server.name);

      if (!existingServer) {
        result.push(server);
        continue;
      }

      if (this.isMCPServerDifferent(existingServer, server)) {
        const conflict: Conflict = {
          type: ConflictType.MCP_CONFIG_DIFF,
          description: `MCP server "${server.name}" has different configuration`,
          sources: [sourceTool],
          data: {
            existing: existingServer,
            incoming: server,
          },
        };

        const resolution = this.resolveConflict(conflict);
        conflict.resolution = resolution;

        conflicts.push(conflict);

        if (resolution.action === 'use_incoming') {
          const index = result.findIndex(s => s.name === server.name);
          if (index >= 0) {
            result[index] = server;
          }
        } else if (resolution.action === 'merge') {
          const merged = this.mergeMCPServers(existingServer, server);
          const index = result.findIndex(s => s.name === server.name);
          if (index >= 0) {
            result[index] = merged;
          }
        }
      }
    }

    return { servers: result, conflicts };
  }

  /**
   * 解决配置冲突
   */
  resolveConfigConflicts(
    existing: UnifiedConfig,
    incoming: UnifiedConfig,
    sourceTool: ToolId
  ): { config: UnifiedConfig; conflicts: Conflict[] } {
    const allConflicts: Conflict[] = [];

    // 解决规则冲突
    const ruleResult = this.resolveRuleConflicts(
      existing.rules,
      incoming.rules,
      sourceTool
    );
    allConflicts.push(...ruleResult.conflicts);

    // 解决 MCP 冲突
    let mcpConfig = existing.mcp;
    if (incoming.mcp?.servers?.length) {
      const mcpResult = this.resolveMCPConflicts(
        existing.mcp?.servers ?? [],
        incoming.mcp.servers,
        sourceTool
      );
      allConflicts.push(...mcpResult.conflicts);
      mcpConfig = { servers: mcpResult.servers };
    }

    const mergedConfig: UnifiedConfig = {
      ...existing,
      rules: ruleResult.rules,
      mcp: mcpConfig,
    };

    // 合并其他字段
    if (incoming.settings) {
      mergedConfig.settings = this.mergeSettings(existing.settings, incoming.settings);
    }

    if (incoming.commands) {
      mergedConfig.commands = [...(existing.commands ?? []), ...incoming.commands];
    }

    if (incoming.prompts) {
      mergedConfig.prompts = [...(existing.prompts ?? []), ...incoming.prompts];
    }

    return { config: mergedConfig, conflicts: allConflicts };
  }

  // ============================================
  // 私有方法
  // ============================================

  private resolveConflict(conflict: Conflict): ConflictResolution {
    // 如果有自定义解决器，优先使用
    if (this.customResolver) {
      return this.customResolver(conflict);
    }

    // 根据策略决定
    switch (this.strategy) {
      case 'skip':
        return { action: 'skip' };

      case 'overwrite':
        return { action: 'use_incoming' };

      case 'merge':
        return { action: 'merge' };

      case 'ask':
        // 在实际应用中，这里应该调用交互式 UI
        // 这里默认使用 merge 策略
        return { action: 'merge' };

      default:
        return { action: 'keep_existing' };
    }
  }

  private isRuleContentDifferent(a: RuleConfig, b: RuleConfig): boolean {
    return a.content !== b.content ||
           a.name !== b.name ||
           JSON.stringify(a.globs) !== JSON.stringify(b.globs);
  }

  private isMCPServerDifferent(a: MCPServerConfig, b: MCPServerConfig): boolean {
    return a.command !== b.command ||
           JSON.stringify(a.args) !== JSON.stringify(b.args) ||
           JSON.stringify(a.env) !== JSON.stringify(b.env);
  }

  private mergeRules(a: RuleConfig, b: RuleConfig): RuleConfig {
    return {
      ...a,
      // 使用较新的内容
      content: b.content.length > a.content.length ? b.content : a.content,
      // 合并 globs
      globs: [...new Set([...(a.globs ?? []), ...(b.globs ?? [])])],
      // 保留更多信息的字段
      name: b.name || a.name,
      description: b.description || a.description,
    };
  }

  private mergeMCPServers(a: MCPServerConfig, b: MCPServerConfig): MCPServerConfig {
    return {
      ...a,
      ...b,
      // 合并环境变量
      env: { ...a.env, ...b.env },
      // 合并参数
      args: [...(a.args ?? []), ...(b.args ?? [])],
    };
  }

  private mergeSettings(
    a?: UnifiedConfig['settings'],
    b?: UnifiedConfig['settings']
  ): UnifiedConfig['settings'] | undefined {
    if (!a) return b;
    if (!b) return a;

    return {
      model: { ...a.model, ...b.model },
      permissions: {
        allow: [...(a.permissions?.allow ?? []), ...(b.permissions?.allow ?? [])],
        deny: [...(a.permissions?.deny ?? []), ...(b.permissions?.deny ?? [])],
      },
      behavior: { ...a.behavior, ...b.behavior },
      toolSpecific: { ...a.toolSpecific, ...b.toolSpecific },
    };
  }
}

// 导出工厂函数
export function createConflictResolver(
  strategy: ConflictStrategy = 'merge',
  customResolver?: (conflict: Conflict) => ConflictResolution
): ConflictResolver {
  return new ConflictResolver(strategy, customResolver);
}
