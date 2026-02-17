/**
 * init command tests
 * Tests the init command functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// Use vi.hoisted to create mock functions before module loading
const { mockCreateConfigManager, mockFileDiscoveryDetectTools, mockAdapterRegistryGet } = vi.hoisted(() => {
  return {
    mockCreateConfigManager: vi.fn(),
    mockFileDiscoveryDetectTools: vi.fn(),
    mockAdapterRegistryGet: vi.fn(),
  };
});

// Mock dependencies before importing the module
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
  fileDiscovery: {
    detectTools: mockFileDiscoveryDetectTools,
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
    item: vi.fn(),
    subSection: vi.fn(),
  })),
}));

// Import after mocking
import { initCommand } from '../../commands/init';

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

describe('init command', () => {
  let mockConfigManager: ReturnType<typeof createMockConfigManager>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigManager = createMockConfigManager();
    mockCreateConfigManager.mockReturnValue(mockConfigManager);

    // Default mock responses
    mockFileDiscoveryDetectTools.mockResolvedValue([]);
    mockAdapterRegistryGet.mockReturnValue(createMockAdapter('claude-code', 'Claude Code'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('command configuration', () => {
    it('should be a Commander command', () => {
      expect(initCommand).toBeInstanceOf(Command);
    });

    it('should have name "init"', () => {
      expect(initCommand.name()).toBe('init');
    });

    it('should have correct options defined', () => {
      const options = initCommand.options;
      const optionNames = options.map(o => o.long);

      expect(optionNames).toContain('--from');
      expect(optionNames).toContain('--interactive');
      expect(optionNames).toContain('--template');
      expect(optionNames).toContain('--force');
      expect(optionNames).toContain('--skip-hooks');
    });
  });

  describe('default initialization', () => {
    it('should create default config when no options provided', async () => {
      await initCommand.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockCreateConfigManager).toHaveBeenCalled();
      expect(mockConfigManager.createDefaultConfig).toHaveBeenCalled();
      expect(mockConfigManager.save).toHaveBeenCalled();
    });

    it('should fail if config exists without --force', async () => {
      mockConfigManager.exists.mockResolvedValue(true);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      await expect(
        initCommand.parseAsync(['node', 'test'], { from: 'user' })
      ).rejects.toThrow('process.exit');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    it('should overwrite existing config with --force', async () => {
      mockConfigManager.exists.mockResolvedValue(true);

      await initCommand.parseAsync(['node', 'test', '--force'], { from: 'user' });

      expect(mockConfigManager.createDefaultConfig).toHaveBeenCalled();
      expect(mockConfigManager.save).toHaveBeenCalled();
    });
  });

  describe('--from option', () => {
    it('should fail for unsupported tool', async () => {
      mockConfigManager.exists.mockResolvedValue(false);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      await expect(
        initCommand.parseAsync(['node', 'test', '--from', 'unsupported-tool'], { from: 'user' })
      ).rejects.toThrow('process.exit');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    it('should import from valid tool', async () => {
      mockConfigManager.exists.mockResolvedValue(false);

      const mockAdapter = createMockAdapter('claude-code', 'Claude Code');
      mockAdapterRegistryGet.mockReturnValue(mockAdapter);

      await initCommand.parseAsync(['node', 'test', '--from', 'claude-code'], { from: 'user' });

      expect(mockAdapterRegistryGet).toHaveBeenCalledWith('claude-code');
      expect(mockAdapter.parse).toHaveBeenCalled();
      expect(mockConfigManager.save).toHaveBeenCalled();
    });

    it('should handle parse failure', async () => {
      mockConfigManager.exists.mockResolvedValue(false);

      const mockAdapter = createMockAdapter('claude-code', 'Claude Code');
      mockAdapter.parse.mockResolvedValue({
        success: false,
        errors: [{ message: 'Parse error' }],
      });
      mockAdapterRegistryGet.mockReturnValue(mockAdapter);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      await expect(
        initCommand.parseAsync(['node', 'test', '--from', 'claude-code'], { from: 'user' })
      ).rejects.toThrow('process.exit');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('--interactive option', () => {
    it('should run interactive mode', async () => {
      mockConfigManager.exists.mockResolvedValue(false);

      // Just verify the command doesn't throw with interactive mode
      // (actual inquirer prompts are hard to test without complex setup)
      await initCommand.parseAsync(['node', 'test', '--interactive'], { from: 'user' });

      expect(mockConfigManager.save).toHaveBeenCalled();
    });
  });

  describe('--template option', () => {
    it('should accept template option', async () => {
      mockConfigManager.exists.mockResolvedValue(false);

      await initCommand.parseAsync(['node', 'test', '--template', 'minimal'], { from: 'user' });

      expect(mockConfigManager.createDefaultConfig).toHaveBeenCalled();
      expect(mockConfigManager.save).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle config manager errors', async () => {
      mockConfigManager.exists.mockRejectedValue(new Error('FS error'));

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      await expect(
        initCommand.parseAsync(['node', 'test'], { from: 'user' })
      ).rejects.toThrow();

      mockExit.mockRestore();
    });

    it('should handle save errors', async () => {
      mockConfigManager.exists.mockResolvedValue(false);
      mockConfigManager.save.mockRejectedValue(new Error('Write error'));

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      await expect(
        initCommand.parseAsync(['node', 'test'], { from: 'user' })
      ).rejects.toThrow('process.exit');

      mockExit.mockRestore();
    });

    it('should handle adapter not found', async () => {
      mockConfigManager.exists.mockResolvedValue(false);
      mockAdapterRegistryGet.mockReturnValue(undefined);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      await expect(
        initCommand.parseAsync(['node', 'test', '--from', 'claude-code'], { from: 'user' })
      ).rejects.toThrow('process.exit');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('tool ID mapping', () => {
    it('should map all supported tool IDs correctly', async () => {
      mockConfigManager.exists.mockResolvedValue(false);

      const supportedTools = [
        'claude-code',
        'cursor',
        'copilot',
        'windsurf',
        'cline',
        'aider',
        'continue',
      ];

      for (const tool of supportedTools) {
        const mockAdapter = createMockAdapter(tool, tool);
        mockAdapterRegistryGet.mockReturnValue(mockAdapter);

        await initCommand.parseAsync(['node', 'test', '--from', tool], { from: 'user' });

        expect(mockAdapterRegistryGet).toHaveBeenCalledWith(tool);
      }
    });
  });
});
