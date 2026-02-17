/**
 * Tests for Importer
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Importer, type ImportResult, type ImportError } from '../../converter/Importer';
import type { UnifiedConfig, ToolId, ParseResult } from '../../core/types';
import { adapterRegistry } from '../../adapters/registry';

// Mock the adapter registry
vi.mock('../../adapters/registry', () => ({
  adapterRegistry: {
    get: vi.fn(),
    detectForProject: vi.fn(),
  },
}));

describe('Importer', () => {
  let importer: Importer;
  const mockProjectRoot = '/test/project';

  beforeEach(() => {
    importer = new Importer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('import()', () => {
    it('should return error when no config found and no source tool specified', async () => {
      vi.mocked(adapterRegistry.detectForProject).mockResolvedValue([]);

      const result = await importer.import(mockProjectRoot);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].code).toBe('NO_CONFIG_FOUND');
    });

    it('should return error when unknown tool specified', async () => {
      vi.mocked(adapterRegistry.get).mockReturnValue(undefined);

      const result = await importer.import(mockProjectRoot, { sourceTool: 'unknown' as ToolId });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].code).toBe('UNKNOWN_TOOL');
    });

    it('should import configuration from detected tool', async () => {
      const mockConfig: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-1', content: 'Test rule' }],
      };

      const mockAdapter = createMockAdapter('cursor', mockConfig);
      vi.mocked(adapterRegistry.detectForProject).mockResolvedValue([mockAdapter]);

      const result = await importer.import(mockProjectRoot);

      expect(result.success).toBe(true);
      expect(result.config).toEqual(mockConfig);
      expect(result.metadata?.sourceTools).toContain('cursor');
    });

    it('should import from specific tool when sourceTool specified', async () => {
      const mockConfig: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-1', content: 'Test rule' }],
      };

      const mockAdapter = createMockAdapter('claude-code', mockConfig);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await importer.import(mockProjectRoot, { sourceTool: 'claude-code' as ToolId });

      expect(result.success).toBe(true);
      expect(result.config).toEqual(mockConfig);
      expect(adapterRegistry.get).toHaveBeenCalledWith('claude-code');
    });

    it('should merge configurations when mergeMultiple is true', async () => {
      const config1: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-1', content: 'Rule 1' }],
      };
      const config2: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-2', content: 'Rule 2' }],
      };

      const mockAdapter1 = createMockAdapter('cursor', config1);
      const mockAdapter2 = createMockAdapter('claude-code', config2);
      vi.mocked(adapterRegistry.detectForProject).mockResolvedValue([mockAdapter1, mockAdapter2]);

      const result = await importer.import(mockProjectRoot, { mergeMultiple: true });

      expect(result.success).toBe(true);
      expect(result.config?.rules).toHaveLength(2);
      expect(result.config?.rules?.map(r => r.id)).toContain('rule-1');
      expect(result.config?.rules?.map(r => r.id)).toContain('rule-2');
    });

    it('should use first config when mergeMultiple is false', async () => {
      const config1: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-1', content: 'Rule 1' }],
      };
      const config2: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-2', content: 'Rule 2' }],
      };

      const mockAdapter1 = createMockAdapter('cursor', config1);
      const mockAdapter2 = createMockAdapter('claude-code', config2);
      vi.mocked(adapterRegistry.detectForProject).mockResolvedValue([mockAdapter1, mockAdapter2]);

      const result = await importer.import(mockProjectRoot, { mergeMultiple: false });

      expect(result.success).toBe(true);
      expect(result.config?.rules).toHaveLength(1);
      expect(result.config?.rules?.[0].id).toBe('rule-1');
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.code === 'MULTIPLE_CONFIGS')).toBe(true);
    });

    it('should collect parse errors', async () => {
      const mockAdapter = createMockAdapterWithErrors('cursor', [
        { code: 'PARSE_ERROR', message: 'Failed to parse', recoverable: true },
      ]);
      vi.mocked(adapterRegistry.detectForProject).mockResolvedValue([mockAdapter]);

      const result = await importer.import(mockProjectRoot);

      expect(result.errors).toBeDefined();
      expect(result.errors?.some(e => e.code === 'PARSE_ERROR')).toBe(true);
    });

    it('should collect parse warnings', async () => {
      const mockAdapter = createMockAdapterWithWarnings('cursor', [
        { code: 'PARTIAL_PARSE', message: 'Some fields ignored' },
      ]);
      vi.mocked(adapterRegistry.detectForProject).mockResolvedValue([mockAdapter]);

      const result = await importer.import(mockProjectRoot);

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.code === 'PARTIAL_PARSE')).toBe(true);
    });

    it('should include metadata with source files', async () => {
      const mockConfig: UnifiedConfig = {
        version: '1.0',
        rules: [],
      };

      const mockAdapter = createMockAdapterWithFiles('cursor', mockConfig, [
        { path: '.cursorrules', absolutePath: '/test/.cursorrules', exists: true },
      ]);
      vi.mocked(adapterRegistry.detectForProject).mockResolvedValue([mockAdapter]);

      const result = await importer.import(mockProjectRoot);

      expect(result.metadata?.sourceFiles).toContain('.cursorrules');
    });

    it('should include import time in metadata', async () => {
      const mockConfig: UnifiedConfig = { version: '1.0', rules: [] };
      const mockAdapter = createMockAdapter('cursor', mockConfig);
      vi.mocked(adapterRegistry.detectForProject).mockResolvedValue([mockAdapter]);

      const result = await importer.import(mockProjectRoot);

      expect(result.metadata?.importTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.metadata?.importTime).toBe('number');
    });
  });

  describe('importFrom()', () => {
    it('should import from specific tool', async () => {
      const mockConfig: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-1', content: 'Test' }],
      };

      const mockAdapter = createMockAdapter('claude-code', mockConfig);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await importer.importFrom(mockProjectRoot, 'claude-code' as ToolId);

      expect(result.success).toBe(true);
      expect(result.config).toEqual(mockConfig);
    });

    it('should pass options to import', async () => {
      const mockConfig: UnifiedConfig = {
        version: '1.0',
        rules: [],
      };

      const mockAdapter = createMockAdapter('claude-code', mockConfig);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await importer.importFrom(mockProjectRoot, 'claude-code' as ToolId, {
        strict: true,
      });

      expect(result.success).toBe(true);
      expect(mockAdapter.parse).toHaveBeenCalledWith(mockProjectRoot, { strict: true, sourceTool: 'claude-code' });
    });
  });

  describe('mergeConfigs()', () => {
    it('should merge rules with deduplication', async () => {
      const configs: UnifiedConfig[] = [
        { version: '1.0', rules: [{ id: 'rule-1', content: 'Rule 1' }] },
        { version: '1.0', rules: [{ id: 'rule-1', content: 'Duplicate' }, { id: 'rule-2', content: 'Rule 2' }] },
      ];

      // Access private method through any
      const merged = (importer as any).mergeConfigs(configs);

      expect(merged.rules).toHaveLength(2);
      expect(merged.rules.map((r: RuleConfig) => r.id)).toContain('rule-1');
      expect(merged.rules.map((r: RuleConfig) => r.id)).toContain('rule-2');
    });

    it('should merge MCP servers with deduplication', async () => {
      const configs: UnifiedConfig[] = [
        {
          version: '1.0',
          rules: [],
          mcp: { servers: [{ name: 'server1', command: 'cmd1' }] },
        },
        {
          version: '1.0',
          rules: [],
          mcp: { servers: [{ name: 'server1', command: 'duplicate' }, { name: 'server2', command: 'cmd2' }] },
        },
      ];

      const merged = (importer as any).mergeConfigs(configs);

      expect(merged.mcp.servers).toHaveLength(2);
      expect(merged.mcp.servers.map((s: MCPServerConfig) => s.name)).toContain('server1');
      expect(merged.mcp.servers.map((s: MCPServerConfig) => s.name)).toContain('server2');
    });

    it('should merge settings', async () => {
      const configs: UnifiedConfig[] = [
        {
          version: '1.0',
          rules: [],
          settings: {
            model: { default: 'gpt-4' },
            permissions: { allow: ['read'] },
          },
        },
        {
          version: '1.0',
          rules: [],
          settings: {
            model: { default: 'claude-3' },
            permissions: { allow: ['write'] },
          },
        },
      ];

      const merged = (importer as any).mergeConfigs(configs);

      expect(merged.settings.model.default).toBe('claude-3'); // Last wins
      expect(merged.settings.permissions.allow).toContain('read');
      expect(merged.settings.permissions.allow).toContain('write');
    });

    it('should merge commands', async () => {
      const configs: UnifiedConfig[] = [
        {
          version: '1.0',
          rules: [],
          commands: [{ id: 'cmd1', name: 'Command 1', template: 't1' }],
        },
        {
          version: '1.0',
          rules: [],
          commands: [{ id: 'cmd2', name: 'Command 2', template: 't2' }],
        },
      ];

      const merged = (importer as any).mergeConfigs(configs);

      expect(merged.commands).toHaveLength(2);
    });

    it('should merge prompts', async () => {
      const configs: UnifiedConfig[] = [
        {
          version: '1.0',
          rules: [],
          prompts: [{ id: 'p1', name: 'Prompt 1', template: 't1' }],
        },
        {
          version: '1.0',
          rules: [],
          prompts: [{ id: 'p2', name: 'Prompt 2', template: 't2' }],
        },
      ];

      const merged = (importer as any).mergeConfigs(configs);

      expect(merged.prompts).toHaveLength(2);
    });

    it('should merge context files with deduplication', async () => {
      const configs: UnifiedConfig[] = [
        { version: '1.0', rules: [], contextFiles: ['file1.md', 'file2.md'] },
        { version: '1.0', rules: [], contextFiles: ['file2.md', 'file3.md'] },
      ];

      const merged = (importer as any).mergeConfigs(configs);

      expect(merged.contextFiles).toHaveLength(3);
      expect(merged.contextFiles).toContain('file1.md');
      expect(merged.contextFiles).toContain('file2.md');
      expect(merged.contextFiles).toContain('file3.md');
    });

    it('should merge environment variables', async () => {
      const configs: UnifiedConfig[] = [
        { version: '1.0', rules: [], envVars: { KEY1: 'value1', KEY2: 'old' } },
        { version: '1.0', rules: [], envVars: { KEY2: 'new', KEY3: 'value3' } },
      ];

      const merged = (importer as any).mergeConfigs(configs);

      expect(merged.envVars.KEY1).toBe('value1');
      expect(merged.envVars.KEY2).toBe('new'); // Last wins
      expect(merged.envVars.KEY3).toBe('value3');
    });

    it('should merge ignore patterns with deduplication', async () => {
      const configs: UnifiedConfig[] = [
        { version: '1.0', rules: [], ignorePatterns: ['node_modules', 'dist'] },
        { version: '1.0', rules: [], ignorePatterns: ['dist', 'build'] },
      ];

      const merged = (importer as any).mergeConfigs(configs);

      expect(merged.ignorePatterns).toHaveLength(3);
    });
  });

  describe('mergeSettings()', () => {
    it('should return overlay if base is undefined', async () => {
      const overlay = { model: { default: 'gpt-4' } };
      const result = (importer as any).mergeSettings(undefined, overlay);
      expect(result).toEqual(overlay);
    });

    it('should return base if overlay is undefined', async () => {
      const base = { model: { default: 'gpt-4' } };
      const result = (importer as any).mergeSettings(base, undefined);
      expect(result).toEqual(base);
    });

    it('should merge model settings', async () => {
      const base = { model: { default: 'gpt-4', available: ['gpt-4'] } };
      const overlay = { model: { default: 'claude-3', available: ['claude-3'] } };

      const result = (importer as any).mergeSettings(base, overlay);

      expect(result.model.default).toBe('claude-3');
      expect(result.model.available).toContain('gpt-4');
      expect(result.model.available).toContain('claude-3');
    });

    it('should merge permissions', async () => {
      const base = { permissions: { allow: ['read'], deny: ['delete'] } };
      const overlay = { permissions: { allow: ['write'], deny: ['drop'] } };

      const result = (importer as any).mergeSettings(base, overlay);

      expect(result.permissions.allow).toContain('read');
      expect(result.permissions.allow).toContain('write');
      expect(result.permissions.deny).toContain('delete');
      expect(result.permissions.deny).toContain('drop');
    });

    it('should merge behavior settings', async () => {
      const base = { behavior: { autoSave: true, verbose: false } };
      const overlay = { behavior: { autoSave: false, timeout: 30 } };

      const result = (importer as any).mergeSettings(base, overlay);

      expect(result.behavior.autoSave).toBe(false);
      expect(result.behavior.verbose).toBe(false);
      expect(result.behavior.timeout).toBe(30);
    });

    it('should merge tool-specific settings (shallow merge)', async () => {
      const base = { toolSpecific: { cursor: { feature1: true } } };
      const overlay = { toolSpecific: { windsurf: { feature1: true } } };

      const result = (importer as any).mergeSettings(base, overlay);

      // toolSpecific is shallow merged, so cursor is replaced by overlay (which doesn't have it)
      expect(result.toolSpecific.windsurf.feature1).toBe(true);
    });
  });
});

// Helper functions to create mock adapters
function createMockAdapter(toolId: string, config: UnifiedConfig) {
  return {
    toolMeta: { id: toolId, name: toolId },
    parse: vi.fn().mockResolvedValue({
      success: true,
      data: config,
      metadata: { sourceFiles: [], parseTime: 0 },
    }),
  };
}

function createMockAdapterWithErrors(toolId: string, errors: Array<{ code: string; message: string; recoverable: boolean }>) {
  return {
    toolMeta: { id: toolId, name: toolId },
    parse: vi.fn().mockResolvedValue({
      success: false,
      errors,
      metadata: { sourceFiles: [], parseTime: 0 },
    }),
  };
}

function createMockAdapterWithWarnings(toolId: string, warnings: Array<{ code: string; message: string }>) {
  return {
    toolMeta: { id: toolId, name: toolId },
    parse: vi.fn().mockResolvedValue({
      success: true,
      data: { version: '1.0', rules: [] },
      warnings,
      metadata: { sourceFiles: [], parseTime: 0 },
    }),
  };
}

function createMockAdapterWithFiles(toolId: string, config: UnifiedConfig, files: Array<{ path: string; absolutePath: string; exists: boolean }>) {
  return {
    toolMeta: { id: toolId, name: toolId },
    parse: vi.fn().mockResolvedValue({
      success: true,
      data: config,
      metadata: { sourceFiles: files, parseTime: 0 },
    }),
  };
}

// Need to import these for helper types
import type { RuleConfig, MCPServerConfig as MCPServerConfigType } from '../../core/types';
