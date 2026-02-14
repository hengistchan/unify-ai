/**
 * Adapter Registry
 * 适配器注册表 - 管理所有可用的适配器
 */

import type { IAdapter } from '../adapters/base/IAdapter';
import type { ToolId, ConfigCapability, AdapterInfo } from '../core/types';

// 导入所有适配器
import { CursorAdapter, cursorAdapter } from '../adapters/cursor';
import { ClaudeCodeAdapter, claudeCodeAdapter } from '../adapters/claude-code';
import { CopilotAdapter, copilotAdapter } from '../adapters/copilot';
import { WindsurfAdapter, windsurfAdapter } from '../adapters/windsurf';
import { CodexAdapter, codexAdapter } from '../adapters/codex';
import { ClineAdapter, clineAdapter } from '../adapters/cline';
import { AiderAdapter, aiderAdapter } from '../adapters/aider';
import { ContinueAdapter, continueAdapter } from '../adapters/continue';

/**
 * 适配器注册表
 */
export class AdapterRegistry {
  private adapters: Map<ToolId, IAdapter> = new Map();
  private initialized = false;

  /**
   * 初始化注册表
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 注册内置适配器
    this.register(cursorAdapter);
    this.register(claudeCodeAdapter);
    this.register(copilotAdapter);
    this.register(windsurfAdapter);
    this.register(codexAdapter);
    this.register(clineAdapter);
    this.register(aiderAdapter);
    this.register(continueAdapter);

    // 调用适配器的初始化方法
    for (const adapter of this.adapters.values()) {
      if (adapter.initialize) {
        await adapter.initialize();
      }
    }

    this.initialized = true;
  }

  /**
   * 注册适配器
   */
  register(adapter: IAdapter): void {
    this.adapters.set(adapter.toolMeta.id, adapter);
  }

  /**
   * 注销适配器
   */
  unregister(toolId: ToolId): boolean {
    return this.adapters.delete(toolId);
  }

  /**
   * 获取适配器
   */
  get(toolId: ToolId): IAdapter | undefined {
    return this.adapters.get(toolId);
  }

  /**
   * 获取所有适配器
   */
  getAll(): IAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * 获取所有适配器信息
   */
  getAllInfo(): AdapterInfo[] {
    return this.getAll().map(adapter => adapter.getInfo());
  }

  /**
   * 根据能力查找适配器
   */
  findByCapability(capability: ConfigCapability): IAdapter[] {
    return this.getAll().filter(adapter => adapter.hasCapability(capability));
  }

  /**
   * 根据项目检测适配器
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
   * 检查适配器是否存在
   */
  has(toolId: ToolId): boolean {
    return this.adapters.has(toolId);
  }

  /**
   * 清理资源
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

// 导出单例
export const adapterRegistry: AdapterRegistry = new AdapterRegistry();

// 导出类型
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
