import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { OpenCodeAdapter } from '../../../adapters/opencode/OpenCodeAdapter';
import type { UnifiedConfig } from '../../../core/types';
import { ConfigCapability as CC, CapabilityLevel as CL, ToolId } from '../../../core/types';

describe('OpenCodeAdapter', () => {
  let adapter: OpenCodeAdapter;
  const fixturesPath = path.join(__dirname, '../../fixtures/tools/opencode');

  beforeEach(() => {
    adapter = new OpenCodeAdapter();
  });

  describe('metadata', () => {
    it('should have correct tool metadata', () => {
      expect(adapter.toolMeta.id).toBe(ToolId.OPENCODE);
      expect(adapter.toolMeta.name).toBe('OpenCode');
      expect(adapter.toolMeta.website).toBe('https://opencode.ai');
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
        expect.objectContaining({ capability: CC.COMMANDS, level: CL.FULL })
      );
    });
  });

  describe('hasCapability()', () => {
    it('should return true for supported capabilities', () => {
      expect(adapter.hasCapability(CC.RULES)).toBe(true);
      expect(adapter.hasCapability(CC.MCP_SERVERS)).toBe(true);
      expect(adapter.hasCapability(CC.COMMANDS)).toBe(true);
    });
  });

  describe('getFilePatterns()', () => {
    it('should return correct file patterns', () => {
      const patterns = adapter.getFilePatterns();

      expect(patterns.some(p => p.pattern === 'opencode.json')).toBe(true);
      expect(patterns.some(p => p.pattern === 'opencode.jsonc')).toBe(true);
      expect(patterns.some(p => p.pattern === 'AGENTS.md')).toBe(true);
      expect(patterns.some(p => p.pattern === '.opencode/commands/*.md')).toBe(true);
    });

    it('should have all optional patterns', () => {
      const patterns = adapter.getFilePatterns();
      expect(patterns.every(p => p.type === 'optional')).toBe(true);
    });
  });

  describe('parse()', () => {
    it('should parse AGENTS.md file', async () => {
      const result = await adapter.parse(fixturesPath);

      expect(result.success).toBe(true);
      expect(result.data?.rules).toBeDefined();
      expect(result.data?.rules.length).toBeGreaterThan(0);
    });

    it('should parse rule content correctly', async () => {
      const result = await adapter.parse(fixturesPath);

      const primaryRule = result.data?.rules.find(r => r.metadata?.primary === true);
      expect(primaryRule).toBeDefined();
      expect(primaryRule?.content).toContain('Project Rules');
    });

    it('should record source files in metadata', async () => {
      const result = await adapter.parse(fixturesPath);

      expect(result.metadata?.sourceFiles).toBeDefined();
      expect(result.metadata?.sourceFiles.length).toBeGreaterThan(0);
      expect(result.metadata?.sourceFiles.some(f => f.path === 'AGENTS.md')).toBe(true);
    });

    it('should parse opencode.json with MCP config', async () => {
      const result = await adapter.parse(fixturesPath);

      expect(result.data?.mcp).toBeDefined();
      expect(result.data?.mcp?.servers).toBeDefined();
      const servers = result.data?.mcp?.servers || [];
      expect(servers.length).toBeGreaterThan(0);
    });

    it('should parse local MCP servers correctly', async () => {
      const result = await adapter.parse(fixturesPath);
      const servers = result.data?.mcp?.servers || [];

      const localServer = servers.find(s => s.name === 'filesystem');
      expect(localServer).toBeDefined();
      expect(localServer?.command).toBe('mcp-server-filesystem');
      expect(localServer?.args).toEqual(['--root', './src']);
    });

    it('should parse remote MCP servers correctly', async () => {
      const result = await adapter.parse(fixturesPath);
      const servers = result.data?.mcp?.servers || [];

      const remoteServer = servers.find(s => s.name === 'remote-server');
      expect(remoteServer).toBeDefined();
      expect(remoteServer?.metadata?.type).toBe('remote');
      expect(remoteServer?.metadata?.url).toBe('https://api.example.com/mcp');
    });

    it('should parse instructions from config', async () => {
      const result = await adapter.parse(fixturesPath);

      const customRule = result.data?.rules.find(
        r => r.metadata?.path === '.opencode/rules/custom.md' || r.id.includes('custom')
      );
      expect(customRule).toBeDefined();
      expect(customRule?.content).toContain('Custom Rules');
    });

    it('should parse commands from JSON config', async () => {
      const result = await adapter.parse(fixturesPath);
      const commands = result.data?.commands || [];

      const checkCmd = commands.find(c => c.name === 'check');
      expect(checkCmd).toBeDefined();
      expect(checkCmd?.description).toBe('Check code quality');
    });

    it('should parse commands from .opencode/commands directory', async () => {
      const result = await adapter.parse(fixturesPath);
      const commands = result.data?.commands || [];

      const testCmd = commands.find(c => c.name === 'test');
      expect(testCmd).toBeDefined();
      expect(testCmd?.description).toBe('Run all tests');
      expect(testCmd?.template).toContain('pnpm test');
    });

    it('should handle project without config files', async () => {
      const tempDir = await fs.mkdtemp('/tmp/opencode-test-');
      try {
        const result = await adapter.parse(tempDir);

        expect(result.success).toBe(true);
        expect(result.data?.rules).toEqual([]);
      } finally {
        await fs.rm(tempDir, { recursive: true });
      }
    });
  });

  describe('generate()', () => {
    it('should generate AGENTS.md from primary rule', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [
          {
            id: 'primary',
            name: 'AGENTS',
            content: '# Main Rules\n\nGuidelines here.',
            metadata: { primary: true },
          },
        ],
      };

      const result = await adapter.generate(config);

      expect(result.success).toBe(true);
      expect(result.files.some(f => f.path === 'AGENTS.md')).toBe(true);

      const agentsMd = result.files.find(f => f.path === 'AGENTS.md');
      expect(agentsMd?.content).toContain('Main Rules');
    });

    it('should generate rules to .opencode/rules/ directory', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [
          {
            id: 'rule1',
            name: 'Custom Rule',
            content: '# Custom Rule\n\nContent here.',
          },
        ],
      };

      const result = await adapter.generate(config);

      const ruleFile = result.files.find(f => f.path.startsWith('.opencode/rules/'));
      expect(ruleFile).toBeDefined();
      expect(ruleFile?.content).toContain('Custom Rule');
    });

    it('should generate opencode.json with MCP servers', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
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

      expect(result.files.some(f => f.path === 'opencode.json')).toBe(true);

      const configFile = result.files.find(f => f.path === 'opencode.json');
      const configContent = JSON.parse(configFile?.content as string);
      expect(configContent.mcp.filesystem).toBeDefined();
      expect(configContent.mcp.filesystem.type).toBe('local');
    });

    it('should generate remote MCP servers correctly', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [],
        mcp: {
          servers: [
            {
              name: 'remote-api',
              command: '',
              metadata: {
                type: 'remote',
                url: 'https://api.example.com/mcp',
                headers: { Authorization: 'Bearer token' },
              },
            },
          ],
        },
      };

      const result = await adapter.generate(config);

      const configFile = result.files.find(f => f.path === 'opencode.json');
      const configContent = JSON.parse(configFile?.content as string);
      expect(configContent.mcp['remote-api'].type).toBe('remote');
      expect(configContent.mcp['remote-api'].url).toBe('https://api.example.com/mcp');
    });

    it('should generate commands to .opencode/commands/ directory', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [],
        commands: [
          {
            id: 'cmd-test',
            name: 'test',
            description: 'Run tests',
            template: 'pnpm test',
            metadata: { agent: 'general', subtask: true },
          },
        ],
      };

      const result = await adapter.generate(config);

      expect(result.files.some(f => f.path === '.opencode/commands/test.md')).toBe(true);

      const cmdFile = result.files.find(f => f.path === '.opencode/commands/test.md');
      expect(cmdFile?.content).toContain('description: Run tests');
      expect(cmdFile?.content).toContain('agent: general');
      expect(cmdFile?.content).toContain('pnpm test');
    });

    it('should include instructions in opencode.json for rule files', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [
          {
            id: 'rule1',
            name: 'Extra Rule',
            content: 'Extra content',
          },
        ],
      };

      const result = await adapter.generate(config);

      const configFile = result.files.find(f => f.path === 'opencode.json');
      const configContent = JSON.parse(configFile?.content as string);
      expect(configContent.instructions).toContain('.opencode/rules/Extra_Rule.md');
    });

    it('should not generate files for empty config', async () => {
      const config: UnifiedConfig = {
        version: '1.0',
        rules: [],
      };

      const result = await adapter.generate(config);

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(0);
    });
  });

  describe('detect()', () => {
    it('should detect project with AGENTS.md', async () => {
      const detected = await adapter.detect(fixturesPath);
      expect(detected).toBe(true);
    });

    it('should not detect project without config files', async () => {
      const tempDir = await fs.mkdtemp('/tmp/opencode-test-');
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
      const parseResult = await adapter.parse(fixturesPath);
      expect(parseResult.success).toBe(true);

      const generateResult = await adapter.generate(parseResult.data!);
      expect(generateResult.success).toBe(true);

      expect(generateResult.files.length).toBeGreaterThan(0);
    });
  });
});
