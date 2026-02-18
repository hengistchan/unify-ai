/**
 * Output formatter
 */

import chalk from 'chalk';
import Table from 'cli-table3';

export type OutputFormat = 'table' | 'json' | 'yaml' | 'silent';

export interface OutputOptions {
  format?: OutputFormat;
  color?: boolean;
}

/**
 * Base output formatter
 */
export abstract class OutputFormatter {
  protected format: OutputFormat;
  protected color: boolean;

  constructor(options: OutputOptions = {}) {
    this.format = options.format ?? 'table';
    this.color = options.color ?? true;
  }

  abstract print(data: unknown): void;

  setFormat(format: OutputFormat): void {
    this.format = format;
  }

  setColor(enabled: boolean): void {
    this.color = enabled;
  }
}

/**
 * Table output formatter
 */
export class TableFormatter extends OutputFormatter {
  print(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }

  printTable(headers: string[], rows: string[][]): void {
    const table = new Table({
      head: headers.map(h => (this.color ? String(chalk.cyan(h)) : h)),
      style: {
        head: [],
        border: [],
      },
    });

    table.push(...rows);
    console.log(table.toString());
  }

  printStatus(title: string, items: { name: string; status: string; details?: string }[]): void {
    console.log();
    console.log(this.color ? chalk.bold(title) : title);
    console.log(this.color ? chalk.gray('─'.repeat(50)) : '─'.repeat(50));

    const table = new Table({
      head: ['Tool', 'Status', 'Details'],
      style: {
        head: [this.color ? String(chalk.cyan) : ''],
        border: [],
      },
    });

    for (const item of items) {
      let statusCol = item.status;
      if (this.color) {
        if (item.status.includes('Synced') || item.status.includes('✓')) {
          statusCol = String(chalk.green(item.status));
        } else if (item.status.includes('Modified') || item.status.includes('⚠')) {
          statusCol = String(chalk.yellow(item.status));
        } else if (item.status.includes('Error') || item.status.includes('✗')) {
          statusCol = String(chalk.red(item.status));
        }
      }

      table.push([item.name, statusCol, item.details || '']);
    }

    console.log(table.toString());
  }
}

/**
 * JSON output formatter
 */
export class JsonFormatter extends OutputFormatter {
  print(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * YAML output formatter
 */
export class YamlFormatter extends OutputFormatter {
  print(data: unknown): void {
    // Simple YAML conversion for flat objects
    if (typeof data === 'object' && data !== null) {
      const lines = this.toYaml(data, 0);
      console.log(lines);
    } else {
      console.log(String(data));
    }
  }

  private toYaml(obj: unknown, indent: number): string {
    const spaces = '  '.repeat(indent);
    const lines: string[] = [];

    if (obj === null || obj === undefined) {
      return 'null';
    }

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            lines.push(`${spaces}${key}:`);
            for (const item of value) {
              lines.push(`${spaces}  - ${this.toYaml(item, 0)}`);
            }
          } else {
            lines.push(`${spaces}${key}:`);
            lines.push(this.toYaml(value, indent + 1));
          }
        } else {
          lines.push(`${spaces}${key}: ${this.toYaml(value, 0)}`);
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        lines.push(`${spaces}- ${this.toYaml(item, 0)}`);
      }
    } else {
      lines.push(String(obj));
    }

    return lines.join('\n');
  }
}

/**
 * Silent output formatter
 */
export class SilentFormatter extends OutputFormatter {
  print(_data: unknown): void {
    // No output
  }
}

/**
 * Create output formatter based on format type
 */
export function createFormatter(options: OutputOptions = {}): OutputFormatter {
  const formatter = options.format ?? 'table';

  switch (formatter) {
    case 'json':
      return new JsonFormatter(options);
    case 'yaml':
      return new YamlFormatter(options);
    case 'silent':
      return new SilentFormatter(options);
    case 'table':
    default:
      return new TableFormatter(options);
  }
}
