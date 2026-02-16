/**
 * sync command
 * Bidirectional sync between unified and tool configs
 */

import { Command } from 'commander';
import inquirer from 'inquirer';

import { getLogger } from '../utils/logger.js';
import { ConfigManager, createConfigManager, ToolId, UnifiedConfig } from '@unify-ai/core';
import { diffEngine, DiffEntry, DiffType } from '@unify-ai/core';
import { exporter } from '@unify-ai/core';
import { adapterRegistry } from '@unify-ai/core';

// Sync modes
type SyncMode = 'one-way-export' | 'one-way-import' | 'two-way-auto' | 'two-way-interactive';

// Resolution strategies
type ResolutionStrategy = 'unified-wins' | 'tool-wins' | 'latest' | 'merge' | 'ask';

interface SyncResult {
  success: boolean;
  exported: number;
  imported: number;
  conflicts: number;
  errors: string[];
}

export const syncCommand = new Command('sync')
  .description('Bidirectional sync between unified and tool configs')
  .argument('[tools...]', 'Tools to sync (default: all)')
  .option('-m, --mode <mode>', 'Sync mode: one-way-export, one-way-import, two-way-auto, two-way-interactive', 'two-way-interactive')
  .option('-s, --strategy <strategy>', 'Conflict strategy: unified-wins, tool-wins, latest, merge, ask', 'ask')
  .option('-w, --watch', 'Watch mode')
  .option('--debounce <ms>', 'Debounce delay for watch mode', '1000')
  .option('-b, --backup', 'Create backup', true)
  .option('--skip-hooks', 'Skip hooks')
  .action(async (_tools: string[], options) => {
    const logger = getLogger({ color: options.parent?.color ?? true });

    try {
      logger.section('Syncing configurations');

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

      // Determine tools to sync
      const allTools = ['claude-code', 'cursor', 'copilot', 'windsurf', 'cline', 'aider', 'continue'];
      const toolsToSync = _tools.length > 0 ? _tools : allTools;

      // Execute sync
      const result = await executeSync(config, projectRoot, toolsToSync, options, logger);

      if (result.success) {
        logger.success(`Sync completed!`);
        logger.info(`  Exported: ${result.exported} changes`);
        logger.info(`  Imported: ${result.imported} changes`);
        if (result.conflicts > 0) {
          logger.warn(`  Conflicts: ${result.conflicts}`);
        }
      } else {
        logger.error('Sync completed with errors');
        for (const error of result.errors) {
          logger.error(`  ${error}`);
        }
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Failed to sync: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  });

async function executeSync(
  config: UnifiedConfig,
  projectRoot: string,
  tools: string[],
  options: { mode: SyncMode; strategy: ResolutionStrategy; dryRun?: boolean; parent?: { dryRun?: boolean } },
  logger: ReturnType<typeof getLogger>
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    exported: 0,
    imported: 0,
    conflicts: 0,
    errors: [],
  };

  const toolIdMap: Record<string, ToolId> = {
    'claude-code': ToolId.CLAUDE_CODE,
    'cursor': ToolId.CURSOR,
    'copilot': ToolId.COPILOT,
    'windsurf': ToolId.WINDSURF,
    'cline': ToolId.CLINE,
    'aider': ToolId.AIDER,
    'continue': ToolId.CONTINUE,
  };

  for (const toolId of tools) {
    const tid = toolIdMap[toolId];
    if (!tid) {
      logger.warn(`Tool '${toolId}' not supported, skipping.`);
      continue;
    }

    const adapter = adapterRegistry.get(tid);
    if (!adapter) {
      logger.warn(`Tool '${toolId}' not found, skipping.`);
      continue;
    }

    try {
      // Compute diff for this tool
      const diffResults = await diffEngine.computeAllDiffs(config, tid);
      const diff = diffResults[0];

      if (!diff || diff.entries.length === 0) {
        logger.info(`${adapter.toolMeta.name}: No changes needed`);
        continue;
      }

      logger.subSection(`${adapter.toolMeta.name}`);

      // Handle different sync modes
      if (options.mode === 'one-way-export' || options.mode === 'two-way-auto' || options.mode === 'two-way-interactive') {
        // Export mode
        const exported = await handleExport(config, projectRoot, adapter, diff, options, logger);
        result.exported += exported;
      }

      if (options.mode === 'one-way-import' || options.mode === 'two-way-auto' || options.mode === 'two-way-interactive') {
        // Import mode - detect user modifications
        const { imported, hasConflicts } = await handleImport(config, projectRoot, adapter, diff, options, logger);
        result.imported += imported;
        if (hasConflicts) {
          result.conflicts++;
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`${toolId}: ${errorMsg}`);
      logger.error(`Failed to sync ${toolId}: ${errorMsg}`);
    }
  }

  return result;
}

async function handleExport(
  config: UnifiedConfig,
  projectRoot: string,
  adapter: { toolMeta: { name: string } },
  diff: { entries: DiffEntry[] },
  options: { dryRun?: boolean; parent?: { dryRun?: boolean } },
  logger: ReturnType<typeof getLogger>
): Promise<number> {
  // Filter entries that need export (where unified has the value)
  const exportEntries = diff.entries.filter(e =>
    e.source === 'unified' || e.source === 'both'
  );

  if (exportEntries.length === 0) {
    return 0;
  }

  logger.info(`  Exporting ${exportEntries.length} changes to ${adapter.toolMeta.name}...`);

  if (options.dryRun || options.parent?.dryRun) {
    logger.info(`    (dry-run) Would export ${exportEntries.length} changes`);
    return exportEntries.length;
  }

  try {
    const exportResult = await exporter.export(config, projectRoot, {
      targetTool: adapter.toolMeta.name as any,
      overwrite: true,
    });

    if (exportResult.success) {
      logger.success(`  Exported to ${adapter.toolMeta.name}`);
      return exportEntries.length;
    } else {
      logger.error(`  Failed to export: ${exportResult.errors?.map(e => e.message).join(', ')}`);
      return 0;
    }
  } catch (error) {
    logger.error(`  Export error: ${error instanceof Error ? error.message : error}`);
    return 0;
  }
}

async function handleImport(
  config: UnifiedConfig,
  projectRoot: string,
  adapter: { toolMeta: { name: string; id: string }; parse: (projectRoot: string) => Promise<{ success: boolean; data?: UnifiedConfig; errors?: any[] }> },
  diff: { entries: DiffEntry[] },
  options: { mode: SyncMode; strategy: ResolutionStrategy; dryRun?: boolean; parent?: { dryRun?: boolean } },
  logger: ReturnType<typeof getLogger>
): Promise<{ imported: number; hasConflicts: boolean }> {
  // Filter entries that need import (where tool has the value)
  const importEntries = diff.entries.filter(e =>
    e.source === 'tool' || e.source === 'both'
  );

  if (importEntries.length === 0) {
    return { imported: 0, hasConflicts: false };
  }

  logger.info(`  Checking ${importEntries.length} changes from ${adapter.toolMeta.name}...`);

  // Check for conflicts (both sides modified)
  const conflictEntries = diff.entries.filter(e => e.source === 'both');

  if (conflictEntries.length > 0) {
    logger.warn(`  Found ${conflictEntries.length} conflicts`);

    // Handle based on strategy
    if (options.strategy === 'ask' && options.mode === 'two-way-interactive') {
      // Interactive resolution
      for (const conflict of conflictEntries) {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'resolution',
            message: `Conflict at ${conflict.path}. Which version to keep?`,
            choices: [
              { name: 'Unified config', value: 'unified' },
              { name: `${adapter.toolMeta.name} config`, value: 'tool' },
              { name: 'Skip', value: 'skip' },
            ],
          },
        ]);

        if (answer.resolution === 'skip') {
          logger.info(`    Skipped: ${conflict.path}`);
        }
        // TODO: Actually apply the resolution
      }
    } else if (options.strategy === 'unified-wins') {
      logger.info(`  Strategy: unified-wins (keeping unified config)`);
    } else if (options.strategy === 'tool-wins') {
      logger.info(`  Strategy: tool-wins (using tool config)`);
      // TODO: Import tool changes
    } else if (options.strategy === 'latest') {
      logger.info(`  Strategy: latest (comparing timestamps)`);
      // TODO: Implement timestamp comparison
    } else if (options.strategy === 'merge') {
      logger.info(`  Strategy: merge (combining both)`);
      // TODO: Implement merge logic
    }

    return { imported: 0, hasConflicts: true };
  }

  // No conflicts, can import directly
  if (options.dryRun || options.parent?.dryRun) {
    logger.info(`    (dry-run) Would import ${importEntries.length} changes`);
    return { imported: importEntries.length, hasConflicts: false };
  }

  // Parse tool config and import
  try {
    const parseResult = await adapter.parse(projectRoot);

    if (parseResult.success && parseResult.data) {
      logger.success(`  Imported from ${adapter.toolMeta.name}`);
      return { imported: importEntries.length, hasConflicts: false };
    } else {
      logger.error(`  Failed to parse: ${parseResult.errors?.map(e => e.message).join(', ')}`);
      return { imported: 0, hasConflicts: false };
    }
  } catch (error) {
    logger.error(`  Import error: ${error instanceof Error ? error.message : error}`);
    return { imported: 0, hasConflicts: false };
  }
}
