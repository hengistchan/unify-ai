/**
 * diff command
 * Show differences between unified and tool configs
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';

import { getLogger } from '../utils/logger.js';
import { ConfigManager, createConfigManager } from '@unify-ai/core';
import { diffEngine, DiffType } from '@unify-ai/core';

export const diffCommand = new Command('diff')
  .description('Show differences between unified and tool configs')
  .argument('[tool]', 'Specific tool to compare')
  .option('-f, --format <format>', 'Output format: table, json, unified', 'table')
  .option('--color', 'Color output', true)
  .option('-C, --context <lines>', 'Context lines', '3')
  .option('--show-unchanged', 'Show unchanged items')
  .action(async (tool: string | undefined, options) => {
    const logger = getLogger({ color: options.parent?.color ?? true });

    try {
      const projectRoot = process.cwd();
      const configManager = createConfigManager({ projectRoot });

      // Load unified config
      const config = await configManager.load();

      // Compute diffs
      const diffResults = await diffEngine.computeAllDiffs(config, tool);

      // Filter results
      const filteredResults = tool
        ? diffResults.filter(r => r.toolId === tool)
        : diffResults;

      if (options.format === 'json') {
        console.log(JSON.stringify(filteredResults, null, 2));
        return;
      }

      // Display results
      for (const diff of filteredResults) {
        logger.section(`${diff.toolName} vs Unified`);

        if (diff.entries.length === 0) {
          logger.info('No differences found.');
          continue;
        }

        if (options.format === 'unified') {
          // Unified diff format
          console.log(chalk.gray(`--- unified.json`));
          console.log(chalk.gray(`+++ ${diff.configPath}`));

          for (const entry of diff.entries) {
            const prefix = entry.type === DiffType.ADDED ? '+' : entry.type === DiffType.REMOVED ? '-' : '~';
            console.log(`${prefix} ${entry.path}: ${JSON.stringify(entry.toolValue || entry.unifiedValue)}`);
          }
        } else {
          // Table format
          const table = new Table({
            head: [String(chalk.cyan('Path')), String(chalk.cyan('Type')), String(chalk.cyan('Unified')), String(chalk.cyan('Tool'))],
            style: {
              head: [],
              border: [],
            },
          });

          for (const entry of diff.entries) {
            const typeCol = entry.type;

            table.push([
              entry.path,
              typeCol,
              entry.unifiedValue ? JSON.stringify(entry.unifiedValue) : '-',
              entry.toolValue ? JSON.stringify(entry.toolValue) : '-',
            ]);
          }

          console.log(table.toString());

          // Summary
          console.log();
          logger.info(`Added: ${diff.summary.added}`);
          logger.info(`Modified: ${diff.summary.modified}`);
          logger.info(`Removed: ${diff.summary.removed}`);

          if (diff.hasConflicts) {
            logger.warn(`Conflicts: ${diff.summary.conflicts}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to compute diff: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });
