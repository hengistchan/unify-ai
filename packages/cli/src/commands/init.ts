/**
 * init command
 * Initialize unified.json configuration
 */

import { Command } from 'commander';
import inquirer from 'inquirer';

import { getLogger } from '../utils/logger.js';
import { ConfigManager, createConfigManager, ToolId } from '@unify-ai/core';
import { fileDiscovery } from '@unify-ai/core';
import { adapterRegistry } from '@unify-ai/core';

// Simple answers type
interface InquirerAnswers {
  [key: string]: string | boolean | string[];
}

export const initCommand = new Command('init')
  .description('Initialize unified.json configuration')
  .option('-f, --from <tool>', 'Import from existing tool config')
  .option('-i, --interactive', 'Interactive mode')
  .option('--force', 'Overwrite existing config')
  .option('--skip-hooks', 'Skip hooks')
  .action(async options => {
    const logger = getLogger({ color: options.parent?.color ?? true });

    try {
      logger.section('Initializing unify-ai');

      const projectRoot = process.cwd();
      const configManager = createConfigManager({ projectRoot });

      // Check if config already exists
      const exists = await configManager.exists();
      if (exists && !options.force) {
        logger.error('Config file already exists. Use --force to overwrite.');
        process.exit(1);
      }

      if (options.interactive) {
        await runInteractiveInit(options, logger, configManager);
      } else if (options.from) {
        await runFromToolInit(options, logger, configManager);
      } else {
        await runDefaultInit(logger, configManager);
      }

      logger.success('Configuration initialized successfully!');
    } catch (error) {
      logger.error(`Failed to initialize: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

async function runInteractiveInit(
  options: { from?: string },
  logger: ReturnType<typeof getLogger>,
  configManager: ConfigManager
): Promise<void> {
  const answers = await inquirer.prompt<InquirerAnswers>([
    {
      type: 'input',
      name: 'configPath',
      message: 'Where do you want to create the config?',
      default: './unified.json',
    },
    {
      type: 'checkbox',
      name: 'tools',
      message: 'Which AI tools are you using?',
      choices: [
        { name: 'Claude Code', value: 'claude-code', checked: true },
        { name: 'Cursor', value: 'cursor', checked: true },
        { name: 'GitHub Copilot', value: 'copilot' },
        { name: 'Windsurf', value: 'windsurf' },
        { name: 'Cline', value: 'cline' },
        { name: 'Aider', value: 'aider' },
        { name: 'OpenCode', value: 'opencode' },
      ],
    },
    {
      type: 'confirm',
      name: 'importExisting',
      message: 'Do you want to import existing configurations?',
      default: true,
    },
  ]);

  // Detect existing configurations
  if (answers.importExisting) {
    logger.info('Detecting existing configurations...');
    const detected = await fileDiscovery.detectTools(process.cwd());

    if (detected.length > 0) {
      logger.success(`Found ${detected.length} tool configuration(s)`);
      for (const tool of detected) {
        logger.item(`${tool.toolMeta.name} (${tool.toolMeta.id})`, 'info');
      }
    }
  }

  // Create config
  const config = configManager.createDefaultConfig();
  await configManager.save(config);
}

async function runFromToolInit(
  options: { from: string },
  logger: ReturnType<typeof getLogger>,
  configManager: ConfigManager
): Promise<void> {
  // Map string to ToolId
  const toolIdMap: Record<string, ToolId> = {
    'claude-code': ToolId.CLAUDE_CODE,
    cursor: ToolId.CURSOR,
    copilot: ToolId.COPILOT,
    windsurf: ToolId.WINDSURF,
    cline: ToolId.CLINE,
    aider: ToolId.AIDER,
    opencode: ToolId.OPENCODE,
  };

  const toolId = toolIdMap[options.from];
  if (!toolId) {
    logger.error(`Tool '${options.from}' is not supported.`);
    logger.info('Supported tools: claude-code, cursor, copilot, windsurf, cline, aider, opencode');
    process.exit(1);
  }

  const adapter = adapterRegistry.get(toolId);

  if (!adapter) {
    logger.error(`Tool '${options.from}' is not supported.`);
    logger.info('Supported tools: claude-code, cursor, copilot, windsurf, cline, aider, opencode');
    process.exit(1);
  }

  logger.info(`Importing configuration from ${adapter.toolMeta.name}...`);

  // Import from tool
  const parseResult = await adapter.parse(process.cwd());

  if (!parseResult.success || !parseResult.data) {
    logger.error(`Failed to parse ${adapter.toolMeta.name} configuration`);
    if (parseResult.errors) {
      for (const error of parseResult.errors) {
        logger.error(`  ${error.message}`);
      }
    }
    process.exit(1);
  }

  // Save as unified config
  const config = configManager.createDefaultConfig();
  Object.assign(config, parseResult.data);
  await configManager.save(config);

  logger.success(`Imported from ${adapter.toolMeta.name}`);
}

async function runDefaultInit(
  logger: ReturnType<typeof getLogger>,
  configManager: ConfigManager
): Promise<void> {
  logger.info('Creating default configuration...');

  const config = configManager.createDefaultConfig();
  await configManager.save(config);

  logger.success('Created unified.json');
}
