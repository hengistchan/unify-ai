/**
 * AdapterRegistry Unit Tests
 * Tests the adapter registry functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdapterRegistry } from '../../adapters/registry';
import type { IAdapter } from '../../adapters/base/IAdapter';
import type {
  UnifiedConfig,
  ParseResult,
  GenerateResult,
  ConvertOptions,
  ToolMeta,
  CapabilityDeclaration,
  FilePattern,
  ConfigCapability,
} from '../../core/types';
import { ConfigCapability as CC, CapabilityLevel as CL, ToolId } from '../../core/types';

/**
 * Create a mock adapter for testing
 */
function createMockAdapter(
  id: ToolId | string,
  capabilities: ConfigCapability[] = [CC.RULES],
  shouldDetect = true
): IAdapter {
  return {
    toolMeta: {
      id: id as ToolId,
      name: `Mock ${id}`,
      description: `Mock adapter for ${id}`,
    } as ToolMeta,
    version: '1.0.0',
    getInfo: () => ({
      tool: {
        id: id as ToolId,
        name: `Mock ${id}`,
        description: `Mock adapter for ${id}`,
      },
      version: '1.0.0',
      capabilities: capabilities.map(cap => ({
        capability: cap,
        level: CL.FULL,
      })),
      status: 'ready' as any,
      filePatterns: [],
    }),
    getCapabilities: () =>
      capabilities.map(cap => ({
        capability: cap,
        level: CL.FULL,
      })),
    hasCapability: (cap: ConfigCapability) => capabilities.includes(cap),
    getCapabilityLevel: (cap: ConfigCapability) =>
      capabilities.includes(cap) ? CL.FULL : undefined,
    getFilePatterns: () => [] as FilePattern[],
    discoverFiles: async () => [],
    detect: async () => shouldDetect,
    parse: async (): Promise<ParseResult> => ({
      success: true,
      data: { version: '1.0', rules: [] },
      metadata: { sourceFiles: [], parseTime: 0 },
    }),
    parseFile: async (): Promise<ParseResult> => ({
      success: true,
      data: { version: '1.0', rules: [] },
      metadata: { sourceFiles: [], parseTime: 0 },
    }),
    parseContent: async (): Promise<ParseResult> => ({
      success: true,
      data: { version: '1.0', rules: [] },
      metadata: { sourceFiles: [], parseTime: 0 },
    }),
    generate: async (): Promise<GenerateResult> => ({
      success: true,
      files: [],
    }),
    generateTo: async (): Promise<GenerateResult> => ({
      success: true,
      files: [],
    }),
    validate: async () => ({ valid: true, errors: [], warnings: [] }),
  };
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  afterEach(async () => {
    await registry.dispose();
  });

  describe('register()', () => {
    it('should register an adapter', () => {
      const adapter = createMockAdapter('test-tool');
      registry.register(adapter);

      expect(registry.has('test-tool' as ToolId)).toBe(true);
    });

    it('should overwrite adapter with same id', () => {
      const adapter1 = createMockAdapter('test-tool');
      const adapter2 = createMockAdapter('test-tool');

      registry.register(adapter1);
      registry.register(adapter2);

      expect(registry.getAll()).toHaveLength(1);
      expect(registry.get('test-tool' as ToolId)?.version).toBe('1.0.0');
    });

    it('should register multiple adapters with different ids', () => {
      const adapter1 = createMockAdapter('tool-1');
      const adapter2 = createMockAdapter('tool-2');
      const adapter3 = createMockAdapter('tool-3');

      registry.register(adapter1);
      registry.register(adapter2);
      registry.register(adapter3);

      expect(registry.getAll()).toHaveLength(3);
    });
  });

  describe('unregister()', () => {
    it('should unregister an existing adapter', () => {
      const adapter = createMockAdapter('test-tool');
      registry.register(adapter);

      const result = registry.unregister('test-tool' as ToolId);

      expect(result).toBe(true);
      expect(registry.has('test-tool' as ToolId)).toBe(false);
    });

    it('should return false for non-existent adapter', () => {
      const result = registry.unregister('non-existent' as ToolId);

      expect(result).toBe(false);
    });

    it('should not affect other adapters', () => {
      const adapter1 = createMockAdapter('tool-1');
      const adapter2 = createMockAdapter('tool-2');

      registry.register(adapter1);
      registry.register(adapter2);
      registry.unregister('tool-1' as ToolId);

      expect(registry.getAll()).toHaveLength(1);
      expect(registry.has('tool-2' as ToolId)).toBe(true);
    });
  });

  describe('get()', () => {
    it('should return registered adapter', () => {
      const adapter = createMockAdapter('test-tool');
      registry.register(adapter);

      const result = registry.get('test-tool' as ToolId);

      expect(result).toBeDefined();
      expect(result?.toolMeta.id).toBe('test-tool');
    });

    it('should return undefined for non-existent adapter', () => {
      const result = registry.get('non-existent' as ToolId);

      expect(result).toBeUndefined();
    });
  });

  describe('getAll()', () => {
    it('should return empty array when no adapters registered', () => {
      const result = registry.getAll();

      expect(result).toEqual([]);
    });

    it('should return all registered adapters', () => {
      const adapter1 = createMockAdapter('tool-1');
      const adapter2 = createMockAdapter('tool-2');

      registry.register(adapter1);
      registry.register(adapter2);

      const result = registry.getAll();

      expect(result).toHaveLength(2);
      expect(result.map(a => a.toolMeta.id)).toContain('tool-1');
      expect(result.map(a => a.toolMeta.id)).toContain('tool-2');
    });
  });

  describe('getAllInfo()', () => {
    it('should return adapter info for all adapters', () => {
      const adapter1 = createMockAdapter('tool-1', [CC.RULES, CC.MCP_SERVERS]);
      const adapter2 = createMockAdapter('tool-2', [CC.SETTINGS]);

      registry.register(adapter1);
      registry.register(adapter2);

      const infos = registry.getAllInfo();

      expect(infos).toHaveLength(2);
      expect(infos[0].tool.name).toBeDefined();
      expect(infos[0].capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('findByCapability()', () => {
    it('should find adapters with specified capability', () => {
      const adapter1 = createMockAdapter('tool-1', [CC.RULES, CC.MCP_SERVERS]);
      const adapter2 = createMockAdapter('tool-2', [CC.RULES, CC.SETTINGS]);
      const adapter3 = createMockAdapter('tool-3', [CC.SETTINGS]);

      registry.register(adapter1);
      registry.register(adapter2);
      registry.register(adapter3);

      const result = registry.findByCapability(CC.RULES);

      expect(result).toHaveLength(2);
      expect(result.map(a => a.toolMeta.id)).toContain('tool-1');
      expect(result.map(a => a.toolMeta.id)).toContain('tool-2');
    });

    it('should return empty array when no adapters have capability', () => {
      const adapter = createMockAdapter('tool-1', [CC.SETTINGS]);
      registry.register(adapter);

      const result = registry.findByCapability(CC.RULES);

      expect(result).toEqual([]);
    });

    it('should return empty array when registry is empty', () => {
      const result = registry.findByCapability(CC.RULES);

      expect(result).toEqual([]);
    });
  });

  describe('detectForProject()', () => {
    it('should return detected adapters', async () => {
      const adapter1 = createMockAdapter('tool-1', [CC.RULES], true);
      const adapter2 = createMockAdapter('tool-2', [CC.RULES], true);
      const adapter3 = createMockAdapter('tool-3', [CC.RULES], false);

      registry.register(adapter1);
      registry.register(adapter2);
      registry.register(adapter3);

      const result = await registry.detectForProject('/project/root');

      expect(result).toHaveLength(2);
      expect(result.map(a => a.toolMeta.id)).toContain('tool-1');
      expect(result.map(a => a.toolMeta.id)).toContain('tool-2');
      expect(result.map(a => a.toolMeta.id)).not.toContain('tool-3');
    });

    it('should return empty array when no adapters detect', async () => {
      const adapter = createMockAdapter('tool-1', [CC.RULES], false);
      registry.register(adapter);

      const result = await registry.detectForProject('/project/root');

      expect(result).toEqual([]);
    });
  });

  describe('has()', () => {
    it('should return true for registered adapter', () => {
      const adapter = createMockAdapter('test-tool');
      registry.register(adapter);

      expect(registry.has('test-tool' as ToolId)).toBe(true);
    });

    it('should return false for non-existent adapter', () => {
      expect(registry.has('non-existent' as ToolId)).toBe(false);
    });
  });

  describe('initialize()', () => {
    it('should register all built-in adapters', async () => {
      await registry.initialize();

      expect(registry.has(ToolId.CURSOR)).toBe(true);
      expect(registry.has(ToolId.CLAUDE_CODE)).toBe(true);
      expect(registry.has(ToolId.COPILOT)).toBe(true);
      expect(registry.has(ToolId.WINDSURF)).toBe(true);
      expect(registry.has(ToolId.CODEX)).toBe(true);
      expect(registry.has(ToolId.CLINE)).toBe(true);
      expect(registry.has(ToolId.AIDER)).toBe(true);
      expect(registry.has(ToolId.OPENCODE)).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await registry.initialize();
      const count = registry.getAll().length;

      await registry.initialize();

      expect(registry.getAll().length).toBe(count);
    });
  });

  describe('dispose()', () => {
    it('should clear all adapters', async () => {
      const adapter = createMockAdapter('test-tool');
      registry.register(adapter);

      await registry.dispose();

      expect(registry.getAll()).toHaveLength(0);
    });

    it('should allow re-initialization after dispose', async () => {
      await registry.initialize();
      await registry.dispose();

      expect(registry.getAll()).toHaveLength(0);

      await registry.initialize();

      expect(registry.getAll().length).toBeGreaterThan(0);
    });

    it('should call adapter dispose method if available', async () => {
      const disposeFn = vi.fn();
      const adapter = {
        ...createMockAdapter('test-tool'),
        dispose: disposeFn,
      };

      registry.register(adapter);
      await registry.dispose();

      expect(disposeFn).toHaveBeenCalledTimes(1);
    });
  });
});
