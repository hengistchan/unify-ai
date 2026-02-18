/**
 * status command
 * Show current sync status
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';

import { getLogger } from '../utils/logger.js';
import { ConfigManager, createConfigManager } from '@unify-ai/core';
import { diffEngine } from '@unify-ai/core';

export const statusCommand = new Command('status')
  .description('Show current sync status')
  .option('-d, --detailed', 'Show detailed information')
  .option('--json', 'Output as JSON')
  .action(async options => {
    const logger = getLogger({ color: options.parent?.color ?? true });

    try {
      const projectRoot = process.cwd();
      const configManager = createConfigManager({ projectRoot });

      // Check if config exists
      const exists = await configManager.exists();

      if (!exists) {
        logger.warn('No unified configuration found.');
        logger.info('Run "unify init" to create one.');
        process.exit(1);
      }

      // Load config
      const config = await configManager.load();

      // Compute diffs
      const diffResults = await diffEngine.computeAllDiffs(config);

      // Build status data
      const tools = diffResults.map(diff => {
        const status = diff.entries.length === 0 ? 'Synced' : 'Modified';

        const pendingChanges = diff.summary.added + diff.summary.modified + diff.summary.removed;

        return {
          name: diff.toolName,
          id: diff.toolId,
          status,
          configPath: diff.configPath,
          pendingChanges,
        };
      });

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              config: {
                path: configManager.getConfigPath(),
                version: config.version,
                lastModified: config.lastModified,
              },
              tools,
            },
            null,
            2
          )
        );
        return;
      }

      // Display status
      logger.section('Unify-AI Status');

      logger.info(`Config: ${configManager.getConfigPath()}`);
      logger.info(`Version: ${config.version}`);
      logger.info(`Last Modified: ${config.lastModified || 'Unknown'}`);

      console.log();

      // Tools table
      const table = new Table({
        head: [
          String(chalk.cyan('Tool')),
          String(chalk.cyan('Status')),
          String(chalk.cyan('Config')),
          String(chalk.cyan('Pending Changes')),
        ],
        style: {
          head: [],
          border: [],
        },
      });

      for (const tool of tools) {
        const statusCol = tool.status;

        table.push([tool.name, statusCol, tool.configPath || '-', String(tool.pendingChanges)]);
      }

      console.log(table.toString());

      // Summary
      const totalPending = tools.reduce((sum, t) => sum + t.pendingChanges, 0);
      console.log();
      logger.info(`Total pending changes: ${totalPending}`);

      if (totalPending > 0) {
        logger.info('Run "unify sync" to synchronize');
      }
    } catch (error) {
      logger.error(`Failed to get status: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });
