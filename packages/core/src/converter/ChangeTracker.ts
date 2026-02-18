/**
 * Converter - ChangeTracker
 * Change tracking for config files
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Import types from types.ts
import type { DiffEntry } from './DiffEngine';
import { FileFingerprint, FingerprintManager } from './FingerprintManager';

// ============================================
// Type definitions
// ============================================

/**
 * Change source type
 */
export type ChangeSourceType = 'user' | 'system' | 'new' | 'unchanged' | 'unknown';

/**
 * Change source
 */
export interface ChangeSource {
  /** Source type */
  type: ChangeSourceType;
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Change type
 */
export type ChangeType = 'export' | 'import' | 'merge' | 'modify' | 'delete';

/**
 * Change event
 */
export interface ChangeEvent {
  /** Unique event ID */
  id: string;
  /** Change type */
  type: ChangeType;
  /** File path */
  path: string;
  /** Change source */
  source: ChangeSource;
  /** Diff entries */
  diff?: DiffEntry[];
  /** Tool ID */
  toolId?: string;
  /** Event timestamp */
  timestamp: string;
}

/**
 * Change record
 */
export interface ChangeRecord {
  /** Record ID */
  id: string;
  /** Event timestamp */
  timestamp: string;
  /** Change type */
  type: ChangeType;
  /** Change source */
  source: string;
  /** File path */
  path: string;
  /** Changes */
  changes: PropertyChange[];
  /** Whether resolved */
  resolved?: boolean;
  /** Tool ID */
  toolId?: string;
}

/**
 * Property change
 */
export interface PropertyChange {
  /** JSON path */
  path: string;
  /** Old value */
  oldValue: unknown;
  /** New value */
  newValue: unknown;
  /** Change source */
  source: 'user' | 'system' | 'conflict';
}

/**
 * History options
 */
export interface HistoryOptions {
  /** Maximum number of records */
  limit?: number;
  /** Filter since date */
  since?: string;
  /** Filter by path */
  path?: string;
  /** Filter by tool ID */
  toolId?: string;
}

// ============================================
// Constants
// ============================================

const HISTORY_FILENAME = '.unify-ai/history.json';
const MAX_HISTORY_RECORDS = 1000;

// ============================================
// ChangeTracker class
// ============================================

/**
 * Change tracker
 * Tracks changes to configuration files and detects change sources
 */
export class ChangeTracker {
  private history: ChangeRecord[] = [];
  private historyPath: string;
  private fingerprintManager: FingerprintManager;
  private dirty: boolean = false;

  /**
   * Create a new ChangeTracker
   * @param projectRoot Project root directory
   * @param fingerprintManager Fingerprint manager instance
   */
  constructor(projectRoot: string = process.cwd(), fingerprintManager?: FingerprintManager) {
    this.historyPath = path.join(projectRoot, HISTORY_FILENAME);
    this.fingerprintManager = fingerprintManager ?? new FingerprintManager(projectRoot);
  }

  /**
   * Record a change event
   * @param event Change event
   */
  async recordChange(event: Omit<ChangeEvent, 'id' | 'timestamp'>): Promise<void> {
    const record: ChangeRecord = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: event.type,
      source: event.source.type,
      path: event.path,
      changes: this.diffToPropertyChanges(event.diff),
      toolId: event.toolId,
    };

    this.history.unshift(record);

    // Trim history if needed
    if (this.history.length > MAX_HISTORY_RECORDS) {
      this.history = this.history.slice(0, MAX_HISTORY_RECORDS);
    }

    this.dirty = true;
  }

  /**
   * Get change history
   * @param options History options
   * @returns Change records
   */
  async getHistory(options: HistoryOptions = {}): Promise<ChangeRecord[]> {
    let filtered = [...this.history];

    // Filter by path
    if (options.path) {
      filtered = filtered.filter(r => r.path.startsWith(options.path!));
    }

    // Filter by tool ID
    if (options.toolId) {
      filtered = filtered.filter(r => r.toolId === options.toolId);
    }

    // Filter by since
    if (options.since) {
      const sinceDate = new Date(options.since);
      filtered = filtered.filter(r => new Date(r.timestamp) >= sinceDate);
    }

    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Detect the source of a change
   * @param filePath File path
   * @param currentContent Current file content
   * @returns Change source
   */
  async detectSource(filePath: string, currentContent: unknown): Promise<ChangeSource> {
    const normalizedPath = this.normalizePath(filePath);

    // 1. Get last recorded fingerprint
    const lastFingerprint = this.fingerprintManager.get(normalizedPath);

    if (!lastFingerprint) {
      return { type: 'new', confidence: 1.0 };
    }

    // 2. Compute current fingerprint
    const currentHash = this.computeHash(currentContent);

    if (currentHash === lastFingerprint.hash) {
      return { type: 'unchanged', confidence: 1.0 };
    }

    // 3. Analyze change pattern
    const lastContent = await this.getLastContent(normalizedPath);
    if (!lastContent) {
      return { type: 'unknown', confidence: 0.5 };
    }

    const analysis = await this.analyzeChangePattern(lastContent, currentContent);

    return {
      type: analysis.isUser ? 'user' : 'system',
      confidence: analysis.confidence,
    };
  }

  /**
   * Get recent changes for a path
   * @param filePath File path
   * @param limit Maximum number of records
   * @returns Change records
   */
  async getRecentChanges(filePath: string, limit: number = 10): Promise<ChangeRecord[]> {
    const normalizedPath = this.normalizePath(filePath);
    return this.history.filter(r => r.path === normalizedPath).slice(0, limit);
  }

  /**
   * Get all tracked paths
   * @returns Array of tracked paths
   */
  async getTrackedPaths(): Promise<string[]> {
    const paths = new Set<string>();
    for (const record of this.history) {
      paths.add(record.path);
    }
    return Array.from(paths);
  }

  /**
   * Mark changes as resolved
   * @param recordIds Record IDs to mark as resolved
   */
  async markResolved(recordIds: string[]): Promise<void> {
    for (const id of recordIds) {
      const record = this.history.find(r => r.id === id);
      if (record) {
        record.resolved = true;
        this.dirty = true;
      }
    }
  }

  /**
   * Get unresolved changes
   * @returns Unresolved change records
   */
  async getUnresolvedChanges(): Promise<ChangeRecord[]> {
    return this.history.filter(r => !r.resolved);
  }

  /**
   * Save history to disk
   */
  async save(): Promise<void> {
    if (!this.dirty) {
      return;
    }

    const historyDir = path.dirname(this.historyPath);

    // Ensure directory exists
    try {
      await fs.mkdir(historyDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    await fs.writeFile(this.historyPath, JSON.stringify(this.history, null, 2), 'utf-8');
    this.dirty = false;
  }

  /**
   * Load history from disk
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.historyPath, 'utf-8');
      this.history = JSON.parse(content);
      this.dirty = false;
    } catch {
      // File doesn't exist or can't be read, start fresh
      this.history = [];
      this.dirty = false;
    }

    // Also load fingerprints
    await this.fingerprintManager.load();
  }

  /**
   * Clear all history
   */
  async clear(): Promise<void> {
    this.history = [];
    this.fingerprintManager.clear();
    this.dirty = true;
  }

  /**
   * Get history file path
   * @returns History file path
   */
  getHistoryPath(): string {
    return this.historyPath;
  }

  /**
   * Check if there are unsaved changes
   * @returns True if there are unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.dirty || this.fingerprintManager.hasUnsavedChanges();
  }

  // ============================================
  // Private methods
  // ============================================

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Compute hash for content
   */
  private computeHash(content: unknown): string {
    const normalized =
      typeof content === 'string'
        ? content
        : JSON.stringify(content, Object.keys(content as object).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Normalize file path
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Get last content from fingerprint
   */
  private async getLastContent(filePath: string): Promise<unknown | null> {
    // This is a simplified implementation
    // In a real scenario, you might want to store previous content
    // For now, we return null which will result in 'unknown' source
    return null;
  }

  /**
   * Analyze change pattern to determine if user or system made the change
   */
  private async analyzeChangePattern(
    oldContent: unknown,
    newContent: unknown
  ): Promise<{ isUser: boolean; confidence: number }> {
    const indicators = {
      user: 0,
      system: 0,
    };

    // Check format changes (user edits often have inconsistent formatting)
    try {
      const oldFormatted = JSON.stringify(oldContent, null, 2);
      const newFormatted = JSON.stringify(newContent, null, 2);
      const newRaw = JSON.stringify(newContent);

      if (oldFormatted !== newFormatted && newFormatted === newRaw) {
        indicators.user += 0.3;
      }
    } catch {
      // Not JSON, skip
    }

    // Check modification time (work hours more likely user)
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 18) {
      indicators.user += 0.2;
    }

    // Check change content pattern
    const diff = this.computeSimpleDiff(oldContent, newContent);
    for (const change of diff) {
      // User typically modifies values, system modifies structure
      if (typeof change.newValue === 'string' && !change.path.includes('$')) {
        indicators.user += 0.1;
      }
    }

    const totalIndicators = indicators.user + indicators.system;
    if (totalIndicators === 0) {
      return { isUser: false, confidence: 0.5 };
    }

    return {
      isUser: indicators.user > indicators.system,
      confidence: indicators.user / totalIndicators,
    };
  }

  /**
   * Compute simple diff between two values
   */
  private computeSimpleDiff(
    oldValue: unknown,
    newValue: unknown
  ): { path: string; oldValue: unknown; newValue: unknown }[] {
    const diffs: { path: string; oldValue: unknown; newValue: unknown }[] = [];

    if (
      typeof oldValue !== 'object' ||
      typeof newValue !== 'object' ||
      oldValue === null ||
      newValue === null
    ) {
      if (oldValue !== newValue) {
        diffs.push({ path: '', oldValue, newValue });
      }
      return diffs;
    }

    const oldKeys = Object.keys(oldValue as object);
    const newKeys = Object.keys(newValue as object);
    const allKeys = new Set([...oldKeys, ...newKeys]);

    for (const key of allKeys) {
      const oldVal = (oldValue as Record<string, unknown>)[key];
      const newVal = (newValue as Record<string, unknown>)[key];

      if (oldVal !== newVal) {
        diffs.push({ path: key, oldValue: oldVal, newValue: newVal });
      }
    }

    return diffs;
  }

  /**
   * Convert diff entries to property changes
   */
  private diffToPropertyChanges(diff?: DiffEntry[]): PropertyChange[] {
    if (!diff) {
      return [];
    }

    return diff.map(entry => ({
      path: entry.path,
      oldValue: entry.unifiedValue,
      newValue: entry.toolValue,
      source: entry.source === 'both' ? 'conflict' : entry.source === 'tool' ? 'user' : 'system',
    }));
  }
}

// ============================================
// Export singleton factory
// ============================================

let defaultInstance: ChangeTracker | null = null;

/**
 * Get default ChangeTracker instance
 * @param projectRoot Project root directory
 * @returns ChangeTracker instance
 */
export function getChangeTracker(projectRoot?: string): ChangeTracker {
  if (!defaultInstance) {
    defaultInstance = new ChangeTracker(projectRoot);
  }
  return defaultInstance;
}

/**
 * Create a new ChangeTracker instance
 * @param projectRoot Project root directory
 * @param fingerprintManager Fingerprint manager instance
 * @returns New ChangeTracker instance
 */
export function createChangeTracker(
  projectRoot: string,
  fingerprintManager?: FingerprintManager
): ChangeTracker {
  return new ChangeTracker(projectRoot, fingerprintManager);
}
