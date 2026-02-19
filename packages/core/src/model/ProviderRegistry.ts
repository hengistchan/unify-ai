import type { AIProvider, ProviderType } from './types';

/**
 * Built-in AI provider definitions with models and pricing
 */
export const BUILTIN_PROVIDERS: Omit<AIProvider, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai-compatible' as ProviderType,
    enabled: true,
    priority: 100,
    config: {},
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        providerId: 'openai',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        enabled: true,
        pricing: {
          inputPerK: 0.005,
          outputPerK: 0.015,
        },
      },
      {
        id: 'gpt-4-turbo',
        displayName: 'GPT-4 Turbo',
        providerId: 'openai',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        enabled: true,
        pricing: {
          inputPerK: 0.01,
          outputPerK: 0.03,
        },
      },
      {
        id: 'gpt-3.5-turbo',
        displayName: 'GPT-3.5 Turbo',
        providerId: 'openai',
        contextWindow: 16000,
        maxOutputTokens: 4096,
        enabled: true,
        pricing: {
          inputPerK: 0.0005,
          outputPerK: 0.0015,
        },
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic' as ProviderType,
    enabled: true,
    priority: 90,
    config: {},
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      {
        id: 'claude-sonnet-4-5-20250929',
        displayName: 'Claude Sonnet 4.5',
        providerId: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        enabled: true,
        pricing: {
          inputPerK: 0.003,
          outputPerK: 0.015,
        },
      },
      {
        id: 'claude-opus-4-6-20250514',
        displayName: 'Claude Opus 4.6',
        providerId: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        enabled: true,
        pricing: {
          inputPerK: 0.015,
          outputPerK: 0.075,
        },
      },
      {
        id: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        providerId: 'anthropic',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        enabled: true,
        pricing: {
          inputPerK: 0.001,
          outputPerK: 0.005,
        },
      },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'openai-compatible' as ProviderType,
    enabled: true,
    priority: 80,
    config: {},
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      {
        id: 'deepseek-chat',
        displayName: 'DeepSeek Chat',
        providerId: 'deepseek',
        contextWindow: 64000,
        maxOutputTokens: 4096,
        enabled: true,
        pricing: {
          inputPerK: 0.00014,
          outputPerK: 0.00028,
        },
      },
      {
        id: 'deepseek-coder',
        displayName: 'DeepSeek Coder',
        providerId: 'deepseek',
        contextWindow: 64000,
        maxOutputTokens: 4096,
        enabled: true,
        pricing: {
          inputPerK: 0.00014,
          outputPerK: 0.00028,
        },
      },
    ],
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    type: 'azure' as ProviderType,
    enabled: false,
    priority: 70,
    config: {},
    baseUrl: '', // Configured by user
    models: [], // Loaded dynamically
  },
  {
    id: 'google-ai',
    name: 'Google AI',
    type: 'openai-compatible' as ProviderType,
    enabled: false,
    priority: 60,
    config: {},
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      {
        id: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        providerId: 'google-ai',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        enabled: true,
        pricing: {
          inputPerK: 0.0001,
          outputPerK: 0.0004,
        },
      },
      {
        id: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        providerId: 'google-ai',
        contextWindow: 2000000,
        maxOutputTokens: 8192,
        enabled: true,
        pricing: {
          inputPerK: 0.00125,
          outputPerK: 0.005,
        },
      },
    ],
  },
];
