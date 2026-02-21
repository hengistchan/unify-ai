/**
 * API Key Validator Unit Tests
 * Tests API key validation logic for different providers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIKeyValidator } from '../../model/APIKeyValidator';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('APIKeyValidator', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validate()', () => {
    describe('OpenAI', () => {
      it('should return valid for successful API response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        const result = await APIKeyValidator.validate('openai', 'sk-test-key-12345');

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/models',
          expect.objectContaining({
            method: 'GET',
            headers: {
              Authorization: 'Bearer sk-test-key-12345',
            },
          })
        );
      });

      it('should return invalid for 401 response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: { message: 'Invalid API key' } }),
        });

        const result = await APIKeyValidator.validate('openai', 'invalid-key');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid API key');
        expect(result.errorType).toBe('invalid_key');
      });

      it('should return valid for rate limited (429) response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limited' } }),
        });

        const result = await APIKeyValidator.validate('openai', 'sk-test-key');

        expect(result.valid).toBe(true);
      });

      it('should return insufficient_quota for quota exceeded', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'You exceeded your quota' } }),
        });

        const result = await APIKeyValidator.validate('openai', 'sk-test-key');

        expect(result.valid).toBe(false);
        expect(result.errorType).toBe('insufficient_quota');
      });
    });

    describe('Anthropic', () => {
      it('should return valid for successful API response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        const result = await APIKeyValidator.validate('anthropic', 'sk-ant-test-key');

        expect(result.valid).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.anthropic.com/v1/messages',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'x-api-key': 'sk-ant-test-key',
              'anthropic-version': '2023-06-01',
            }),
          })
        );
      });

      it('should return valid for 404 (model not found but key valid)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: { message: 'Model not found' } }),
        });

        const result = await APIKeyValidator.validate('anthropic', 'sk-ant-test-key');

        expect(result.valid).toBe(true);
      });

      it('should return invalid for 401 response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: { type: 'authentication_error' } }),
        });

        const result = await APIKeyValidator.validate('anthropic', 'invalid-key');

        expect(result.valid).toBe(false);
        expect(result.errorType).toBe('invalid_key');
      });
    });

    describe('DeepSeek', () => {
      it('should return valid for successful API response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        const result = await APIKeyValidator.validate('deepseek', 'sk-test-key');

        expect(result.valid).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.deepseek.com/v1/models',
          expect.objectContaining({
            headers: {
              Authorization: 'Bearer sk-test-key',
            },
          })
        );
      });
    });

    describe('Google AI', () => {
      it('should return valid for successful API response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        const result = await APIKeyValidator.validate('google-ai', 'google-api-key');

        expect(result.valid).toBe(true);
        // Google AI uses query parameter for API key
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('key=google-api-key'),
          expect.any(Object)
        );
      });

      it('should return invalid for 400/403 response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({ error: { message: 'Invalid API key' } }),
        });

        const result = await APIKeyValidator.validate('google-ai', 'invalid-key');

        expect(result.valid).toBe(false);
        expect(result.errorType).toBe('invalid_key');
      });
    });

    describe('Azure OpenAI', () => {
      it('should return invalid when no base URL configured', async () => {
        const result = await APIKeyValidator.validate('azure-openai', 'azure-key', null);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Azure OpenAI requires a base URL to be configured');
        expect(result.errorType).toBe('invalid_key');
      });

      it('should use configured base URL for validation', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        const provider = {
          id: 'azure-openai',
          name: 'Azure OpenAI',
          type: 'azure' as const,
          enabled: true,
          priority: 70,
          config: {},
          models: [],
          baseUrl: 'https://my-instance.openai.azure.com',
          createdAt: '',
          updatedAt: '',
        };

        const result = await APIKeyValidator.validate('azure-openai', 'azure-key', provider);

        expect(result.valid).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('my-instance.openai.azure.com'),
          expect.objectContaining({
            headers: {
              'api-key': 'azure-key',
            },
          })
        );
      });
    });

    describe('Unknown providers', () => {
      it('should return valid for format validation when no base URL', async () => {
        const result = await APIKeyValidator.validate('unknown-provider', 'valid-key-12345');

        expect(result.valid).toBe(true);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should return invalid for empty key', async () => {
        const result = await APIKeyValidator.validate('unknown-provider', '');

        expect(result.valid).toBe(false);
        expect(result.errorType).toBe('invalid_key');
      });

      it('should return invalid for too short key', async () => {
        const result = await APIKeyValidator.validate('unknown-provider', 'short');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('API key is too short');
      });

      it('should return invalid for key with spaces', async () => {
        const result = await APIKeyValidator.validate('unknown-provider', 'key with spaces');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('API key contains invalid characters');
      });
    });

    describe('Error handling', () => {
      it('should return timeout error when request times out', async () => {
        // Create an abort controller to simulate timeout
        mockFetch.mockImplementation(
          () =>
            new Promise((_, reject) => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            })
        );

        const result = await APIKeyValidator.validate('openai', 'sk-test-key', null, {
          timeout: 100,
        });

        expect(result.valid).toBe(false);
        expect(result.errorType).toBe('timeout');
        expect(result.error).toContain('timed out');
      });

      it('should return network error for fetch failure', async () => {
        mockFetch.mockRejectedValue(new Error('fetch failed'));

        const result = await APIKeyValidator.validate('openai', 'sk-test-key');

        expect(result.valid).toBe(false);
        expect(result.errorType).toBe('network_error');
      });
    });

    describe('Custom options', () => {
      it('should use custom base URL when provided', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

        const result = await APIKeyValidator.validate('openai', 'sk-test-key', null, {
          baseUrl: 'https://custom.openai.proxy.com/v1',
        });

        expect(result.valid).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://custom.openai.proxy.com/v1/models',
          expect.any(Object)
        );
      });
    });
  });
});
