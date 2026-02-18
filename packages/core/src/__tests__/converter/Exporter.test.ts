/**
 * Tests for Exporter
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Exporter, type ExportResult, type ExportOptions } from '../../converter/Exporter';
import type { UnifiedConfig, ToolId, GenerateResult, ValidationResult } from '../../core/types';
import { adapterRegistry } from '../../adapters/registry';

// Mock the adapter registry
vi.mock('../../adapters/registry', () => ({
  adapterRegistry: {
    get: vi.fn(),
  },
}));

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 100 }),
    access: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Exporter', () => {
  let exporter: Exporter;
  const mockProjectRoot = '/test/project';
  const mockConfig: UnifiedConfig = {
    version: '1.0',
    rules: [{ id: 'rule-1', content: 'Test rule' }],
  };

  beforeEach(() => {
    exporter = new Exporter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('export()', () => {
    it('should return error when unknown tool specified', async () => {
      vi.mocked(adapterRegistry.get).mockReturnValue(undefined);

      const result = await exporter.export(mockConfig, mockProjectRoot, {
        targetTool: 'unknown' as ToolId,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].code).toBe('UNKNOWN_TOOL');
    });

    it('should export configuration to target tool', async () => {
      const mockAdapter = createMockAdapter('cursor', true);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.export(mockConfig, mockProjectRoot, {
        targetTool: 'cursor' as ToolId,
      });

      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
      expect(result.files?.length).toBeGreaterThan(0);
    });

    it('should return validation errors in strict mode', async () => {
      const mockAdapter = createMockAdapterWithValidation('cursor', {
        valid: false,
        errors: [{ path: 'rules[0]', message: 'Invalid rule' }],
      });
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.export(mockConfig, mockProjectRoot, {
        targetTool: 'cursor' as ToolId,
        strict: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some(e => e.code === 'VALIDATION_ERROR')).toBe(true);
    });

    it('should continue with warnings in non-strict mode', async () => {
      const mockAdapter = createMockAdapterWithValidation('cursor', {
        valid: false,
        errors: [{ path: 'rules[0]', message: 'Invalid rule' }],
      });
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.export(mockConfig, mockProjectRoot, {
        targetTool: 'cursor' as ToolId,
        strict: false,
      });

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.code === 'VALIDATION_WARNINGS')).toBe(true);
    });

    it('should not write files in dry-run mode', async () => {
      const mockAdapter = createMockAdapter('cursor', true);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.export(mockConfig, mockProjectRoot, {
        targetTool: 'cursor' as ToolId,
        dryRun: true,
      });

      expect(result.files).toBeDefined();
      expect(result.files?.every(f => f.created === false)).toBe(true);
    });

    it('should include export time in metadata', async () => {
      const mockAdapter = createMockAdapter('cursor', true);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.export(mockConfig, mockProjectRoot, {
        targetTool: 'cursor' as ToolId,
      });

      expect(result.metadata?.exportTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.targetTool).toBe('cursor');
    });

    it('should handle generate errors', async () => {
      const mockAdapter = createMockAdapterWithGenerateErrors('cursor', [
        { code: 'GENERATE_ERROR', message: 'Failed to generate' },
      ]);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.export(mockConfig, mockProjectRoot, {
        targetTool: 'cursor' as ToolId,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should include generate warnings', async () => {
      const mockAdapter = createMockAdapterWithGenerateWarnings('cursor', [
        { code: 'PARTIAL_SUPPORT', message: 'Some fields not supported' },
      ]);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.export(mockConfig, mockProjectRoot, {
        targetTool: 'cursor' as ToolId,
      });

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.code === 'PARTIAL_SUPPORT')).toBe(true);
    });

    it('should use custom output directory', async () => {
      const mockAdapter = createMockAdapter('cursor', true);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.export(mockConfig, mockProjectRoot, {
        targetTool: 'cursor' as ToolId,
        outputDir: '/custom/output',
      });

      expect(result.files?.[0]?.absolutePath).toContain('/custom/output');
    });
  });

  describe('exportMultiple()', () => {
    it('should export to multiple tools', async () => {
      const mockAdapter1 = createMockAdapter('cursor', true);
      const mockAdapter2 = createMockAdapter('claude-code', true);

      vi.mocked(adapterRegistry.get).mockImplementation(toolId => {
        if (toolId === 'cursor') return mockAdapter1;
        if (toolId === 'claude-code') return mockAdapter2;
        return undefined;
      });

      const results = await exporter.exportMultiple(mockConfig, mockProjectRoot, [
        'cursor' as ToolId,
        'claude-code' as ToolId,
      ]);

      expect(results.size).toBe(2);
      expect(results.has('cursor')).toBe(true);
      expect(results.has('claude-code')).toBe(true);
      expect(results.get('cursor')?.success).toBe(true);
      expect(results.get('claude-code')?.success).toBe(true);
    });

    it('should handle partial failures', async () => {
      const mockAdapterSuccess = createMockAdapter('cursor', true);
      const mockAdapterFail = createMockAdapterWithGenerateErrors('claude-code', [
        { code: 'ERROR', message: 'Failed' },
      ]);

      vi.mocked(adapterRegistry.get).mockImplementation(toolId => {
        if (toolId === 'cursor') return mockAdapterSuccess;
        if (toolId === 'claude-code') return mockAdapterFail;
        return undefined;
      });

      const results = await exporter.exportMultiple(mockConfig, mockProjectRoot, [
        'cursor' as ToolId,
        'claude-code' as ToolId,
      ]);

      expect(results.get('cursor')?.success).toBe(true);
      expect(results.get('claude-code')?.success).toBe(false);
    });

    it('should pass options to all exports', async () => {
      const mockAdapter = createMockAdapter('cursor', true);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      await exporter.exportMultiple(mockConfig, mockProjectRoot, ['cursor' as ToolId], {
        dryRun: true,
      });

      expect(mockAdapter.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ dryRun: true })
      );
    });
  });

  describe('preview()', () => {
    it('should return generate result without writing', async () => {
      const mockAdapter = createMockAdapter('cursor', true);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.preview(mockConfig, 'cursor' as ToolId);

      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
    });

    it('should return error for unknown tool', async () => {
      vi.mocked(adapterRegistry.get).mockReturnValue(undefined);

      const result = await exporter.preview(mockConfig, 'unknown' as ToolId);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].code).toBe('UNKNOWN_TOOL');
    });

    it('should pass options to generate', async () => {
      const mockAdapter = createMockAdapter('cursor', true);
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      await exporter.preview(mockConfig, 'cursor' as ToolId, { strict: true });

      expect(mockAdapter.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ dryRun: true, strict: true })
      );
    });
  });

  describe('checkCapabilities()', () => {
    it('should warn when rules not supported', async () => {
      const configWithRules: UnifiedConfig = {
        version: '1.0',
        rules: [{ id: 'rule-1', content: 'Test' }],
      };
      const mockAdapter = createMockAdapterWithoutCapability('copilot', 'rules');
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.export(configWithRules, mockProjectRoot, {
        targetTool: 'copilot' as ToolId,
      });

      expect(result.warnings?.some(w => w.code === 'CAPABILITY_NOT_SUPPORTED')).toBe(true);
      expect(result.warnings?.some(w => w.message.includes('rules'))).toBe(true);
    });

    it('should warn when MCP not supported', async () => {
      const configWithMCP: UnifiedConfig = {
        version: '1.0',
        rules: [],
        mcp: { servers: [{ name: 'server1', command: 'cmd' }] },
      };
      const mockAdapter = createMockAdapterWithoutCapability('copilot', 'mcp_servers');
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.export(configWithMCP, mockProjectRoot, {
        targetTool: 'copilot' as ToolId,
      });

      expect(result.warnings?.some(w => w.message.includes('MCP'))).toBe(true);
    });

    it('should warn when commands not supported', async () => {
      const configWithCommands: UnifiedConfig = {
        version: '1.0',
        rules: [],
        commands: [{ id: 'cmd1', name: 'Command', template: 'template' }],
      };
      const mockAdapter = createMockAdapterWithoutCapability('copilot', 'commands');
      vi.mocked(adapterRegistry.get).mockReturnValue(mockAdapter);

      const result = await exporter.export(configWithCommands, mockProjectRoot, {
        targetTool: 'copilot' as ToolId,
      });

      expect(result.warnings?.some(w => w.message.includes('commands'))).toBe(true);
    });
  });
});

// Helper functions to create mock adapters
function createMockAdapter(toolId: string, valid: boolean) {
  return {
    toolMeta: { id: toolId, name: toolId },
    validate: vi.fn().mockResolvedValue({ valid, errors: [] }),
    generate: vi.fn().mockResolvedValue({
      success: true,
      files: [
        {
          path: `.${toolId}rules`,
          content: 'Generated content',
          encoding: 'utf-8',
          overwrite: true,
        },
      ],
    }),
    hasCapability: vi.fn().mockReturnValue(true),
    getFilePatterns: vi.fn().mockReturnValue([]),
  };
}

function createMockAdapterWithValidation(toolId: string, validation: ValidationResult) {
  return {
    toolMeta: { id: toolId, name: toolId },
    validate: vi.fn().mockResolvedValue(validation),
    generate: vi.fn().mockResolvedValue({
      success: true,
      files: [
        {
          path: `.${toolId}rules`,
          content: 'Generated content',
          encoding: 'utf-8',
          overwrite: true,
        },
      ],
    }),
    hasCapability: vi.fn().mockReturnValue(true),
    getFilePatterns: vi.fn().mockReturnValue([]),
  };
}

function createMockAdapterWithGenerateErrors(
  toolId: string,
  errors: Array<{ code: string; message: string }>
) {
  return {
    toolMeta: { id: toolId, name: toolId },
    validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    generate: vi.fn().mockResolvedValue({
      success: false,
      files: [],
      errors,
    }),
    hasCapability: vi.fn().mockReturnValue(true),
    getFilePatterns: vi.fn().mockReturnValue([]),
  };
}

function createMockAdapterWithGenerateWarnings(
  toolId: string,
  warnings: Array<{ code: string; message: string; suggestion?: string }>
) {
  return {
    toolMeta: { id: toolId, name: toolId },
    validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    generate: vi.fn().mockResolvedValue({
      success: true,
      files: [
        {
          path: `.${toolId}rules`,
          content: 'Generated content',
          encoding: 'utf-8',
          overwrite: true,
        },
      ],
      warnings,
    }),
    hasCapability: vi.fn().mockReturnValue(true),
    getFilePatterns: vi.fn().mockReturnValue([]),
  };
}

function createMockAdapterWithoutCapability(toolId: string, capability: string) {
  return {
    toolMeta: { id: toolId, name: toolId },
    validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    generate: vi.fn().mockResolvedValue({
      success: true,
      files: [
        {
          path: `.${toolId}config`,
          content: 'Generated content',
          encoding: 'utf-8',
          overwrite: true,
        },
      ],
    }),
    hasCapability: vi.fn().mockImplementation(cap => cap !== capability),
    getFilePatterns: vi.fn().mockReturnValue([]),
  };
}
