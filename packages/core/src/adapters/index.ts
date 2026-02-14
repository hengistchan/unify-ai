/**
 * Adapters module exports
 */

// Base
export * from './base';

// Individual adapters
export * from './cursor';
export * from './claude-code';
export * from './copilot';

// Registry
export { adapterRegistry, CursorAdapter, ClaudeCodeAdapter, CopilotAdapter } from './registry';
