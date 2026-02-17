/**
 * watch command
 * Watch for config file changes and auto-sync
 */

import { Command } from 'commander';
import chokidar from 'chokidar';
import debounce from 'lodash.debounce';

import { getLogger } from '../utils/logger.js';
import { ConfigManager, createConfigManager, UnifiedConfig, ToolId } from '@unify-ai/core';
import { diffEngine, exporter, importer, adapterRegistry } from '@unify-ai/core';
import { ChangeTracker, getChangeTracker, FingerprintManager } from '@unify-ai/core';

// Sync modes
type SyncMode = 'one-way-export' | 'one-way-import' | 'two-way-auto';

// Resolution strategies
type ResolutionStrategy = 'unified-wins' | 'tool-wins' | 'latest' | 'merge';

interface WatchOptions {
  debounce: string;
  mode: SyncMode;
  strategy: ResolutionStrategy;
  poll: boolean;
  ignore: string[];
  backup: boolean;
}

// Tool config file patterns
const TOOL_CONFIG_PATTERNS: Record<string, string[]> = {
  'claude-code': ['CLAUDE.md', '.claude/**/*'],
  'cursor': ['.cursorrules', '.cursor/**/*'],
  'copilot': ['.github/copilot-instructions.md'],
  'windsurf': ['.windsurfrules', '.windsurf/**/*'],
  'codex': ['CODEX.md', 'codex.toml'],
  'cline': ['.clinerules', '.cline/**/*'],
  'aider': ['.aider.conf.yml', 'aider.conf.yml'],
  'continue': ['.continue/config.json', 'continue.json'],
};

export const watchCommand = new Command('watch')
  .description('Watch for config file changes and auto-sync')
  .option('-d, --debounce <ms>', 'Debounce delay', '1000')
  .option('-m, --mode <mode>', 'Sync mode: one-way-export, one-way-import, two-way-auto', 'two-way-auto')
  .option('-s, --strategy <strategy>', 'Conflict strategy: unified-wins, tool-wins, latest, merge', 'latest')
  .option('--poll', 'Use polling mode (for network filesystems)')
  .option('--ignore <patterns...>', 'Ignore patterns')
  .option('-b, --backup', 'Create backup on sync', false)
  .action(async (options) => {
    const logger = getLogger({ color: options.parent?.color ?? true });

    try {
      logger.section('Starting file watcher');

      const projectRoot = process.cwd();
      const configManager = createConfigManager({ projectRoot });

      // Check if config exists
      const exists = await configManager.exists();
      if (!exists) {
        logger.error('No unified configuration found. Run "unify-ai init" first.');
        process.exit(1);
      }

      // Load config
      const config = await configManager.load();

      // Initialize change tracker
      const changeTracker = getChangeTracker(projectRoot);
      await changeTracker.load();

      // Build watch paths
      const watchPaths = [
        configManager.getConfigPath(), // unified.json
        ...Object.values(TOOL_CONFIG_PATTERNS).flat(),
      ];

      logger.info(`Watching: ${projectRoot}`);
      logger.info(`Mode: ${options.mode}`);
      logger.info(`Strategy: ${options.strategy}`);
      logger.info(`Debounce: ${options.debounce}ms`);

      // Create debounced sync function
      const debouncedSync = debounce(
        async (event: string, path: string) => {
          await handleFileChange(event, path, config, configManager, changeTracker, options, logger);
        },
        parseInt(options.debounce, 10)
      );

      // Initialize watcher
      const watcher = chokidar.watch(watchPaths, {
        cwd: projectRoot,
        ignored: [
          /(^|[\/\\])\../, // ignore dotfiles
          'node_modules/**',
          '.git/**',
          ...(options.ignore || []),
        ],
        persistent: true,
        usePolling: options.poll,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      // Event handlers
      watcher
        .on('add', (path) => debouncedSync('add', path))
        .on('change', (path) => debouncedSync('change', path))
        .on('unlink', (path) => debouncedSync('unlink', path))
        .on('error', (error) => logger.error(`Watcher error: ${error}`))
        .on('ready', () => {
          console.log();
          logger.success('Ready! Watching for file changes.');
          logger.info('Press Ctrl+C to stop.');
          console.log();
        });

      // Handle shutdown
      process.on('SIGINT', async () => {
        console.log();
        logger.info('Stopping watcher...');
        await watcher.close();
        await changeTracker.save();
        logger.success('Watcher stopped.');
        process.exit(0);
      });

    } catch (error) {
      logger.error(`Failed to start watcher: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

/**
 * Handle file change event
 */
async function handleFileChange(
  event: string,
  filePath: string,
  config: UnifiedConfig,
  configManager: ConfigManager,
  changeTracker: ChangeTracker,
  options: WatchOptions,
  logger: ReturnType<typeof getLogger>
): Promise<void> {
  const configPath = configManager.getConfigPath();
  const isUnifiedConfig = filePath === configPath || filePath.endsWith('unified.json');

  logger.info(`File ${event}: ${filePath}`);

  try {
    if (isUnifiedConfig) {
      // Unified config changed
      if (options.mode === 'one-way-export' || options.mode === 'two-way-auto') {
        await syncFromUnified(config, configManager, changeTracker, options, logger);
      }
    } else {
      // Tool config changed
      if (options.mode === 'one-way-import' || options.mode === 'two-way-auto') {
        await syncFromTool(filePath, config, configManager, changeTracker, options, logger);
      }
    }
  } catch (error) {
    logger.error(`Sync error: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Sync changes from unified config to tools
 */
async function syncFromUnified(
  config: UnifiedConfig,
  configManager: ConfigManager,
  changeTracker: ChangeTracker,
  options: WatchOptions,
  logger: ReturnType<typeof getLogger>
): Promise<void> {
  // Reload config
  const newConfig = await configManager.load();

  logger.info('Syncing from unified config to tools...');

  // Create backup if requested
  if (options.backup) {
    await configManager.backup();
  }

  // Export to all tools
  const tools = Object.keys(TOOL_CONFIG_PATTERNS);

  for (const toolId of tools) {
    try {
      const result = await exporter.export(newConfig, process.cwd(), {
        targetTool: toolId as ToolId,
        overwrite: true,
      });

      if (result.success) {
        logger.item(`${toolId}: synced`, 'success');
      }
    } catch {
      // Tool may not be configured, skip silently
    }
  }

  // Record change
  await changeTracker.recordChange({
    type: 'export',
    path: configManager.getConfigPath(),
    source: { type: 'user', confidence: 1.0 },
  });

  await changeTracker.save();
  logger.success('Sync completed');
}

/**
 * Sync changes from tool config to unified
 */
async function syncFromTool(
  filePath: string,
  config: UnifiedConfig,
  configManager: ConfigManager,
  changeTracker: ChangeTracker,
  options: WatchOptions,
  logger: ReturnType<typeof getLogger>
): Promise<void> {
  // Determine which tool changed
  const toolId = detectToolFromPath(filePath);
  if (!toolId) {
    return;
  }

  logger.info(`Detected change in ${toolId} config...`);

  // Import from tool
  try {
    const result = await importer.import(process.cwd(), {
      sourceTool: toolId as ToolId,
      mergeMultiple: false,
    });

    if (result.success && result.config) {
      // Save updated config
      await configManager.save(result.config);

      // Record change
      await changeTracker.recordChange({
        type: 'import',
        path: filePath,
        source: { type: 'user', confidence: 0.9 },
        toolId,
      });

      await changeTracker.save();
      logger.success(`Imported changes from ${toolId}`);

      // If two-way mode, also export to other tools
      if (options.mode === 'two-way-auto') {
        await syncFromUnified(result.config, configManager, changeTracker, options, logger);
      }
    }
  } catch (error) {
    logger.error(`Failed to import from ${toolId}: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Detect tool ID from file path
 */
function detectToolFromPath(filePath: string): string | null {
  for (const [toolId, patterns] of Object.entries(TOOL_CONFIG_PATTERNS)) {
    for (const pattern of patterns) {
      // Simple pattern matching
      const basePattern = pattern.replace('/**/*', '').replace('/*', '');
      if (filePath.includes(basePattern)) {
        return toolId;
      }
    }
  }
  return null;
}
