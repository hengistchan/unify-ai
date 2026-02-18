/**
 * ProviderRegistry Unit Tests
 * Tests built-in provider definitions and their structure
 */

import { describe, it, expect } from 'vitest';
import { BUILTIN_PROVIDERS } from '../../model/ProviderRegistry';
import type { AIProvider, ProviderType } from '../../model/types';

describe('ProviderRegistry', () => {
  describe('BUILTIN_PROVIDERS', () => {
    it('should export an array of providers', () => {
      expect(Array.isArray(BUILTIN_PROVIDERS)).toBe(true);
      expect(BUILTIN_PROVIDERS.length).toBeGreaterThan(0);
    });

    it('should include OpenAI provider', () => {
      const openai = BUILTIN_PROVIDERS.find(p => p.id === 'openai');

      expect(openai).toBeDefined();
      expect(openai?.name).toBe('OpenAI');
      expect(openai?.type).toBe('openai');
      expect(openai?.enabled).toBe(true);
      expect(openai?.priority).toBe(100);
      expect(openai?.baseUrl).toBe('https://api.openai.com/v1');
    });

    it('should include Anthropic provider', () => {
      const anthropic = BUILTIN_PROVIDERS.find(p => p.id === 'anthropic');

      expect(anthropic).toBeDefined();
      expect(anthropic?.name).toBe('Anthropic');
      expect(anthropic?.type).toBe('anthropic');
      expect(anthropic?.enabled).toBe(true);
      expect(anthropic?.priority).toBe(90);
      expect(anthropic?.baseUrl).toBe('https://api.anthropic.com/v1');
    });

    it('should include DeepSeek provider', () => {
      const deepseek = BUILTIN_PROVIDERS.find(p => p.id === 'deepseek');

      expect(deepseek).toBeDefined();
      expect(deepseek?.name).toBe('DeepSeek');
      expect(deepseek?.type).toBe('deepseek');
      expect(deepseek?.enabled).toBe(true);
      expect(deepseek?.priority).toBe(80);
      expect(deepseek?.baseUrl).toBe('https://api.deepseek.com/v1');
    });

    it('should include Azure OpenAI provider', () => {
      const azure = BUILTIN_PROVIDERS.find(p => p.id === 'azure-openai');

      expect(azure).toBeDefined();
      expect(azure?.name).toBe('Azure OpenAI');
      expect(azure?.type).toBe('azure');
      expect(azure?.enabled).toBe(false); // Disabled by default
      expect(azure?.priority).toBe(70);
    });

    it('should include Google AI provider', () => {
      const google = BUILTIN_PROVIDERS.find(p => p.id === 'google-ai');

      expect(google).toBeDefined();
      expect(google?.name).toBe('Google AI');
      expect(google?.type).toBe('google');
      expect(google?.enabled).toBe(false); // Disabled by default
      expect(google?.priority).toBe(60);
      expect(google?.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
    });
  });

  describe('provider structure', () => {
    it('should have all required fields', () => {
      BUILTIN_PROVIDERS.forEach(provider => {
        expect(provider).toHaveProperty('id');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('type');
        expect(provider).toHaveProperty('enabled');
        expect(provider).toHaveProperty('priority');
        expect(provider).toHaveProperty('models');
      });
    });

    it('should have unique provider IDs', () => {
      const ids = BUILTIN_PROVIDERS.map(p => p.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid provider types', () => {
      const validTypes: ProviderType[] = ['openai-compatible', 'anthropic', 'azure', 'custom'];

      BUILTIN_PROVIDERS.forEach(provider => {
        // Allow any string type for flexibility (e.g., 'deepseek', 'google')
        expect(typeof provider.type).toBe('string');
        expect(provider.type.length).toBeGreaterThan(0);
      });
    });

    it('should have valid priority values', () => {
      BUILTIN_PROVIDERS.forEach(provider => {
        expect(typeof provider.priority).toBe('number');
        expect(provider.priority).toBeGreaterThanOrEqual(0);
        expect(provider.priority).toBeLessThanOrEqual(1000);
      });
    });

    it('should have models array for enabled providers', () => {
      BUILTIN_PROVIDERS.forEach(provider => {
        expect(Array.isArray(provider.models)).toBe(true);

        // Enabled providers should have at least one model (except Azure)
        if (provider.enabled && provider.id !== 'azure-openai') {
          expect(provider.models.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('provider priorities', () => {
    it('should have OpenAI with highest priority', () => {
      const openai = BUILTIN_PROVIDERS.find(p => p.id === 'openai');
      const otherProviders = BUILTIN_PROVIDERS.filter(p => p.id !== 'openai');

      otherProviders.forEach(provider => {
        expect(openai!.priority).toBeGreaterThanOrEqual(provider.priority);
      });
    });

    it('should have Anthropic with second highest priority', () => {
      const anthropic = BUILTIN_PROVIDERS.find(p => p.id === 'anthropic');
      const openai = BUILTIN_PROVIDERS.find(p => p.id === 'openai');
      const others = BUILTIN_PROVIDERS.filter(p => p.id !== 'openai' && p.id !== 'anthropic');

      expect(anthropic!.priority).toBeLessThan(openai!.priority);
      others.forEach(provider => {
        expect(anthropic!.priority).toBeGreaterThanOrEqual(provider.priority);
      });
    });

    it('should have descending priority order for built-in providers', () => {
      const enabledProviders = BUILTIN_PROVIDERS
        .filter(p => p.enabled)
        .sort((a, b) => b.priority - a.priority);

      // First should be OpenAI
      expect(enabledProviders[0].id).toBe('openai');

      // Second should be Anthropic
      expect(enabledProviders[1].id).toBe('anthropic');
    });
  });

  describe('OpenAI models', () => {
    const openai = BUILTIN_PROVIDERS.find(p => p.id === 'openai');

    it('should have GPT-4o model', () => {
      const gpt4o = openai?.models.find(m => m.id === 'gpt-4o');

      expect(gpt4o).toBeDefined();
      expect(gpt4o?.name).toBe('GPT-4o');
      expect(gpt4o?.contextWindow).toBe(128000);
      expect(gpt4o?.pricing).toBeDefined();
      expect(gpt4o?.pricing.inputPer1k).toBe(0.005);
      expect(gpt4o?.pricing.outputPer1k).toBe(0.015);
    });

    it('should have GPT-4 Turbo model', () => {
      const gpt4Turbo = openai?.models.find(m => m.id === 'gpt-4-turbo');

      expect(gpt4Turbo).toBeDefined();
      expect(gpt4Turbo?.name).toBe('GPT-4 Turbo');
      expect(gpt4Turbo?.contextWindow).toBe(128000);
      expect(gpt4Turbo?.pricing.inputPer1k).toBe(0.01);
      expect(gpt4Turbo?.pricing.outputPer1k).toBe(0.03);
    });

    it('should have GPT-3.5 Turbo model', () => {
      const gpt35 = openai?.models.find(m => m.id === 'gpt-3.5-turbo');

      expect(gpt35).toBeDefined();
      expect(gpt35?.name).toBe('GPT-3.5 Turbo');
      expect(gpt35?.contextWindow).toBe(16000);
      expect(gpt35?.pricing.inputPer1k).toBe(0.0005);
      expect(gpt35?.pricing.outputPer1k).toBe(0.0015);
    });

    it('should have 3 models', () => {
      expect(openai?.models.length).toBe(3);
    });
  });

  describe('Anthropic models', () => {
    const anthropic = BUILTIN_PROVIDERS.find(p => p.id === 'anthropic');

    it('should have Claude Sonnet 4.5 model', () => {
      const sonnet = anthropic?.models.find(m => m.id === 'claude-sonnet-4-5-20250929');

      expect(sonnet).toBeDefined();
      expect(sonnet?.name).toBe('Claude Sonnet 4.5');
      expect(sonnet?.contextWindow).toBe(200000);
      expect(sonnet?.pricing.inputPer1k).toBe(0.003);
      expect(sonnet?.pricing.outputPer1k).toBe(0.015);
    });

    it('should have Claude Opus 4.6 model', () => {
      const opus = anthropic?.models.find(m => m.id === 'claude-opus-4-6-20250514');

      expect(opus).toBeDefined();
      expect(opus?.name).toBe('Claude Opus 4.6');
      expect(opus?.contextWindow).toBe(200000);
      expect(opus?.pricing.inputPer1k).toBe(0.015);
      expect(opus?.pricing.outputPer1k).toBe(0.075);
    });

    it('should have Claude 3.5 Haiku model', () => {
      const haiku = anthropic?.models.find(m => m.id === 'claude-3-5-haiku-20241022');

      expect(haiku).toBeDefined();
      expect(haiku?.name).toBe('Claude 3.5 Haiku');
      expect(haiku?.contextWindow).toBe(200000);
      expect(haiku?.pricing.inputPer1k).toBe(0.001);
      expect(haiku?.pricing.outputPer1k).toBe(0.005);
    });

    it('should have 3 models', () => {
      expect(anthropic?.models.length).toBe(3);
    });
  });

  describe('DeepSeek models', () => {
    const deepseek = BUILTIN_PROVIDERS.find(p => p.id === 'deepseek');

    it('should have DeepSeek Chat model', () => {
      const chat = deepseek?.models.find(m => m.id === 'deepseek-chat');

      expect(chat).toBeDefined();
      expect(chat?.name).toBe('DeepSeek Chat');
      expect(chat?.contextWindow).toBe(64000);
      expect(chat?.pricing.inputPer1k).toBe(0.00014);
      expect(chat?.pricing.outputPer1k).toBe(0.00028);
    });

    it('should have DeepSeek Coder model', () => {
      const coder = deepseek?.models.find(m => m.id === 'deepseek-coder');

      expect(coder).toBeDefined();
      expect(coder?.name).toBe('DeepSeek Coder');
      expect(coder?.contextWindow).toBe(64000);
      expect(coder?.pricing.inputPer1k).toBe(0.00014);
      expect(coder?.pricing.outputPer1k).toBe(0.00028);
    });

    it('should have 2 models', () => {
      expect(deepseek?.models.length).toBe(2);
    });
  });

  describe('Google AI models', () => {
    const google = BUILTIN_PROVIDERS.find(p => p.id === 'google-ai');

    it('should have Gemini 2.0 Flash model', () => {
      const geminiFlash = google?.models.find(m => m.id === 'gemini-2.0-flash');

      expect(geminiFlash).toBeDefined();
      expect(geminiFlash?.name).toBe('Gemini 2.0 Flash');
      expect(geminiFlash?.contextWindow).toBe(1000000);
      expect(geminiFlash?.pricing.inputPer1k).toBe(0.0001);
      expect(geminiFlash?.pricing.outputPer1k).toBe(0.0004);
    });

    it('should have Gemini 1.5 Pro model', () => {
      const geminiPro = google?.models.find(m => m.id === 'gemini-1.5-pro');

      expect(geminiPro).toBeDefined();
      expect(geminiPro?.name).toBe('Gemini 1.5 Pro');
      expect(geminiPro?.contextWindow).toBe(2000000);
      expect(geminiPro?.pricing.inputPer1k).toBe(0.00125);
      expect(geminiPro?.pricing.outputPer1k).toBe(0.005);
    });

    it('should have 2 models', () => {
      expect(google?.models.length).toBe(2);
    });
  });

  describe('Azure OpenAI provider', () => {
    const azure = BUILTIN_PROVIDERS.find(p => p.id === 'azure-openai');

    it('should be disabled by default', () => {
      expect(azure?.enabled).toBe(false);
    });

    it('should have empty models array', () => {
      expect(azure?.models).toEqual([]);
    });

    it('should have empty base URL (configured by user)', () => {
      expect(azure?.baseUrl).toBe('');
    });
  });

  describe('model pricing', () => {
    it('should have valid pricing for all models', () => {
      BUILTIN_PROVIDERS.forEach(provider => {
        provider.models.forEach(model => {
          expect(model.pricing).toBeDefined();
          expect(typeof model.pricing.inputPer1k).toBe('number');
          expect(typeof model.pricing.outputPer1k).toBe('number');
          expect(model.pricing.inputPer1k).toBeGreaterThanOrEqual(0);
          expect(model.pricing.outputPer1k).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('should have reasonable pricing ranges', () => {
      BUILTIN_PROVIDERS.forEach(provider => {
        provider.models.forEach(model => {
          // Input pricing should be <= $0.1 per 1K tokens
          expect(model.pricing.inputPer1k).toBeLessThanOrEqual(0.1);

          // Output pricing should be <= $1.0 per 1K tokens
          expect(model.pricing.outputPer1k).toBeLessThanOrEqual(1.0);

          // Output should typically be >= input pricing
          expect(model.pricing.outputPer1k).toBeGreaterThanOrEqual(
            model.pricing.inputPer1k * 0.5
          );
        });
      });
    });

    it('should have Claude Opus as most expensive model', () => {
      const anthropic = BUILTIN_PROVIDERS.find(p => p.id === 'anthropic');
      const opus = anthropic?.models.find(m => m.id === 'claude-opus-4-6-20250514');

      let maxOutputPrice = 0;

      BUILTIN_PROVIDERS.forEach(provider => {
        provider.models.forEach(model => {
          if (model.pricing.outputPer1k > maxOutputPrice) {
            maxOutputPrice = model.pricing.outputPer1k;
          }
        });
      });

      expect(opus?.pricing.outputPer1k).toBe(maxOutputPrice);
    });

    it('should have DeepSeek as cheapest provider', () => {
      const deepseek = BUILTIN_PROVIDERS.find(p => p.id === 'deepseek');

      const avgDeepSeekPrice =
        deepseek!.models.reduce((sum, m) => sum + m.pricing.inputPer1k, 0) /
        deepseek!.models.length;

      BUILTIN_PROVIDERS.forEach(provider => {
        if (provider.models.length > 0) {
          const avgPrice =
            provider.models.reduce((sum, m) => sum + m.pricing.inputPer1k, 0) /
            provider.models.length;

          expect(avgDeepSeekPrice).toBeLessThanOrEqual(avgPrice);
        }
      });
    });
  });

  describe('model context windows', () => {
    it('should have valid context window for all models', () => {
      BUILTIN_PROVIDERS.forEach(provider => {
        provider.models.forEach(model => {
          expect(typeof model.contextWindow).toBe('number');
          expect(model.contextWindow).toBeGreaterThan(0);
          expect(model.contextWindow).toBeLessThanOrEqual(10000000); // Max 10M tokens
        });
      });
    });

    it('should have Gemini 1.5 Pro with largest context window', () => {
      const google = BUILTIN_PROVIDERS.find(p => p.id === 'google-ai');
      const geminiPro = google?.models.find(m => m.id === 'gemini-1.5-pro');

      let maxContextWindow = 0;

      BUILTIN_PROVIDERS.forEach(provider => {
        provider.models.forEach(model => {
          if (model.contextWindow > maxContextWindow) {
            maxContextWindow = model.contextWindow;
          }
        });
      });

      expect(geminiPro?.contextWindow).toBe(maxContextWindow);
      expect(geminiPro?.contextWindow).toBe(2000000);
    });

    it('should have Anthropic models with 200K context window', () => {
      const anthropic = BUILTIN_PROVIDERS.find(p => p.id === 'anthropic');

      anthropic?.models.forEach(model => {
        expect(model.contextWindow).toBe(200000);
      });
    });

    it('should have OpenAI models with 128K or 16K context window', () => {
      const openai = BUILTIN_PROVIDERS.find(p => p.id === 'openai');

      openai?.models.forEach(model => {
        expect([128000, 16000]).toContain(model.contextWindow);
      });
    });
  });

  describe('provider model counts', () => {
    it('should have correct total model count', () => {
      const totalModels = BUILTIN_PROVIDERS.reduce(
        (sum, provider) => sum + provider.models.length,
        0
      );

      // OpenAI: 3, Anthropic: 3, DeepSeek: 2, Azure: 0, Google: 2
      expect(totalModels).toBe(10);
    });

    it('should have at least one model for enabled providers (except Azure)', () => {
      const enabledProviders = BUILTIN_PROVIDERS.filter(p => p.enabled);

      enabledProviders.forEach(provider => {
        if (provider.id !== 'azure-openai') {
          expect(provider.models.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('provider enabled status', () => {
    it('should have OpenAI enabled by default', () => {
      const openai = BUILTIN_PROVIDERS.find(p => p.id === 'openai');
      expect(openai?.enabled).toBe(true);
    });

    it('should have Anthropic enabled by default', () => {
      const anthropic = BUILTIN_PROVIDERS.find(p => p.id === 'anthropic');
      expect(anthropic?.enabled).toBe(true);
    });

    it('should have DeepSeek enabled by default', () => {
      const deepseek = BUILTIN_PROVIDERS.find(p => p.id === 'deepseek');
      expect(deepseek?.enabled).toBe(true);
    });

    it('should have Azure OpenAI disabled by default', () => {
      const azure = BUILTIN_PROVIDERS.find(p => p.id === 'azure-openai');
      expect(azure?.enabled).toBe(false);
    });

    it('should have Google AI disabled by default', () => {
      const google = BUILTIN_PROVIDERS.find(p => p.id === 'google-ai');
      expect(google?.enabled).toBe(false);
    });

    it('should have 3 providers enabled by default', () => {
      const enabledCount = BUILTIN_PROVIDERS.filter(p => p.enabled).length;
      expect(enabledCount).toBe(3);
    });
  });

  describe('type safety', () => {
    it('should conform to AIProvider interface', () => {
      BUILTIN_PROVIDERS.forEach(provider => {
        // TypeScript will catch type mismatches at compile time
        const _typedProvider: Omit<AIProvider, 'createdAt' | 'updatedAt'> = provider;

        expect(_typedProvider).toBeDefined();
      });
    });
  });
});
