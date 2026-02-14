/**
 * Adapter Registry
 * Manages all available adapters
 */

import type { IAdapter } from '../adapters/base/IAdapter';
import type { ToolId, ConfigCapability, AdapterInfo } from '../core/types';

// Import all adapters
import { CursorAdapter, cursorAdapter } from '../adapters/cursor';
import { ClaudeCodeAdapter, claudeCodeAdapter } from '../adapters/claude-code';
import { CopilotAdapter, copilotAdapter } from '../adapters/copilot';
import { WindsurfAdapter, windsurfAdapter } from '../adapters/windsurf';
import { CodexAdapter, codexAdapter } from '../adapters/codex';
import { ClineAdapter, clineAdapter } from '../adapters/cline';
import { AiderAdapter, aiderAdapter } from '../adapters/aider';
import { ContinueAdapter, continueAdapter } from '../adapters/continue';

/**
 * Adapter registry
 */
export class AdapterRegistry {
  private adapters: Map<ToolId, IAdapter> = new Map();
  private initialized = false;

  /**
   * Initialize registry
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Register built-in adapters
    this.register(cursorAdapter);
    this.register(claudeCodeAdapter);
    this.register(copilotAdapter);
    this.register(windsurfAdapter);
    this.register(codexAdapter);
    this.register(clineAdapter);
    this.register(aiderAdapter);
    this.register(continueAdapter);

    // Call each adapter's initialize method
    for (const adapter of this.adapters.values()) {
      if (adapter.initialize) {
        await adapter.initialize();
      }
    }

    this.initialized = true;
  }

  /**
   * Register adapter
   */
  register(adapter: IAdapter): void {
    this.adapters.set(adapter.toolMeta.id, adapter);
  }

  /**
   * Unregister adapter
   */
  unregister(toolId: ToolId): boolean {
    return this.adapters.delete(toolId);
  }

  /**
   * Get adapter
   */
  get(toolId: ToolId): IAdapter | undefined {
    return this.adapters.get(toolId);
  }

  /**
   * Get all adapters
   */
  getAll(): IAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get all adapter information
   */
  getAllInfo(): AdapterInfo[] {
    return this.getAll().map(adapter => adapter.getInfo());
  }

  /**
   * Find adapters by capability
   */
  findByCapability(capability: ConfigCapability): IAdapter[] {
    return this.getAll().filter(adapter => adapter.hasCapability(capability));
  }

  /**
   * Detect adapters for a project
   */
  async detectForProject(projectRoot: string): Promise<IAdapter[]> {
    const detected: IAdapter[] = [];

    for (const adapter of this.adapters.values()) {
      if (await adapter.detect(projectRoot)) {
        detected.push(adapter);
      }
    }

    return detected;
  }

  /**
   * Check if adapter exists
   */
  has(toolId: ToolId): boolean {
    return this.adapters.has(toolId);
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      if (adapter.dispose) {
        await adapter.dispose();
      }
    }
    this.adapters.clear();
    this.initialized = false;
  }
}

// Export singleton
export const adapterRegistry: AdapterRegistry = new AdapterRegistry();

// Export types
export {
  CursorAdapter,
  ClaudeCodeAdapter,
  CopilotAdapter,
  WindsurfAdapter,
  CodexAdapter,
  ClineAdapter,
  AiderAdapter,
  ContinueAdapter,
};
