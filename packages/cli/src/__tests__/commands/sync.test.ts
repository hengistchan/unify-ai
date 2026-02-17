/**
 * sync command tests
 * Tests the sync command functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// Create mock functions that persist
const mockCreateConfigManager = vi.fn();
const mockDiffEngineComputeAllDiffs = vi.fn();
const mockExporterExport = vi.fn();
const mockAdapterRegistryGet = vi.fn();

// Mock dependencies - must be before any imports
vi.mock('@unify-ai/core', () => ({
  createConfigManager: mockCreateConfigManager,
  ConfigManager: vi.fn(),
  ToolId: {
    CLAUDE_CODE: 'claude-code',
    CURSOR: 'cursor',
    COPILOT: 'copilot',
    WINDSURF: 'windsurf',
    CLINE: 'cline',
    AIDER: 'aider',
    CONTINUE: 'continue',
    CODEX: 'codex',
  },
  UnifiedConfig: {},
  diffEngine: {
    computeAllDiffs: mockDiffEngineComputeAllDiffs,
  },
  exporter: {
    export: mockExporterExport,
  },
  adapterRegistry: {
    get: mockAdapterRegistryGet,
  },
}));

vi.mock('../../utils/logger.js', () => ({
  getLogger: vi.fn(() => ({
    section: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    subSection: vi.fn(),
  })),
}));

// Import after mocking
import { syncCommand } from '../../commands/sync';

function createMockAdapter(id: string, name: string) {
  return {
    toolMeta: { id, name },
    version: '1.0.0',
    parse: vi.fn().mockResolvedValue({
      success: true,
      data: { version: '1.0', rules: [] },
    }),
  };
}

function createMockConfigManager() {
  return {
    exists: vi.fn().mockResolvedValue(false),
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue({
      version: '1.0',
      rules: [],
      mcpServers: {},
      settings: {},
    }),
    createDefaultConfig: vi.fn().mockReturnValue({
      version: '1.0',
      rules: [],
      mcpServers: {},
      settings: {},
    }),
    backup: vi.fn().mockResolvedValue({ path: '/backup/unified.json.bak' }),
  };
}

describe('sync command', () => {
  let mockConfigManager: ReturnType<typeof createMockConfigManager>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = createMockConfigManager();
    mockCreateConfigManager.mockReturnValue(mockConfigManager);

    // Default mock responses
    mockDiffEngineComputeAllDiffs.mockResolvedValue([{ entries: [] }]);
    mockAdapterRegistryGet.mockReturnValue(createMockAdapter('cursor', 'Cursor'));
    mockExporterExport.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('command configuration', () => {
    it('should be a Commander command', () => {
      expect(syncCommand).toBeInstanceOf(Command);
    });

    it('should have name "sync"', () => {
      expect(syncCommand.name()).toBe('sync');
    });

    it('should have correct options defined', () => {
      const options = syncCommand.options;
      const optionNames = options.map(o => o.long);

      expect(optionNames).toContain('--mode');
      expect(optionNames).toContain('--strategy');
      expect(optionNames).toContain('--watch');
      expect(optionNames).toContain('--debounce');
      expect(optionNames).toContain('--backup');
      expect(optionNames).toContain('--skip-hooks');
    });

    it('should accept tool arguments', () => {
      expect(syncCommand.arguments()).toBe('[tools...]');
    });
  });

  describe('default sync', () => {
    it('should load unified config', async () => {
      await syncCommand.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockConfigManager.load).toHaveBeenCalled();
    });

    it('should create backup by default', async () => {
      await syncCommand.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockConfigManager.backup).toHaveBeenCalled();
    });

    it('should sync all tools when no tools specified', async () => {
      await syncCommand.parseAsync(['node', 'test'], { from: 'user' });

      // Should call adapterRegistry.get for each tool
      expect(mockAdapterRegistryGet).toHaveBeenCalled();
    });
  });

  describe('sync with specific tools', () => {
    it('should sync only specified tools', async () => {
      await syncCommand.parseAsync(['node', 'test', 'cursor', 'claude-code'], { from: 'user' });

      // Should only call for the 2 specified tools
      expect(mockAdapterRegistryGet).toHaveBeenCalledTimes(2);
    });

    it('should skip unsupported tools', async () => {
      mockAdapterRegistryGet.mockReturnValue(undefined);

      // Should not throw even with unsupported tools
      await syncCommand.parseAsync(['node', 'test', 'invalid-tool'], { from: 'user' });
    });
  });

  describe('--mode options', () => {
    it('should use two-way-interactive as default mode', async () => {
      await syncCommand.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockDiffEngineComputeAllDiffs).toHaveBeenCalled();
    });

    it('should handle one-way-export mode', async () => {
      mockDiffEngineComputeAllDiffs.mockResolvedValue([
        { entries: [{ path: 'rules', source: 'unified' }] },
      ]);

      await syncCommand.parseAsync(['node', 'test', '--mode', 'one-way-export'], { from: 'user' });

      expect(mockDiffEngineComputeAllDiffs).toHaveBeenCalled();
    });

    it('should handle one-way-import mode', async () => {
      mockDiffEngineComputeAllDiffs.mockResolvedValue([
        { entries: [{ path: 'rules', source: 'tool' }] },
      ]);

      await syncCommand.parseAsync(['node', 'test', '--mode', 'one-way-import'], { from: 'user' });

      expect(mockDiffEngineComputeAllDiffs).toHaveBeenCalled();
    });
  });

  describe('--strategy options', () => {
    it('should apply unified-wins strategy', async () => {
      mockDiffEngineComputeAllDiffs.mockResolvedValue([
        { entries: [{ path: 'rules', source: 'both' }] },
      ]);

      await syncCommand.parseAsync(
        ['node', 'test', '--strategy', 'unified-wins'],
        { from: 'user' }
      );

      expect(mockDiffEngineComputeAllDiffs).toHaveBeenCalled();
    });

    it('should apply tool-wins strategy', async () => {
      mockDiffEngineComputeAllDiffs.mockResolvedValue([
        { entries: [{ path: 'rules', source: 'both' }] },
      ]);

      await syncCommand.parseAsync(
        ['node', 'test', '--strategy', 'tool-wins'],
        { from: 'user' }
      );

      expect(mockDiffEngineComputeAllDiffs).toHaveBeenCalled();
    });

    it('should apply latest strategy', async () => {
      mockDiffEngineComputeAllDiffs.mockResolvedValue([
        { entries: [{ path: 'rules', source: 'both' }] },
      ]);

      await syncCommand.parseAsync(
        ['node', 'test', '--strategy', 'latest'],
        { from: 'user' }
      );

      expect(mockDiffEngineComputeAllDiffs).toHaveBeenCalled();
    });

    it('should apply merge strategy', async () => {
      mockDiffEngineComputeAllDiffs.mockResolvedValue([
        { entries: [{ path: 'rules', source: 'both' }] },
      ]);

      await syncCommand.parseAsync(
        ['node', 'test', '--strategy', 'merge'],
        { from: 'user' }
      );

      expect(mockDiffEngineComputeAllDiffs).toHaveBeenCalled();
    });
  });

  describe('diff handling', () => {
    it('should skip tools with no changes', async () => {
      mockDiffEngineComputeAllDiffs.mockResolvedValue([{ entries: [] }]);

      await syncCommand.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockDiffEngineComputeAllDiffs).toHaveBeenCalled();
    });

    it('should export unified changes', async () => {
      mockDiffEngineComputeAllDiffs.mockResolvedValue([
        { entries: [{ path: 'rules', source: 'unified' }] },
      ]);

      await syncCommand.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockExporterExport).toHaveBeenCalled();
    });

    it('should handle export failures', async () => {
      mockDiffEngineComputeAllDiffs.mockResolvedValue([
        { entries: [{ path: 'rules', source: 'unified' }] },
      ]);
      mockExporterExport.mockResolvedValue({
        success: false,
        errors: [{ message: 'Export failed' }],
      });

      await syncCommand.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockExporterExport).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle config load errors', async () => {
      mockConfigManager.load.mockRejectedValue(new Error('Config not found'));

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      await expect(
        syncCommand.parseAsync(['node', 'test'], { from: 'user' })
      ).rejects.toThrow('process.exit');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    it('should handle diff computation errors', async () => {
      mockDiffEngineComputeAllDiffs.mockRejectedValue(new Error('Diff failed'));

      // Should not exit, just log error and continue
      await syncCommand.parseAsync(['node', 'test'], { from: 'user' });
    });

    it('should continue on individual tool errors', async () => {
      mockDiffEngineComputeAllDiffs
        .mockResolvedValueOnce([{ entries: [] }])
        .mockRejectedValueOnce(new Error('Tool error'));

      // Should not throw, just log error
      await syncCommand.parseAsync(['node', 'test'], { from: 'user' });
    });
  });

  describe('backup', () => {
    it('should create backup before sync', async () => {
      await syncCommand.parseAsync(['node', 'test', '--backup'], { from: 'user' });

      expect(mockConfigManager.backup).toHaveBeenCalled();
    });

    it('should handle backup errors', async () => {
      mockConfigManager.backup.mockRejectedValue(new Error('Backup failed'));

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      await expect(
        syncCommand.parseAsync(['node', 'test'], { from: 'user' })
      ).rejects.toThrow('process.exit');

      mockExit.mockRestore();
    });
  });
});
