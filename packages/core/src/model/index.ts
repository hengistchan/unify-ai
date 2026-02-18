/**
 * Model Configuration Management Module
 *
 * This module provides unified management of AI model providers, API keys,
 * models, and usage tracking for unify-ai.
 */

// Type definitions
export type {
  ProviderType,
  AIProvider,
  ProviderConfig,
  ModelInfo,
  ModelPricing,
  ModelConfig,
  APIKey,
  EncryptedKeyData,
  UsageLog,
  UsageSummary,
  ModelUsageSummary,
  ModelManagerOptions,
  CreateProviderInput,
  UpdateProviderInput,
  SetAPIKeyInput,
  LogUsageInput,
  UsageLogFilters,
  ModelExportData,
} from './types';

// Core classes (will be implemented in Phase 2)
// export { ModelManager } from './ModelManager';
// export { ModelDatabase } from './Database';
// export { EncryptionManager } from './EncryptionManager';
// export { UsageTracker } from './UsageTracker';

// Built-in providers
export { BUILTIN_PROVIDERS } from './ProviderRegistry';
