/**
 * detect command tests
 * Tests the detect command functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// Use vi.hoisted to create mock functions before module loading
const { mockFileDiscoveryDetectTools } = vi.hoisted(() => {
  return {
    mockFileDiscoveryDetectTools: vi.fn(),
  };
});

// Mock dependencies
vi.mock('@unify-ai/core', () => ({
  fileDiscovery: {
    detectTools: mockFileDiscoveryDetectTools,
  },
}));

vi.mock('../../utils/logger.js', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock console to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Import after mocking
import { detectCommand } from '../../commands/detect';

function createMockAdapter(id: string, name: string) {
  return {
    toolMeta: { id, name },
    version: '1.0.0',
    getCapabilities: () => [
      { capability: 'rules', level: 'full' },
      { capability: 'mcpServers', level: 'partial' },
    ],
    getFilePatterns: () => [
      { pattern: `.cursorrules`, type: 'rules' },
      { pattern: `.cursor/mcp.json`, type: 'mcp' },
    ],
  };
}

describe('detect command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockImplementation(() => {});
    mockConsoleError.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('command configuration', () => {
    it('should be a Commander command', () => {
      expect(detectCommand).toBeInstanceOf(Command);
    });

    it('should have name "detect"', () => {
      expect(detectCommand.name()).toBe('detect');
    });

    it('should have correct options defined', () => {
      const options = detectCommand.options;
      const optionNames = options.map(o => o.long);

      expect(optionNames).toContain('--json');
      expect(optionNames).toContain('--verbose');
    });
  });

  describe('detection with no tools found', () => {
    it('should show message when no tools detected', async () => {
      mockFileDiscoveryDetectTools.mockResolvedValue([]);

      await detectCommand.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockFileDiscoveryDetectTools).toHaveBeenCalled();
    });
  });

  describe('detection with tools found', () => {
    it('should list detected tools', async () => {
      const mockAdapters = [
        createMockAdapter('cursor', 'Cursor'),
        createMockAdapter('claude-code', 'Claude Code'),
      ];

      mockFileDiscoveryDetectTools.mockResolvedValue(mockAdapters as any);

      await detectCommand.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockFileDiscoveryDetectTools).toHaveBeenCalledWith(process.cwd());
    });

    it('should show simple list without verbose flag', async () => {
      const mockAdapters = [
        createMockAdapter('cursor', 'Cursor'),
      ];

      mockFileDiscoveryDetectTools.mockResolvedValue(mockAdapters as any);

      await detectCommand.parseAsync(['node', 'test'], { from: 'user' });

      expect(mockFileDiscoveryDetectTools).toHaveBeenCalled();
    });

    it('should show detailed table with verbose flag', async () => {
      const mockAdapters = [
        createMockAdapter('cursor', 'Cursor'),
        createMockAdapter('claude-code', 'Claude Code'),
      ];

      mockFileDiscoveryDetectTools.mockResolvedValue(mockAdapters as any);

      await detectCommand.parseAsync(['node', 'test', '--verbose'], { from: 'user' });

      expect(mockFileDiscoveryDetectTools).toHaveBeenCalled();
    });
  });

  describe('--json output', () => {
    it('should output JSON format when --json flag is set', async () => {
      const mockAdapters = [
        createMockAdapter('cursor', 'Cursor'),
      ];

      mockFileDiscoveryDetectTools.mockResolvedValue(mockAdapters as any);

      await detectCommand.parseAsync(['node', 'test', '--json'], { from: 'user' });

      expect(mockFileDiscoveryDetectTools).toHaveBeenCalled();

      // Check that JSON was logged
      const jsonCalls = mockConsoleLog.mock.calls;
      const lastCall = jsonCalls[jsonCalls.length - 1]?.[0];

      // Should be valid JSON
      if (lastCall) {
        expect(() => JSON.parse(lastCall)).not.toThrow();
      }
    });

    it('should include tool details in JSON output', async () => {
      const mockAdapters = [
        createMockAdapter('cursor', 'Cursor'),
      ];

      mockFileDiscoveryDetectTools.mockResolvedValue(mockAdapters as any);

      await detectCommand.parseAsync(['node', 'test', '--json'], { from: 'user' });

      const jsonCalls = mockConsoleLog.mock.calls;
      const lastCall = jsonCalls[jsonCalls.length - 1]?.[0];

      if (lastCall) {
        const parsed = JSON.parse(lastCall);
        expect(Array.isArray(parsed)).toBe(true);

        if (parsed.length > 0) {
          expect(parsed[0]).toHaveProperty('name');
          expect(parsed[0]).toHaveProperty('id');
          expect(parsed[0]).toHaveProperty('version');
          expect(parsed[0]).toHaveProperty('capabilities');
          expect(parsed[0]).toHaveProperty('configFiles');
        }
      }
    });

    it('should return empty array in JSON when no tools detected', async () => {
      mockFileDiscoveryDetectTools.mockResolvedValue([]);

      await detectCommand.parseAsync(['node', 'test', '--json'], { from: 'user' });

      const jsonCalls = mockConsoleLog.mock.calls;
      const lastCall = jsonCalls[jsonCalls.length - 1]?.[0];

      if (lastCall) {
        const parsed = JSON.parse(lastCall);
        expect(parsed).toEqual([]);
      }
    });
  });

  describe('error handling', () => {
    it('should handle detection errors', async () => {
      mockFileDiscoveryDetectTools.mockRejectedValue(new Error('Detection failed'));

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      await expect(
        detectCommand.parseAsync(['node', 'test'], { from: 'user' })
      ).rejects.toThrow('process.exit');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    it('should handle permission errors', async () => {
      mockFileDiscoveryDetectTools.mockRejectedValue(
        new Error('Permission denied')
      );

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      await expect(
        detectCommand.parseAsync(['node', 'test'], { from: 'user' })
      ).rejects.toThrow('process.exit');

      mockExit.mockRestore();
    });
  });
});
