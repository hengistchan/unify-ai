/**
 * sync command tests
 * Tests the sync command functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// Use vi.hoisted to create mock functions before module loading
const { mockCreateConfigManager } = vi.hoisted(() => {
  return {
    mockCreateConfigManager: vi.fn(),
  };
});

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
    computeAllDiffs: vi.fn().mockResolvedValue([{ entries: [] }]),
  },
  DiffEntry: {},
  DiffType: {},
  exporter: {
    export: vi.fn().mockResolvedValue({ success: true }),
  },
  adapterRegistry: {
    get: vi.fn().mockReturnValue({
      toolMeta: { id: 'cursor', name: 'Cursor' },
      version: '1.0.0',
      parse: vi.fn().mockResolvedValue({
        success: true,
        data: { version: '1.0', rules: [] },
      }),
    }),
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

    it('should call createConfigManager', async () => {
      await syncCommand.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockCreateConfigManager).toHaveBeenCalled();
    });
  });

  describe('sync with specific tools', () => {
    it('should accept tool arguments without error', async () => {
      await syncCommand.parseAsync(['node', 'test', 'cursor', 'claude-code'], { from: 'user' });

      expect(mockConfigManager.load).toHaveBeenCalled();
    });

    it('should handle invalid tool without error', async () => {
      await syncCommand.parseAsync(['node', 'test', 'invalid-tool'], { from: 'user' });

      expect(mockConfigManager.load).toHaveBeenCalled();
    });
  });

  describe('--mode options', () => {
    it('should accept one-way-export mode', async () => {
      await syncCommand.parseAsync(['node', 'test', '--mode', 'one-way-export'], { from: 'user' });

      expect(mockConfigManager.load).toHaveBeenCalled();
    });

    it('should accept one-way-import mode', async () => {
      await syncCommand.parseAsync(['node', 'test', '--mode', 'one-way-import'], { from: 'user' });

      expect(mockConfigManager.load).toHaveBeenCalled();
    });

    it('should accept two-way-auto mode', async () => {
      await syncCommand.parseAsync(['node', 'test', '--mode', 'two-way-auto'], { from: 'user' });

      expect(mockConfigManager.load).toHaveBeenCalled();
    });
  });

  describe('--strategy options', () => {
    it('should accept unified-wins strategy', async () => {
      await syncCommand.parseAsync(['node', 'test', '--strategy', 'unified-wins'], {
        from: 'user',
      });

      expect(mockConfigManager.load).toHaveBeenCalled();
    });

    it('should accept tool-wins strategy', async () => {
      await syncCommand.parseAsync(['node', 'test', '--strategy', 'tool-wins'], { from: 'user' });

      expect(mockConfigManager.load).toHaveBeenCalled();
    });

    it('should accept latest strategy', async () => {
      await syncCommand.parseAsync(['node', 'test', '--strategy', 'latest'], { from: 'user' });

      expect(mockConfigManager.load).toHaveBeenCalled();
    });

    it('should accept merge strategy', async () => {
      await syncCommand.parseAsync(['node', 'test', '--strategy', 'merge'], { from: 'user' });

      expect(mockConfigManager.load).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle config load errors', async () => {
      mockConfigManager.load.mockRejectedValue(new Error('Config not found'));

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      await expect(syncCommand.parseAsync(['node', 'test'], { from: 'user' })).rejects.toThrow(
        'process.exit'
      );

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
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

      await expect(syncCommand.parseAsync(['node', 'test'], { from: 'user' })).rejects.toThrow(
        'process.exit'
      );

      mockExit.mockRestore();
    });
  });

  describe('--watch option', () => {
    it('should have watch option defined', () => {
      const options = syncCommand.options;
      const watchOption = options.find(o => o.long === '--watch');
      expect(watchOption).toBeDefined();
    });
  });

  describe('--debounce option', () => {
    it('should have debounce option defined', () => {
      const options = syncCommand.options;
      const debounceOption = options.find(o => o.long === '--debounce');
      expect(debounceOption).toBeDefined();
    });
  });

  describe('--skip-hooks option', () => {
    it('should have skip-hooks option defined', () => {
      const options = syncCommand.options;
      const skipHooksOption = options.find(o => o.long === '--skip-hooks');
      expect(skipHooksOption).toBeDefined();
    });
  });
});
