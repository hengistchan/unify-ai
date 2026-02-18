/**
 * Test fixtures for model configuration management
 */

import type { AIProvider, ModelInfo, CreateProviderInput } from '../../../model/types';

/**
 * Mock OpenAI provider
 */
export const mockOpenAIProvider: AIProvider = {
  id: 'openai',
  name: 'OpenAI',
  type: 'openai-compatible',
  enabled: true,
  priority: 100,
  baseUrl: 'https://api.openai.com/v1',
  models: [mockGPT4o, mockGPT4Turbo, mockGPT35Turbo],
  defaultModel: 'gpt-4o',
  config: {
    timeout: 30000,
    maxRetries: 3,
  },
  createdAt: '2026-02-19T00:00:00.000Z',
  updatedAt: '2026-02-19T00:00:00.000Z',
};

/**
 * Mock Anthropic provider
 */
export const mockAnthropicProvider: AIProvider = {
  id: 'anthropic',
  name: 'Anthropic',
  type: 'anthropic',
  enabled: true,
  priority: 90,
  baseUrl: 'https://api.anthropic.com/v1',
  models: [mockClaudeSonnet45, mockClaudeOpus46, mockClaude35Haiku],
  defaultModel: 'claude-sonnet-4-5-20250929',
  config: {
    timeout: 60000,
    maxRetries: 2,
  },
  createdAt: '2026-02-19T00:00:00.000Z',
  updatedAt: '2026-02-19T00:00:00.000Z',
};

/**
 * Mock DeepSeek provider
 */
export const mockDeepSeekProvider: AIProvider = {
  id: 'deepseek',
  name: 'DeepSeek',
  type: 'openai-compatible',
  enabled: false,
  priority: 80,
  baseUrl: 'https://api.deepseek.com/v1',
  models: [mockDeepSeekChat, mockDeepSeekCoder],
  defaultModel: 'deepseek-chat',
  config: {},
  createdAt: '2026-02-19T00:00:00.000Z',
  updatedAt: '2026-02-19T00:00:00.000Z',
};

/**
 * All mock providers
 */
export const mockProviders: AIProvider[] = [
  mockOpenAIProvider,
  mockAnthropicProvider,
  mockDeepSeekProvider,
];

// ============================================
// Mock Models
// ============================================

export const mockGPT4o: ModelInfo = {
  id: 'gpt-4o',
  providerId: 'openai',
  displayName: 'GPT-4o',
  contextWindow: 128000,
  maxOutputTokens: 4096,
  pricing: {
    inputPerK: 0.005,
    outputPerK: 0.015,
  },
  enabled: true,
};

export const mockGPT4Turbo: ModelInfo = {
  id: 'gpt-4-turbo',
  providerId: 'openai',
  displayName: 'GPT-4 Turbo',
  contextWindow: 128000,
  maxOutputTokens: 4096,
  pricing: {
    inputPerK: 0.01,
    outputPerK: 0.03,
  },
  enabled: true,
};

export const mockGPT35Turbo: ModelInfo = {
  id: 'gpt-3.5-turbo',
  providerId: 'openai',
  displayName: 'GPT-3.5 Turbo',
  contextWindow: 16385,
  maxOutputTokens: 4096,
  pricing: {
    inputPerK: 0.0005,
    outputPerK: 0.0015,
  },
  enabled: true,
};

export const mockClaudeSonnet45: ModelInfo = {
  id: 'claude-sonnet-4-5-20250929',
  providerId: 'anthropic',
  displayName: 'Claude Sonnet 4.5',
  contextWindow: 200000,
  maxOutputTokens: 8192,
  pricing: {
    inputPerK: 0.003,
    outputPerK: 0.015,
    cacheReadPerK: 0.0003,
    cacheCreationPerK: 0.00375,
  },
  enabled: true,
};

export const mockClaudeOpus46: ModelInfo = {
  id: 'claude-opus-4-6-20250514',
  providerId: 'anthropic',
  displayName: 'Claude Opus 4.6',
  contextWindow: 200000,
  maxOutputTokens: 8192,
  pricing: {
    inputPerK: 0.015,
    outputPerK: 0.075,
  },
  enabled: true,
};

export const mockClaude35Haiku: ModelInfo = {
  id: 'claude-3-5-haiku-20241022',
  providerId: 'anthropic',
  displayName: 'Claude 3.5 Haiku',
  contextWindow: 200000,
  maxOutputTokens: 8192,
  pricing: {
    inputPerK: 0.001,
    outputPerK: 0.005,
  },
  enabled: true,
};

export const mockDeepSeekChat: ModelInfo = {
  id: 'deepseek-chat',
  providerId: 'deepseek',
  displayName: 'DeepSeek Chat',
  contextWindow: 64000,
  maxOutputTokens: 4096,
  pricing: {
    inputPerK: 0.00014,
    outputPerK: 0.00028,
  },
  enabled: true,
};

export const mockDeepSeekCoder: ModelInfo = {
  id: 'deepseek-coder',
  providerId: 'deepseek',
  displayName: 'DeepSeek Coder',
  contextWindow: 64000,
  maxOutputTokens: 4096,
  pricing: {
    inputPerK: 0.00014,
    outputPerK: 0.00028,
  },
  enabled: true,
};

// ============================================
// Mock Inputs
// ============================================

export const mockCreateProviderInput: CreateProviderInput = {
  id: 'test-provider',
  name: 'Test Provider',
  type: 'openai-compatible',
  baseUrl: 'https://api.test.com/v1',
  models: [
    {
      id: 'test-model-1',
      displayName: 'Test Model 1',
      contextWindow: 32000,
      maxOutputTokens: 2048,
      pricing: { inputPerK: 0.001, outputPerK: 0.002 },
      enabled: true,
    },
  ],
  defaultModel: 'test-model-1',
};

// ============================================
// Mock API Keys
// ============================================

export const mockAPIKeyPlaintext = 'sk-test-1234567890abcdef';

export const mockEncryptedKeyData = {
  encrypted: Buffer.from('encrypted-data-here', 'utf8'),
  iv: Buffer.from('iv-here', 'utf8'),
  authTag: Buffer.from('auth-tag-here', 'utf8'),
};

// ============================================
// Mock Usage Logs
// ============================================

export const mockUsageLog = {
  providerId: 'openai',
  model: 'gpt-4o',
  inputTokens: 1000,
  outputTokens: 500,
  cost: 0.0125,
  requestId: 'req-test-123',
};
