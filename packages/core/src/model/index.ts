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
  ProxyConfig,
  ProxyStats,
  ProxyStatus,
  RequestLog,
  // Hybrid tool isolation types
  ProviderScope,
  HybridProviderFields,
  CurrentProviderResult,
  // Provider backfill types
  ProviderBackup,
  SwitchProviderResult,
} from './types';

// Validation types
export type { APIKeyValidationResult, ValidationOptions } from './APIKeyValidator';

// Core classes
export { ModelManager } from './ModelManager';
export { ModelDatabase } from './Database';
export { EncryptionManager } from './EncryptionManager';
export { UsageTracker } from './UsageTracker';
export { ProxyServer } from './ProxyServer';
export { APIKeyValidator } from './APIKeyValidator';

// Built-in providers
export { BUILTIN_PROVIDERS } from './ProviderRegistry';
