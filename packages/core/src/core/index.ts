/**
 * Core module exports
 */

// Types
export * from './types';

// Config Manager
export {
  ConfigManager,
  getConfigManager,
  createConfigManager,
  type ConfigManagerOptions,
  type BackupInfo,
} from './ConfigManager';

// Validator (aliased to avoid conflict with IAdapter types)
export { ConfigValidator, configValidator } from './validator';

export type {
  ValidationResult as ConfigValidationResult,
  ValidationError as ConfigValidationError,
  ValidationWarning as ConfigValidationWarning,
} from './validator';

// Version
export const CORE_VERSION = '1.0.0';
