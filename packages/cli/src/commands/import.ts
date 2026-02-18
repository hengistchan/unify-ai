/**
 * import command
 * Import tool configs into unified config
 */

import { Command } from 'commander';

import { getLogger } from '../utils/logger.js';
import { ConfigManager, createConfigManager, ToolId } from '@unify-ai/core';
import { adapterRegistry } from '@unify-ai/core';

export const importCommand = new Command('import')
  .description('Import tool configs into unified config')
  .argument('[tools...]', 'Tools to import from (default: all detected)')
  .option('-m, --merge', 'Merge with existing config')
  .option('-s, --strategy <strategy>', 'Conflict strategy: skip, overwrite, merge, ask', 'ask')
  .option('--capabilities <caps...>', 'Import specific capabilities (rules, mcp_servers, settings)')
  .option('--strict', 'Strict mode - fail on any error')
  .option('--skip-hooks', 'Skip hooks')
  .action(async (tools: string[], options) => {
    const logger = getLogger({ color: options.parent?.color ?? true });

    try {
      logger.section('Importing configurations');

      const projectRoot = process.cwd();
      const configManager = createConfigManager({ projectRoot });

      // Load unified config
      let config;
      try {
        config = await configManager.load();
        if (!options.merge) {
          logger.warn('Config already exists. Use --merge to combine with existing config.');
        }
      } catch {
        // Config doesn't exist, create new
        config = configManager.createDefaultConfig();
      }

      // Determine which tools to import from
      const toolsToImport = tools.length > 0 ? tools : undefined;

      // Import from each tool
      for (const toolId of toolsToImport || []) {
        // Map string to ToolId
        const toolIdMap: Record<string, ToolId> = {
          'claude-code': ToolId.CLAUDE_CODE,
          cursor: ToolId.CURSOR,
          copilot: ToolId.COPILOT,
          windsurf: ToolId.WINDSURF,
          cline: ToolId.CLINE,
          aider: ToolId.AIDER,
          continue: ToolId.CONTINUE,
        };

        const tid = toolIdMap[toolId];
        if (!tid) {
          logger.warn(`Tool '${toolId}' not supported, skipping.`);
          continue;
        }

        const adapter = adapterRegistry.get(tid);
        if (!adapter) {
          logger.warn(`Tool '${toolId}' not supported, skipping.`);
          continue;
        }

        logger.info(`Importing from ${adapter.toolMeta.name}...`);

        const parseResult = await adapter.parse(projectRoot);

        if (!parseResult.success || !parseResult.data) {
          logger.error(`Failed to parse ${adapter.toolMeta.name} config`);
          continue;
        }

        // Merge rules
        if (parseResult.data.rules && Array.isArray(parseResult.data.rules)) {
          const existingRules = config.rules || [];
          const newRules = parseResult.data.rules;

          // Simple merge - add rules with new IDs
          for (const rule of newRules) {
            const exists = existingRules.some(r => r.id === rule.id);
            if (!exists) {
              existingRules.push(rule);
            }
          }

          config.rules = existingRules;
          logger.success(`Imported ${newRules.length} rules from ${adapter.toolMeta.name}`);
        }

        // Merge MCP servers
        if (parseResult.data.mcp?.servers) {
          const existingServers = config.mcp?.servers || [];
          const newServers = parseResult.data.mcp.servers;

          for (const server of newServers) {
            const exists = existingServers.some(s => s.name === server.name);
            if (!exists) {
              existingServers.push(server);
            }
          }

          config.mcp = { servers: existingServers };
          logger.success(`Imported ${newServers.length} MCP servers from ${adapter.toolMeta.name}`);
        }
      }

      // Save config
      await configManager.save(config);

      logger.success('Import completed!');
    } catch (error) {
      logger.error(`Failed to import: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });
