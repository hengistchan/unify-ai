/**
 * Tests for ConflictResolver
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConflictResolver,
  ConflictType,
  type Conflict,
  type ConflictStrategy,
  type ConflictResolution,
  createConflictResolver,
} from '../../converter/ConflictResolver';
import type { RuleConfig, MCPServerConfig, UnifiedConfig, ToolId } from '../../core/types';

describe('ConflictResolver', () => {
  describe('constructor', () => {
    it('should create resolver with default merge strategy', () => {
      const resolver = new ConflictResolver();
      expect(resolver).toBeInstanceOf(ConflictResolver);
    });

    it('should accept custom strategy', () => {
      const resolver = new ConflictResolver('overwrite');
      expect(resolver).toBeInstanceOf(ConflictResolver);
    });

    it('should accept custom resolver function', () => {
      const customResolver = (conflict: Conflict) => ({ action: 'skip' as const });
      const resolver = new ConflictResolver('merge', customResolver);
      expect(resolver).toBeInstanceOf(ConflictResolver);
    });
  });

  describe('createConflictResolver() factory', () => {
    it('should create resolver with default strategy', () => {
      const resolver = createConflictResolver();
      expect(resolver).toBeInstanceOf(ConflictResolver);
    });

    it('should create resolver with custom strategy', () => {
      const resolver = createConflictResolver('skip');
      expect(resolver).toBeInstanceOf(ConflictResolver);
    });
  });

  describe('resolveRuleConflicts()', () => {
    it('should return all rules when no conflicts', () => {
      const resolver = new ConflictResolver('merge');
      const existing: RuleConfig[] = [{ id: 'rule-1', content: 'content 1' }];
      const incoming: RuleConfig[] = [{ id: 'rule-2', content: 'content 2' }];

      const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.rules).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect rule content conflict', () => {
      const resolver = new ConflictResolver('merge');
      const existing: RuleConfig[] = [{ id: 'rule-1', name: 'Rule 1', content: 'old content' }];
      const incoming: RuleConfig[] = [{ id: 'rule-1', name: 'Rule 1', content: 'new content' }];

      const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe(ConflictType.RULE_CONTENT_DIFF);
      expect(result.conflicts[0].description).toContain('Rule 1');
    });

    it('should detect rule name conflict', () => {
      const resolver = new ConflictResolver('merge');
      const existing: RuleConfig[] = [{ id: 'rule-1', name: 'Old Name', content: 'same content' }];
      const incoming: RuleConfig[] = [{ id: 'rule-1', name: 'New Name', content: 'same content' }];

      const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.conflicts).toHaveLength(1);
    });

    it('should detect rule globs conflict', () => {
      const resolver = new ConflictResolver('merge');
      const existing: RuleConfig[] = [{ id: 'rule-1', content: 'content', globs: ['*.ts'] }];
      const incoming: RuleConfig[] = [{ id: 'rule-1', content: 'content', globs: ['*.tsx'] }];

      const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.conflicts).toHaveLength(1);
    });

    it('should not detect conflict for identical rules', () => {
      const resolver = new ConflictResolver('merge');
      const rule: RuleConfig = { id: 'rule-1', name: 'Rule', content: 'content' };
      const existing = [rule];
      const incoming = [{ ...rule }];

      const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.conflicts).toHaveLength(0);
    });

    describe('skip strategy', () => {
      it('should skip conflicting rules', () => {
        const resolver = new ConflictResolver('skip');
        const existing: RuleConfig[] = [{ id: 'rule-1', content: 'old content' }];
        const incoming: RuleConfig[] = [{ id: 'rule-1', content: 'new content' }];

        const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].resolution?.action).toBe('skip');
        // Existing rule should remain unchanged
        expect(result.rules.find(r => r.id === 'rule-1')?.content).toBe('old content');
      });
    });

    describe('overwrite strategy', () => {
      it('should overwrite existing rule with incoming', () => {
        const resolver = new ConflictResolver('overwrite');
        const existing: RuleConfig[] = [{ id: 'rule-1', content: 'old content' }];
        const incoming: RuleConfig[] = [{ id: 'rule-1', content: 'new content' }];

        const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0].resolution?.action).toBe('use_incoming');
        expect(result.rules.find(r => r.id === 'rule-1')?.content).toBe('new content');
      });
    });

    describe('merge strategy', () => {
      it('should merge rules', () => {
        const resolver = new ConflictResolver('merge');
        const existing: RuleConfig[] = [{ id: 'rule-1', content: 'short', globs: ['*.ts'] }];
        const incoming: RuleConfig[] = [
          { id: 'rule-1', content: 'longer content here', globs: ['*.tsx'] },
        ];

        const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

        expect(result.conflicts[0].resolution?.action).toBe('merge');
        const merged = result.rules.find(r => r.id === 'rule-1');
        // Merged rule should have merged globs and longer content
        expect(merged?.globs).toContain('*.ts');
        expect(merged?.globs).toContain('*.tsx');
      });

      it('should prefer longer content when merging', () => {
        const resolver = new ConflictResolver('merge');
        const existing: RuleConfig[] = [{ id: 'rule-1', content: 'short' }];
        const incoming: RuleConfig[] = [{ id: 'rule-1', content: 'this is much longer content' }];

        const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

        const merged = result.rules.find(r => r.id === 'rule-1');
        expect(merged?.content).toBe('this is much longer content');
      });

      it('should prefer non-empty name when merging', () => {
        const resolver = new ConflictResolver('merge');
        const existing: RuleConfig[] = [{ id: 'rule-1', content: 'content', name: '' }];
        const incoming: RuleConfig[] = [{ id: 'rule-1', content: 'content', name: 'Rule Name' }];

        const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

        const merged = result.rules.find(r => r.id === 'rule-1');
        expect(merged?.name).toBe('Rule Name');
      });
    });

    describe('custom resolver', () => {
      it('should use custom resolver when provided', () => {
        const customResolver = (conflict: Conflict): ConflictResolution => ({
          action: 'keep_existing',
        });
        const resolver = new ConflictResolver('overwrite', customResolver);
        const existing: RuleConfig[] = [{ id: 'rule-1', content: 'old content' }];
        const incoming: RuleConfig[] = [{ id: 'rule-1', content: 'new content' }];

        const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

        expect(result.conflicts[0].resolution?.action).toBe('keep_existing');
      });
    });
  });

  describe('resolveMCPConflicts()', () => {
    it('should return all servers when no conflicts', () => {
      const resolver = new ConflictResolver('merge');
      const existing: MCPServerConfig[] = [{ name: 'server1', command: 'cmd1' }];
      const incoming: MCPServerConfig[] = [{ name: 'server2', command: 'cmd2' }];

      const result = resolver.resolveMCPConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.servers).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect MCP command conflict', () => {
      const resolver = new ConflictResolver('merge');
      const existing: MCPServerConfig[] = [{ name: 'server1', command: 'old-cmd' }];
      const incoming: MCPServerConfig[] = [{ name: 'server1', command: 'new-cmd' }];

      const result = resolver.resolveMCPConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe(ConflictType.MCP_CONFIG_DIFF);
      expect(result.conflicts[0].description).toContain('server1');
    });

    it('should detect MCP args conflict', () => {
      const resolver = new ConflictResolver('merge');
      const existing: MCPServerConfig[] = [{ name: 'server1', command: 'cmd', args: ['--old'] }];
      const incoming: MCPServerConfig[] = [{ name: 'server1', command: 'cmd', args: ['--new'] }];

      const result = resolver.resolveMCPConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.conflicts).toHaveLength(1);
    });

    it('should detect MCP env conflict', () => {
      const resolver = new ConflictResolver('merge');
      const existing: MCPServerConfig[] = [
        { name: 'server1', command: 'cmd', env: { KEY: 'old' } },
      ];
      const incoming: MCPServerConfig[] = [
        { name: 'server1', command: 'cmd', env: { KEY: 'new' } },
      ];

      const result = resolver.resolveMCPConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.conflicts).toHaveLength(1);
    });

    it('should not detect conflict for identical servers', () => {
      const resolver = new ConflictResolver('merge');
      const server: MCPServerConfig = { name: 'server1', command: 'cmd' };
      const existing = [server];
      const incoming = [{ ...server }];

      const result = resolver.resolveMCPConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.conflicts).toHaveLength(0);
    });

    describe('skip strategy', () => {
      it('should skip conflicting servers', () => {
        const resolver = new ConflictResolver('skip');
        const existing: MCPServerConfig[] = [{ name: 'server1', command: 'old-cmd' }];
        const incoming: MCPServerConfig[] = [{ name: 'server1', command: 'new-cmd' }];

        const result = resolver.resolveMCPConflicts(existing, incoming, 'cursor' as ToolId);

        expect(result.conflicts[0].resolution?.action).toBe('skip');
        expect(result.servers.find(s => s.name === 'server1')?.command).toBe('old-cmd');
      });
    });

    describe('overwrite strategy', () => {
      it('should overwrite existing server with incoming', () => {
        const resolver = new ConflictResolver('overwrite');
        const existing: MCPServerConfig[] = [{ name: 'server1', command: 'old-cmd' }];
        const incoming: MCPServerConfig[] = [{ name: 'server1', command: 'new-cmd' }];

        const result = resolver.resolveMCPConflicts(existing, incoming, 'cursor' as ToolId);

        expect(result.conflicts[0].resolution?.action).toBe('use_incoming');
        expect(result.servers.find(s => s.name === 'server1')?.command).toBe('new-cmd');
      });
    });

    describe('merge strategy', () => {
      it('should merge MCP servers', () => {
        const resolver = new ConflictResolver('merge');
        const existing: MCPServerConfig[] = [
          { name: 'server1', command: 'cmd', args: ['--a'], env: { A: '1' } },
        ];
        const incoming: MCPServerConfig[] = [
          { name: 'server1', command: 'new-cmd', args: ['--b'], env: { B: '2' } },
        ];

        const result = resolver.resolveMCPConflicts(existing, incoming, 'cursor' as ToolId);

        expect(result.conflicts[0].resolution?.action).toBe('merge');
        const merged = result.servers.find(s => s.name === 'server1');
        // Should have merged env vars
        expect(merged?.env).toEqual({ A: '1', B: '2' });
        // Should have merged args
        expect(merged?.args).toContain('--a');
        expect(merged?.args).toContain('--b');
      });
    });
  });

  describe('resolveConfigConflicts()', () => {
    it('should resolve full config conflicts', () => {
      const resolver = new ConflictResolver('merge');
      const existing: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-1', content: 'old' }],
        mcp: { servers: [{ name: 'server1', command: 'old-cmd' }] },
      };
      const incoming: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-1', content: 'new' }],
        mcp: { servers: [{ name: 'server1', command: 'new-cmd' }] },
      };

      const result = resolver.resolveConfigConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.config).toBeDefined();
    });

    it('should merge settings', () => {
      const resolver = new ConflictResolver('merge');
      const existing: UnifiedConfig = {
        version: '1.0',
        rules: [],
        settings: {
          model: { default: 'gpt-4' },
          permissions: { allow: ['read'] },
        },
      };
      const incoming: UnifiedConfig = {
        version: '1.0',
        rules: [],
        settings: {
          model: { default: 'claude-3' },
          permissions: { allow: ['write'] },
        },
      };

      const result = resolver.resolveConfigConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.config.settings?.permissions?.allow).toContain('read');
      expect(result.config.settings?.permissions?.allow).toContain('write');
    });

    it('should merge commands', () => {
      const resolver = new ConflictResolver('merge');
      const existing: UnifiedConfig = {
        version: '1.0',
        rules: [],
        commands: [{ id: 'cmd1', name: 'Command 1', template: 'template1' }],
      };
      const incoming: UnifiedConfig = {
        version: '1.0',
        rules: [],
        commands: [{ id: 'cmd2', name: 'Command 2', template: 'template2' }],
      };

      const result = resolver.resolveConfigConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.config.commands).toHaveLength(2);
    });

    it('should merge prompts', () => {
      const resolver = new ConflictResolver('merge');
      const existing: UnifiedConfig = {
        version: '1.0',
        rules: [],
        prompts: [{ id: 'prompt1', name: 'Prompt 1', template: 't1' }],
      };
      const incoming: UnifiedConfig = {
        version: '1.0',
        rules: [],
        prompts: [{ id: 'prompt2', name: 'Prompt 2', template: 't2' }],
      };

      const result = resolver.resolveConfigConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.config.prompts).toHaveLength(2);
    });

    it('should handle missing MCP in existing config', () => {
      const resolver = new ConflictResolver('merge');
      const existing: UnifiedConfig = {
        version: '1.0',
        rules: [],
      };
      const incoming: UnifiedConfig = {
        version: '1.0',
        rules: [],
        mcp: { servers: [{ name: 'server1', command: 'cmd' }] },
      };

      const result = resolver.resolveConfigConflicts(existing, incoming, 'cursor' as ToolId);

      expect(result.config.mcp?.servers).toHaveLength(1);
      expect(result.config.mcp?.servers[0].name).toBe('server1');
    });
  });

  describe('ask strategy', () => {
    it('should default to merge when ask strategy is used', () => {
      const resolver = new ConflictResolver('ask');
      const existing: RuleConfig[] = [{ id: 'rule-1', content: 'old' }];
      const incoming: RuleConfig[] = [{ id: 'rule-1', content: 'new' }];

      const result = resolver.resolveRuleConflicts(existing, incoming, 'cursor' as ToolId);

      // 'ask' strategy defaults to merge
      expect(result.conflicts[0].resolution?.action).toBe('merge');
    });
  });
});
