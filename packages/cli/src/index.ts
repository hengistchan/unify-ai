/**
 * unify-ai CLI
 * Command-line interface for unify-ai
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const version = packageJson.version;

import { initCommand } from './commands/init.js';
import { detectCommand } from './commands/detect.js';
import { importCommand } from './commands/import.js';
import { exportCommand } from './commands/export.js';
import { syncCommand } from './commands/sync.js';
import { diffCommand } from './commands/diff.js';
import { statusCommand } from './commands/status.js';
import { watchCommand } from './commands/watch.js';

export interface GlobalOptions {
  config?: string;
  target?: string[];
  format?: 'table' | 'json' | 'yaml' | 'silent';
  color?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
  backup?: boolean;
}

/**
 * Create and configure the CLI program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('unify-ai')
    .version(version)
    .description('Unified configuration management for AI coding assistants')
    .option('-c, --config <path>', 'Config file path')
    .option('-t, --target <tools...>', 'Target tools (comma-separated)')
    .option('-f, --format <format>', 'Output format: table, json, yaml, silent', 'table')
    .option('--no-color', 'Disable color output')
    .option('-v, --verbose', 'Verbose output')
    .option('-q, --quiet', 'Quiet mode, only show errors')
    .option('-d, --dry-run', 'Dry run, preview without executing')
    .option('--no-backup', 'Disable automatic backup');

  // Register commands
  program.addCommand(initCommand);
  program.addCommand(detectCommand);
  program.addCommand(importCommand);
  program.addCommand(exportCommand);
  program.addCommand(syncCommand);
  program.addCommand(diffCommand);
  program.addCommand(statusCommand);
  program.addCommand(watchCommand);

  return program;
}

/**
 * Run the CLI
 */
export async function run(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
