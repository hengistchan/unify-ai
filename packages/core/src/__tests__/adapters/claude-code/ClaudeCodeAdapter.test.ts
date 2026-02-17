/**
 * ClaudeCodeAdapter Unit Tests
 * Tests the Claude Code adapter parse and generate functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ClaudeCodeAdapter } from '../../../adapters/claude-code/ClaudeCodeAdapter';
import type { UnifiedConfig, RuleConfig, MCPConfig, ToolSettings } from '../../../core/types';
import { ConfigCapability as CC, CapabilityLevel as CL, ToolId } from '../../../core/types';

describe('ClaudeCodeAdapter', () => {
  let adapter: ClaudeCodeAdapter;
  const fixturesPath = path.join(__dirname, '../../fixtures/tools/claude-code');

  beforeEach(() => {
    adapter = new ClaudeCodeAdapter();
  });

  describe('metadata', () => {
    it('should have correct tool metadata', () => {
      expect(adapter.toolMeta.id).toBe(ToolId.CLAUDE_CODE);
      expect(adapter.toolMeta.name).toBe('Claude Code');
      expect(adapter.toolMeta.website).toBe('https://claude.ai/code');
    });

    it('should have a version', () => {
      expect(adapter.version).toBeDefined();
      expect(adapter.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('getCapabilities()', () => {
    it('should return correct capabilities', () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities).toContainEqual(
        expect.objectContaining({ capability: CC.RULES, level: CL.FULL })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ capability: CC.MCP_SERVERS, level: CL.FULL })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ capability: CC.SETTINGS, level: CL.FULL })
      );
      expect(capabilities).toContainEqual(
        expect.objectContaining({ capability: CC.COMMANDS, level: CL.FULL })
      );
    });
  });

  describe('hasCapability()', () => {
    it('should return true for supported capabilities', () => {
      expect(adapter.hasCapability(CC.RULES)).toBe(true);
      expect(adapter.hasCapability(CC.MCP_SERVERS)).toBe(true);
      expect(adapter.hasCapability(CC.SETTINGS)).toBe(true);
      expect(adapter.hasCapability(CC.COMMANDS)).toBe(true);
    });

    it('should return false for unsupported capabilities', () => {
      expect(adapter.hasCapability(CC.PROMPTS)).toBe(false);
      expect(adapter.hasCapability(CC.CONTEXT)).toBe(false);
    });
  });

  describe('getFilePatterns()', () => {
    it('should return correct file patterns', () => {
      const patterns = adapter.getFilePatterns();

      expect(patterns.some(p => p.pattern === 'CLAUDE.md')).toBe(true);
      expect(patterns.some(p => p.pattern === '.mcp.json')).toBe(true);
      expect(patterns.some(p => p.pattern === '.claude/settings.json')).toBe(true);
      expect(patterns.some(p => p.pattern === '.claude/commands/*.md')).toBe(true);
    });

    it('should have all optional patterns', () => {
      const patterns = adapter.getFilePatterns();

      expect(patterns.every(p => p.type === 'optional')).toBe(true);
    });
  });

  describe('parse()', () => {
    it('should parse CLAUDE.md file', async () => {
      const result = await adapter.parse(fixturesPath);

      expect(result.success).toBe(true);
      expect(result.data?.rules).toBeDefined();
      expect(result.data?.rules.length).toBeGreaterThan(0);
    });

    it('should parse rule content correctly', async () => {
      const result = await adapter.parse(fixturesPath);

      const rule = result.data?.rules[0];
      expect(rule).toBeDefined();
      expect(rule?.id).toBeDefined();
      expect(rule?.content).toContain('Project Rules');
    });

    it('should record source files in metadata', async () => {
      const result = await adapter.parse(fixturesPath);

      expect(result.metadata?.sourceFiles).toBeDefined();
      expect(result.metadata?.sourceFiles.length).toBeGreaterThan(0);
      expect(result.metadata?.sourceFiles[0].path).toBe('CLAUDE.md');
    });

    it('should handle project without CLAUDE.md', async () => {
      const tempDir = await fs.mkdtemp('/tmp/claude-test-');
      try {
        const result = await adapter.parse(tempDir);

        expect(result.success).toBe(true);
        expect(result.data?.rules).toEqual([]);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });

    it('should parse .mcp.json file', async () => {
      const result = await adapter.parse(fixturesPath);

      expect(result.data?.mcp).toBeDefined();
      expect(result.data?.mcp?.servers).toBeDefined();
    });

    it('should handle empty project', async () => {
      const tempDir = await fs.mkdtemp('/tmp/claude-test-');
      try {
        const result = await adapter.parse(tempDir);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.sourceTool).toBe(ToolId.CLAUDE_CODE);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });
  });

  describe('parseContent()', () => {
    it('should parse CLAUDE.md content', async () => {
      const content = `# Test Project

## Guidelines
- Write clean code
- Test everything
`;

      const result = await adapter.parseContent(content, '/test/CLAUDE.md');

      expect(result.success).toBe(true);
      expect(result.data?.rules).toHaveLength(1);
      expect(result.data?.rules[0].content).toContain('Test Project');
    });

    it('should parse .mcp.json content', async () => {
      const content = JSON.stringify({
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      });

      const result = await adapter.parseContent(content, '/test/.mcp.json');

      expect(result.success).toBe(true);
      expect(result.data?.mcp?.servers).toHaveLength(1);
      expect(result.data?.mcp?.servers[0].name).toBe('test-server');
      expect(result.data?.mcp?.servers[0].command).toBe('node');
    });

    it('should parse settings.json content', async () => {
      const content = JSON.stringify({
        permissions: {
          allow: ['read:*'],
          deny: ['write:*'],
        },
        enableAllProjectMcpServers: true,
      });

      const result = await adapter.parseContent(content, '/test/settings.json');

      expect(result.success).toBe(true);
      expect(result.data?.settings).toBeDefined();
      expect(result.data?.settings?.permissions?.allow).toContain('read:*');
      expect(result.data?.settings?.permissions?.deny).toContain('write:*');
    });

    it('should handle invalid JSON for MCP', async () => {
      const content = '{ invalid json }';

      const result = await adapter.parseContent(content, '/test/.mcp.json');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some(e => e.code === 'JSON_PARSE_ERROR')).toBe(true);
    });

    it('should handle invalid JSON for settings', async () => {
      const content = '{ invalid json }';

      const result = await adapter.parseContent(content, '/test/settings.json');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should return error for unknown file type', async () => {
      const content = 'some content';

      const result = await adapter.parseContent(content, '/test/unknown.txt');

      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.code === 'UNKNOWN_FILE_TYPE')).toBe(true);
    });
  });

  describe('generate()', () => {
    it('should generate CLAUDE.md from rules', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        sourceTool: ToolId.CLAUDE_CODE,
        rules: [
          {
            id: 'rule1',
            name: 'Test Rule',
            content: '# Test Rule\n\nThis is the content.',
          },
        ],
      };

      const result = await adapter.generate(config);

      expect(result.success).toBe(true);
      expect(result.files.some(f => f.path === 'CLAUDE.md')).toBe(true);

      const claudeMd = result.files.find(f => f.path === 'CLAUDE.md');
      expect(claudeMd?.content).toContain('Test Rule');
    });

    it('should generate .mcp.json from MCP config', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        sourceTool: ToolId.CLAUDE_CODE,
        rules: [],
        mcp: {
          servers: [
            {
              name: 'filesystem',
              command: 'mcp-server-filesystem',
              args: ['--root', './src'],
            },
          ],
        },
      };

      const result = await adapter.generate(config);

      expect(result.files.some(f => f.path === '.mcp.json')).toBe(true);

      const mcpFile = result.files.find(f => f.path === '.mcp.json');
      const mcpContent = JSON.parse(mcpFile?.content as string);
      expect(mcpContent.mcpServers.filesystem).toBeDefined();
      expect(mcpContent.mcpServers.filesystem.command).toBe('mcp-server-filesystem');
    });

    it('should generate settings.json from settings', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        sourceTool: ToolId.CLAUDE_CODE,
        rules: [],
        settings: {
          permissions: {
            allow: ['read:*'],
            deny: ['write:*'],
          },
          toolSpecific: {
            enableAllProjectMcpServers: true,
          },
        },
      };

      const result = await adapter.generate(config);

      expect(result.files.some(f => f.path === '.claude/settings.json')).toBe(true);

      const settingsFile = result.files.find(f => f.path === '.claude/settings.json');
      const settingsContent = JSON.parse(settingsFile?.content as string);
      expect(settingsContent.permissions.allow).toContain('read:*');
      expect(settingsContent.enableAllProjectMcpServers).toBe(true);
    });

    it('should generate command files from commands', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        sourceTool: ToolId.CLAUDE_CODE,
        rules: [],
        commands: [
          {
            id: 'cmd-test',
            name: 'test',
            description: 'Run tests',
            template: 'pnpm test',
          },
        ],
      };

      const result = await adapter.generate(config);

      expect(result.files.some(f => f.path === '.claude/commands/test.md')).toBe(true);

      const cmdFile = result.files.find(f => f.path === '.claude/commands/test.md');
      expect(cmdFile?.content).toContain('Run tests');
      expect(cmdFile?.content).toContain('pnpm test');
    });

    it('should not generate files for empty config', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        sourceTool: ToolId.CLAUDE_CODE,
        rules: [],
      };

      const result = await adapter.generate(config);

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(0);
    });

    it('should combine multiple rules into single CLAUDE.md', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        sourceTool: ToolId.CLAUDE_CODE,
        rules: [
          { id: 'rule1', name: 'Rule 1', content: 'Content 1' },
          { id: 'rule2', name: 'Rule 2', content: 'Content 2' },
        ],
      };

      const result = await adapter.generate(config);

      const claudeMd = result.files.find(f => f.path === 'CLAUDE.md');
      expect(claudeMd?.content).toContain('Rule 1');
      expect(claudeMd?.content).toContain('Rule 2');
    });
  });

  describe('detect()', () => {
    it('should detect project with CLAUDE.md', async () => {
      const detected = await adapter.detect(fixturesPath);
      expect(detected).toBe(true);
    });

    it('should not detect project without config files', async () => {
      const tempDir = await fs.mkdtemp('/tmp/claude-test-');
      try {
        const detected = await adapter.detect(tempDir);
        expect(detected).toBe(false);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });
  });

  describe('round-trip', () => {
    it('should maintain consistency through parse and generate', async () => {
      // Parse the fixture
      const parseResult = await adapter.parse(fixturesPath);
      expect(parseResult.success).toBe(true);

      // Generate from parsed config
      const generateResult = await adapter.generate(parseResult.data!);
      expect(generateResult.success).toBe(true);

      // Verify files were generated
      expect(generateResult.files.length).toBeGreaterThan(0);
    });
  });

  describe('@reference resolution', () => {
    it('should extract @ references from content', async () => {
      const content = `# Main

This references @other-file.md and @path/to/file.md.
`;

      const result = await adapter.parseContent(content, '/test/CLAUDE.md');

      expect(result.success).toBe(true);
      expect(result.data?.rules[0].metadata?.references).toContain('other-file.md');
      expect(result.data?.rules[0].metadata?.references).toContain('path/to/file.md');
    });

    it('should handle content without references', async () => {
      const content = `# Main

No references here.
`;

      const result = await adapter.parseContent(content, '/test/CLAUDE.md');

      expect(result.success).toBe(true);
      const refs = result.data?.rules[0].metadata?.references as string[] | undefined;
      expect(refs === undefined || refs?.length === 0).toBe(true);
    });
  });
});
