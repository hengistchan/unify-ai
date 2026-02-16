/**
 * detect command
 * Detect AI tools in the project
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';

import { getLogger } from '../utils/logger.js';
import { fileDiscovery, type IAdapter } from '@unify-ai/core';

export const detectCommand = new Command('detect')
  .description('Detect AI tools in the project')
  .option('-j, --json', 'Output as JSON')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options) => {
    const logger = getLogger({ color: options.parent?.color ?? true });

    try {
      const projectRoot = process.cwd();
      logger.info('Detecting AI tools...');

      const detectedTools = await fileDiscovery.detectTools(projectRoot);

      if (options.json) {
        const output = detectedTools.map(adapter => ({
          name: adapter.toolMeta.name,
          id: adapter.toolMeta.id,
          version: adapter.version,
          capabilities: adapter.getCapabilities(),
          configFiles: adapter.getFilePatterns().map(p => p.pattern),
        }));
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      if (detectedTools.length === 0) {
        logger.warn('No AI tool configurations found.');
        logger.info('Supported tools: Claude Code, Cursor, Copilot, Windsurf, Cline, Aider, Continue');
        return;
      }

      logger.success(`Found ${detectedTools.length} tool(s)`);
      console.log();

      if (options.verbose) {
        // Detailed table
        const table = new Table({
          head: [String(chalk.cyan('Tool')), String(chalk.cyan('ID')), String(chalk.cyan('Version')), String(chalk.cyan('Config Files')), String(chalk.cyan('Capabilities'))],
          style: {
            head: [],
            border: [],
          },
        });

        for (const adapter of detectedTools) {
          const capabilities = adapter.getCapabilities()
            .map(c => `${c.capability} (${c.level})`)
            .join(', ');

          table.push([
            adapter.toolMeta.name,
            adapter.toolMeta.id,
            adapter.version,
            adapter.getFilePatterns().map(p => p.pattern).join(', '),
            capabilities,
          ]);
        }

        console.log(table.toString());
      } else {
        // Simple list
        for (const adapter of detectedTools) {
          const icon = chalk.green('✓');
          console.log(`  ${icon} ${adapter.toolMeta.name} (${adapter.toolMeta.id})`);
        }
      }
    } catch (error) {
      logger.error(`Failed to detect tools: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });
