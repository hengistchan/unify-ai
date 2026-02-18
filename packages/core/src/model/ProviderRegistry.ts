import type { AIProvider, ProviderType } from './types';

/**
 * Built-in AI provider definitions with models and pricing
 */
export const BUILTIN_PROVIDERS: Omit<AIProvider, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai' as ProviderType,
    enabled: true,
    priority: 100,
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
        pricing: {
          inputPer1k: 0.005,
          outputPer1k: 0.015,
        },
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        contextWindow: 128000,
        pricing: {
          inputPer1k: 0.01,
          outputPer1k: 0.03,
        },
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        contextWindow: 16000,
        pricing: {
          inputPer1k: 0.0005,
          outputPer1k: 0.0015,
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
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      {
        id: 'claude-sonnet-4-5-20250929',
        name: 'Claude Sonnet 4.5',
        contextWindow: 200000,
        pricing: {
          inputPer1k: 0.003,
          outputPer1k: 0.015,
        },
      },
      {
        id: 'claude-opus-4-6-20250514',
        name: 'Claude Opus 4.6',
        contextWindow: 200000,
        pricing: {
          inputPer1k: 0.015,
          outputPer1k: 0.075,
        },
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        contextWindow: 200000,
        pricing: {
          inputPer1k: 0.001,
          outputPer1k: 0.005,
        },
      },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'deepseek' as ProviderType,
    enabled: true,
    priority: 80,
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        contextWindow: 64000,
        pricing: {
          inputPer1k: 0.00014,
          outputPer1k: 0.00028,
        },
      },
      {
        id: 'deepseek-coder',
        name: 'DeepSeek Coder',
        contextWindow: 64000,
        pricing: {
          inputPer1k: 0.00014,
          outputPer1k: 0.00028,
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
    baseUrl: '', // Configured by user
    models: [], // Loaded dynamically
  },
  {
    id: 'google-ai',
    name: 'Google AI',
    type: 'google' as ProviderType,
    enabled: false,
    priority: 60,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        pricing: {
          inputPer1k: 0.0001,
          outputPer1k: 0.0004,
        },
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        contextWindow: 2000000,
        pricing: {
          inputPer1k: 0.00125,
          outputPer1k: 0.005,
        },
      },
    ],
  },
];
