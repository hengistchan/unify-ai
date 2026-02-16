/**
 * export command
 * Export unified config to tool configs
 */

import { Command } from 'commander';

import { getLogger } from '../utils/logger.js';
import { ConfigManager, createConfigManager, ToolId } from '@unify-ai/core';
import { exporter } from '@unify-ai/core';

export const exportCommand = new Command('export')
  .description('Export unified config to tool configs')
  .argument('[tools...]', 'Tools to export to (default: all)')
  .option('-b, --backup', 'Backup existing configs', true)
  .option('--backup-dir <path>', 'Backup directory', '.unify/backup')
  .option('-o, --overwrite', 'Overwrite existing files', true)
  .option('--capabilities <caps...>', 'Export specific capabilities')
  .option('--skip-hooks', 'Skip hooks')
  .action(async (tools: string[], options) => {
    const logger = getLogger({ color: options.parent?.color ?? true });

    try {
      logger.section('Exporting configurations');

      const projectRoot = process.cwd();
      const configManager = createConfigManager({ projectRoot });

      // Load unified config
      const config = await configManager.load();

      // Create backup if requested
      if (options.backup) {
        logger.info('Creating backup...');
        const backup = await configManager.backup();
        logger.success(`Backup created: ${backup.path}`);
      }

      // Export to each tool
      logger.info('Exporting to tools...');

      const targets = tools.length > 0 ? tools : ['claude-code', 'cursor', 'copilot', 'windsurf', 'cline', 'aider', 'continue'];

      for (const toolId of targets) {
        // Map string to ToolId
        const toolIdMap: Record<string, ToolId> = {
          'claude-code': ToolId.CLAUDE_CODE,
          'cursor': ToolId.CURSOR,
          'copilot': ToolId.COPILOT,
          'windsurf': ToolId.WINDSURF,
          'cline': ToolId.CLINE,
          'aider': ToolId.AIDER,
          'continue': ToolId.CONTINUE,
        };

        const tid = toolIdMap[toolId];
        if (!tid) {
          logger.warn(`Tool '${toolId}' not supported, skipping.`);
          continue;
        }

        try {
          const result = await exporter.export(config, projectRoot, {
            targetTool: tid,
            overwrite: options.overwrite,
            dryRun: options.parent?.dryRun,
          });

          if (result.success && result.files) {
            logger.success(`Exported to ${toolId}`);
            for (const file of result.files) {
              logger.item(`${file.path}`, 'success');
            }
          } else if (result.errors) {
            logger.error(`Failed to export to ${toolId}`);
            for (const error of result.errors) {
              logger.error(`  ${error.message}`);
            }
          }
        } catch (error) {
          logger.error(`Failed to export to ${toolId}: ${error instanceof Error ? error.message : error}`);
        }
      }

      logger.success('Export completed!');
    } catch (error) {
      logger.error(`Failed to export: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });
