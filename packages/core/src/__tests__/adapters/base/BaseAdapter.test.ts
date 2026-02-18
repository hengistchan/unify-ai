/**
 * BaseAdapter Unit Tests
 * Tests the abstract base adapter class methods
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAdapter } from '../../../adapters/base/BaseAdapter';
import type {
  UnifiedConfig,
  ParseResult,
  GenerateResult,
  ConvertOptions,
  FilePattern,
  ToolMeta,
  CapabilityDeclaration,
  ConfigCapability,
  CapabilityLevel,
} from '../../../core/types';
import { ConfigCapability as CC, CapabilityLevel as CL, AdapterStatus } from '../../../core/types';

/**
 * Concrete test adapter implementation
 */
class TestAdapter extends BaseAdapter {
  readonly toolMeta: ToolMeta = {
    id: 'test-tool' as ConfigCapability,
    name: 'Test Tool',
    description: 'A test adapter for unit testing',
    website: 'https://test.example.com',
  };

  readonly version = '1.0.0-test';

  private capabilities: CapabilityDeclaration[];
  private filePatterns: FilePattern[];

  constructor(capabilities?: CapabilityDeclaration[], filePatterns?: FilePattern[]) {
    super();
    this.capabilities = capabilities ?? [
      { capability: CC.RULES, level: CL.FULL },
      { capability: CC.MCP_SERVERS, level: CL.PARTIAL, notes: 'Partial support' },
      { capability: CC.SETTINGS, level: CL.NONE },
    ];
    this.filePatterns = filePatterns ?? [
      { pattern: '*.md', type: 'optional', capability: CC.RULES },
    ];
  }

  getCapabilities(): CapabilityDeclaration[] {
    return this.capabilities;
  }

  getFilePatterns(): FilePattern[] {
    return this.filePatterns;
  }

  async parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult> {
    return this.createSuccessResult({
      version: '1.0',
      sourceTool: 'test-tool' as unknown as undefined,
      rules: [],
    });
  }

  async generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult> {
    return {
      success: true,
      files: [],
    };
  }

  // Expose protected methods for testing
  testHasCapability(capability: ConfigCapability): boolean {
    return this.hasCapability(capability);
  }

  testGetCapabilityLevel(capability: ConfigCapability): CapabilityLevel | undefined {
    return this.getCapabilityLevel(capability);
  }

  testMergeResults(...results: ParseResult[]): ParseResult {
    return this.mergeResults(...results);
  }

  testDeepMerge<T extends Record<string, unknown>>(target: T, source: T): T {
    return this.deepMerge(target, source);
  }

  testCreateSuccessResult(data: UnifiedConfig, metadata?: ParseResult['metadata']): ParseResult {
    return this.createSuccessResult(data, metadata);
  }

  testCreateErrorResult(
    errors: ParseResult['errors'],
    warnings?: ParseResult['warnings']
  ): ParseResult {
    return this.createErrorResult(errors as any, warnings as any);
  }
}

describe('BaseAdapter', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  describe('hasCapability()', () => {
    it('should return true for fully supported capabilities', () => {
      expect(adapter.testHasCapability(CC.RULES)).toBe(true);
    });

    it('should return true for partially supported capabilities', () => {
      expect(adapter.testHasCapability(CC.MCP_SERVERS)).toBe(true);
    });

    it('should return false for unsupported capabilities (level: none)', () => {
      expect(adapter.testHasCapability(CC.SETTINGS)).toBe(false);
    });

    it('should return false for capabilities not in declaration list', () => {
      expect(adapter.testHasCapability(CC.COMMANDS)).toBe(false);
    });

    it('should work with empty capabilities list', () => {
      const emptyAdapter = new TestAdapter([]);
      expect(emptyAdapter.testHasCapability(CC.RULES)).toBe(false);
    });
  });

  describe('getCapabilityLevel()', () => {
    it('should return full for fully supported capabilities', () => {
      expect(adapter.testGetCapabilityLevel(CC.RULES)).toBe(CL.FULL);
    });

    it('should return partial for partially supported capabilities', () => {
      expect(adapter.testGetCapabilityLevel(CC.MCP_SERVERS)).toBe(CL.PARTIAL);
    });

    it('should return none for unsupported capabilities', () => {
      expect(adapter.testGetCapabilityLevel(CC.SETTINGS)).toBe(CL.NONE);
    });

    it('should return undefined for capabilities not in list', () => {
      expect(adapter.testGetCapabilityLevel(CC.COMMANDS)).toBeUndefined();
    });
  });

  describe('mergeResults()', () => {
    it('should merge multiple successful results', () => {
      const result1: ParseResult = {
        success: true,
        data: {
          version: '1.0',
          rules: [{ id: 'rule1', content: 'content1' }],
        },
        metadata: {
          sourceFiles: [{ path: 'file1.md', absolutePath: '/path/file1.md', exists: true }],
          parseTime: 100,
        },
      };

      const result2: ParseResult = {
        success: true,
        data: {
          version: '1.0',
          rules: [{ id: 'rule2', content: 'content2' }],
        },
        metadata: {
          sourceFiles: [{ path: 'file2.md', absolutePath: '/path/file2.md', exists: true }],
          parseTime: 200,
        },
      };

      const merged = adapter.testMergeResults(result1, result2);

      expect(merged.success).toBe(true);
      expect(merged.data?.rules).toHaveLength(2);
      expect(merged.metadata?.sourceFiles).toHaveLength(2);
    });

    it('should return failure when all results have no data', () => {
      const result1: ParseResult = {
        success: false,
        errors: [{ code: 'ERR1', message: 'Error 1', recoverable: false }],
        metadata: { sourceFiles: [], parseTime: 100 },
      };

      const result2: ParseResult = {
        success: false,
        errors: [{ code: 'ERR2', message: 'Error 2', recoverable: false }],
        metadata: { sourceFiles: [], parseTime: 200 },
      };

      const merged = adapter.testMergeResults(result1, result2);

      expect(merged.success).toBe(false);
      expect(merged.data).toBeUndefined();
      expect(merged.errors).toHaveLength(2);
    });

    it('should collect all errors and warnings', () => {
      const result1: ParseResult = {
        success: true,
        data: { version: '1.0', rules: [] },
        errors: [{ code: 'ERR1', message: 'Error 1', recoverable: true }],
        warnings: [{ code: 'WARN1', message: 'Warning 1' }],
        metadata: { sourceFiles: [], parseTime: 100 },
      };

      const result2: ParseResult = {
        success: true,
        data: { version: '1.0', rules: [] },
        errors: [{ code: 'ERR2', message: 'Error 2', recoverable: true }],
        warnings: [{ code: 'WARN2', message: 'Warning 2' }],
        metadata: { sourceFiles: [], parseTime: 200 },
      };

      const merged = adapter.testMergeResults(result1, result2);

      expect(merged.errors).toHaveLength(2);
      expect(merged.warnings).toHaveLength(2);
    });

    it('should handle empty results array', () => {
      const merged = adapter.testMergeResults();

      expect(merged.success).toBe(false);
      expect(merged.data).toBeUndefined();
    });

    it('should be successful with recoverable errors', () => {
      const result: ParseResult = {
        success: true,
        data: { version: '1.0', rules: [] },
        errors: [{ code: 'ERR1', message: 'Recoverable', recoverable: true }],
        metadata: { sourceFiles: [], parseTime: 100 },
      };

      const merged = adapter.testMergeResults(result);

      expect(merged.success).toBe(true);
      expect(merged.data).toBeDefined();
    });
  });

  describe('deepMerge()', () => {
    it('should merge flat objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };

      const result = adapter.testDeepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should recursively merge nested objects', () => {
      const target = {
        level1: {
          level2a: 'old',
          level2b: 'keep',
        },
      };
      const source = {
        level1: {
          level2a: 'new',
          level2c: 'added',
        },
      };

      const result = adapter.testDeepMerge(target, source);

      expect(result).toEqual({
        level1: {
          level2a: 'new',
          level2b: 'keep',
          level2c: 'added',
        },
      });
    });

    it('should concatenate arrays', () => {
      const target = { items: [1, 2, 3] };
      const source = { items: [4, 5, 6] };

      const result = adapter.testDeepMerge(target, source);

      expect(result.items).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should overwrite primitives from source', () => {
      const target = { value: 'old', count: 10 };
      const source = { value: 'new', count: 20 };

      const result = adapter.testDeepMerge(target, source);

      expect(result.value).toBe('new');
      expect(result.count).toBe(20);
    });

    it('should handle null values', () => {
      const target = { a: 'keep', b: null };
      const source = { b: 'overwrite', c: null };

      const result = adapter.testDeepMerge(target, source);

      expect(result.a).toBe('keep');
      expect(result.b).toBe('overwrite');
      expect(result.c).toBeNull();
    });

    it('should not modify original objects', () => {
      const target = { nested: { value: 'original' } };
      const source = { nested: { value: 'new' } };

      adapter.testDeepMerge(target, source);

      expect(target.nested.value).toBe('original');
    });

    it('should handle undefined source values', () => {
      const target = { a: 1, b: 2 };
      const source = { b: undefined, c: 3 };

      const result = adapter.testDeepMerge(target, source);

      // undefined values should not override existing values
      expect(result.b).toBe(2);
      expect(result.c).toBe(3);
    });
  });

  describe('getInfo()', () => {
    it('should return complete adapter info', () => {
      const info = adapter.getInfo();

      expect(info.tool.id).toBe('test-tool');
      expect(info.tool.name).toBe('Test Tool');
      expect(info.version).toBe('1.0.0-test');
      expect(info.status).toBe(AdapterStatus.READY);
      expect(info.capabilities).toHaveLength(3);
      expect(info.filePatterns).toHaveLength(1);
    });
  });

  describe('validate()', () => {
    it('should validate a valid configuration', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule1', content: 'content' }],
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error on missing version', async () => {
      const config = {
        rules: [],
      } as UnifiedConfig;

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'version')).toBe(true);
    });

    it('should error on rule missing id', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [{ content: 'content' } as any],
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'rules[0].id')).toBe(true);
    });

    it('should warn on rule missing content', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule1' } as any],
      };

      const result = await adapter.validate(config);

      // Empty content is now a warning, not an error
      expect(result.valid).toBe(true);
      expect(result.warnings.some(e => e.path === 'rules[0].content')).toBe(true);
    });

    it('should validate MCP server configuration', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [],
        mcp: {
          servers: [{ name: 'server1' } as any],
        },
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.path === 'mcp.servers[0].command')).toBe(true);
    });

    it('should validate complete MCP configuration', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [],
        mcp: {
          servers: [{ name: 'server1', command: 'node' }],
        },
      };

      const result = await adapter.validate(config);

      expect(result.valid).toBe(true);
    });
  });
});
