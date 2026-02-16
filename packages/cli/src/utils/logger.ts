/**
 * Logger utility
 */

import chalk from 'chalk';

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

export interface LoggerOptions {
  color?: boolean;
  verbose?: boolean;
  quiet?: boolean;
}

export class Logger {
  private color: boolean;
  private verbose: boolean;
  private quiet: boolean;

  constructor(options: LoggerOptions = {}) {
    this.color = options.color ?? true;
    this.verbose = options.verbose ?? false;
    this.quiet = options.quiet ?? false;
  }

  setColor(enabled: boolean): void {
    this.color = enabled;
  }

  setVerbose(enabled: boolean): void {
    this.verbose = enabled;
  }

  setQuiet(enabled: boolean): void {
    this.quiet = enabled;
  }

  info(message: string): void {
    if (this.quiet) return;
    console.log(this.color ? chalk.blue('ℹ') + ' ' + message : message);
  }

  warn(message: string): void {
    if (this.quiet) return;
    console.warn(this.color ? chalk.yellow('⚠') + ' ' + message : message);
  }

  error(message: string): void {
    console.error(this.color ? chalk.red('✗') + ' ' + message : message);
  }

  success(message: string): void {
    if (this.quiet) return;
    console.log(this.color ? chalk.green('✓') + ' ' + message : message);
  }

  debug(message: string): void {
    if (!this.verbose || this.quiet) return;
    console.log(this.color ? chalk.gray('[DEBUG]') + ' ' + message : '[DEBUG] ' + message);
  }

  log(message: string): void {
    if (this.quiet) return;
    console.log(message);
  }

  section(title: string): void {
    if (this.quiet) return;
    console.log();
    console.log(this.color ? chalk.bold(title) : title);
    console.log(this.color ? chalk.gray('─'.repeat(50)) : '─'.repeat(50));
  }

  subSection(title: string): void {
    if (this.quiet) return;
    console.log(this.color ? chalk.bold.cyan(title) : title);
  }

  item(message: string, status?: 'success' | 'error' | 'warn' | 'info'): void {
    if (this.quiet) return;

    const icon = status
      ? this.color
        ? status === 'success'
          ? chalk.green('✓')
          : status === 'error'
            ? chalk.red('✗')
            : status === 'warn'
              ? chalk.yellow('⚠')
              : chalk.blue('•')
        : status === 'success'
          ? '✓'
          : status === 'error'
            ? '✗'
            : status === 'warn'
              ? '⚠'
              : '•'
      : this.color
        ? chalk.gray('•')
        : '•';

    console.log(`  ${icon} ${message}`);
  }

  table(headers: string[], rows: string[][]): void {
    if (this.quiet) return;

    // Calculate column widths
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map(r => (r[i] || '').length))
    );

    // Print header
    const headerLine = headers
      .map((h, i) => (this.color ? chalk.bold(h) : h).padEnd(widths[i]))
      .join('  ');
    console.log(headerLine);
    console.log(this.color ? chalk.gray('─'.repeat(headerLine.length)) : '─'.repeat(headerLine.length));

    // Print rows
    for (const row of rows) {
      const rowLine = row
        .map((cell, i) => (cell || '').padEnd(widths[i]))
        .join('  ');
      console.log(rowLine);
    }
  }
}

// Default logger instance
let defaultLogger: Logger | null = null;

export function getLogger(options?: LoggerOptions): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger(options);
  }
  return defaultLogger;
}

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}
