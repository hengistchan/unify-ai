/**
 * API Key Validator
 *
 * Validates API keys by making actual API calls to provider endpoints.
 * Supports OpenAI, Anthropic, DeepSeek, Google AI, and Azure OpenAI.
 */

import type { AIProvider } from './types';

/**
 * API Key validation result
 */
export interface APIKeyValidationResult {
  /** Whether the key is valid */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Error type for better error handling */
  errorType?: 'invalid_key' | 'insufficient_quota' | 'rate_limited' | 'network_error' | 'timeout' | 'unknown';
}

/**
 * Options for API key validation
 */
export interface ValidationOptions {
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Custom base URL override */
  baseUrl?: string;
}

/**
 * Default timeout for validation requests
 */
const DEFAULT_TIMEOUT = 10000;

/**
 * API Key Validator
 *
 * Makes lightweight API calls to validate API keys without storing them.
 */
export class APIKeyValidator {
  /**
   * Validate an API key for a provider
   *
   * @param providerId - Provider ID (e.g., 'openai', 'anthropic')
   * @param apiKey - The API key to validate
   * @param provider - Provider configuration (for base URL, etc.)
   * @param options - Validation options
   * @returns Validation result
   */
  static async validate(
    providerId: string,
    apiKey: string,
    provider?: AIProvider | null,
    options?: ValidationOptions
  ): Promise<APIKeyValidationResult> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    try {
      switch (providerId) {
        case 'openai':
          return await this.validateOpenAI(apiKey, timeout, options?.baseUrl);

        case 'anthropic':
          return await this.validateAnthropic(apiKey, timeout, options?.baseUrl);

        case 'deepseek':
          return await this.validateDeepSeek(apiKey, timeout, options?.baseUrl);

        case 'google-ai':
          return await this.validateGoogleAI(apiKey, timeout, options?.baseUrl);

        case 'azure-openai':
          return await this.validateAzureOpenAI(apiKey, provider, timeout);

        default:
          // For unknown providers, try OpenAI-compatible validation if base URL exists
          if (provider?.baseUrl) {
            return await this.validateOpenAICompatible(apiKey, provider.baseUrl, timeout);
          }
          // Fallback to format validation
          return this.validateFormat(providerId, apiKey);
      }
    } catch (error) {
      // Handle unexpected errors
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        errorType: 'unknown',
      };
    }
  }

  /**
   * Validate OpenAI API key
   */
  private static async validateOpenAI(
    apiKey: string,
    timeout: number,
    baseUrl?: string
  ): Promise<APIKeyValidationResult> {
    const url = `${baseUrl || 'https://api.openai.com/v1'}/models`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return this.handleOpenAIResponse(response);
    } catch (error) {
      return this.handleFetchError(error, timeout);
    }
  }

  /**
   * Handle OpenAI API response
   */
  private static async handleOpenAIResponse(response: Response): Promise<APIKeyValidationResult> {
    if (response.ok) {
      return { valid: true };
    }

    const errorData = await this.tryParseError(response);

    if (response.status === 401) {
      return {
        valid: false,
        error: 'Invalid API key',
        errorType: 'invalid_key',
      };
    }

    if (response.status === 429) {
      // Rate limited - key might be valid, but we can't verify
      const message = errorData?.error?.message || 'Rate limited';
      if (message.includes('quota') || message.includes('billing')) {
        return {
          valid: false,
          error: 'API key valid but quota exceeded. Please check your billing.',
          errorType: 'insufficient_quota',
        };
      }
      // Rate limited but key is likely valid
      return { valid: true };
    }

    if (response.status === 403) {
      return {
        valid: false,
        error: 'Access forbidden. Please check your API key permissions.',
        errorType: 'invalid_key',
      };
    }

    return {
      valid: false,
      error: errorData?.error?.message || `API error: ${response.status}`,
      errorType: 'unknown',
    };
  }

  /**
   * Validate Anthropic API key
   */
  private static async validateAnthropic(
    apiKey: string,
    timeout: number,
    baseUrl?: string
  ): Promise<APIKeyValidationResult> {
    // Anthropic doesn't have a simple validation endpoint, so we make a minimal messages request
    const url = `${baseUrl || 'https://api.anthropic.com/v1'}/messages`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return this.handleAnthropicResponse(response);
    } catch (error) {
      return this.handleFetchError(error, timeout);
    }
  }

  /**
   * Handle Anthropic API response
   */
  private static async handleAnthropicResponse(response: Response): Promise<APIKeyValidationResult> {
    if (response.ok) {
      return { valid: true };
    }

    const errorData = await this.tryParseError(response);

    if (response.status === 401) {
      return {
        valid: false,
        error: 'Invalid API key',
        errorType: 'invalid_key',
      };
    }

    if (response.status === 403) {
      return {
        valid: false,
        error: 'Access forbidden. Please check your API key permissions.',
        errorType: 'invalid_key',
      };
    }

    if (response.status === 429) {
      const errorType = errorData?.error?.type;
      if (errorType === 'insufficient_quota' || errorType === 'credit_limit_exceeded') {
        return {
          valid: false,
          error: 'API key valid but quota exceeded. Please check your billing.',
          errorType: 'insufficient_quota',
        };
      }
      // Rate limited but key is likely valid
      return { valid: true };
    }

    if (response.status === 400) {
      // Bad request might mean invalid key format or missing required fields
      const errorType = errorData?.error?.type;
      if (errorType === 'invalid_request_error') {
        // If the request format is correct but key is invalid, we'd get 401
        // So 400 with invalid_request_error might indicate other issues
        return {
          valid: true, // Key format is likely valid
        };
      }
    }

    if (response.status === 404) {
      // Model not found - but key is valid
      return { valid: true };
    }

    return {
      valid: false,
      error: errorData?.error?.message || `API error: ${response.status}`,
      errorType: 'unknown',
    };
  }

  /**
   * Validate DeepSeek API key (OpenAI-compatible)
   */
  private static async validateDeepSeek(
    apiKey: string,
    timeout: number,
    baseUrl?: string
  ): Promise<APIKeyValidationResult> {
    const url = `${baseUrl || 'https://api.deepseek.com/v1'}/models`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // DeepSeek uses OpenAI-compatible responses
      return this.handleOpenAIResponse(response);
    } catch (error) {
      return this.handleFetchError(error, timeout);
    }
  }

  /**
   * Validate Google AI API key
   */
  private static async validateGoogleAI(
    apiKey: string,
    timeout: number,
    baseUrl?: string
  ): Promise<APIKeyValidationResult> {
    // Google AI uses API key in query parameter
    const url = `${baseUrl || 'https://generativelanguage.googleapis.com/v1beta'}/models?key=${apiKey}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return this.handleGoogleAIResponse(response);
    } catch (error) {
      return this.handleFetchError(error, timeout);
    }
  }

  /**
   * Handle Google AI API response
   */
  private static async handleGoogleAIResponse(response: Response): Promise<APIKeyValidationResult> {
    if (response.ok) {
      return { valid: true };
    }

    const errorData = await this.tryParseError(response);

    if (response.status === 400 || response.status === 403) {
      return {
        valid: false,
        error: 'Invalid API key',
        errorType: 'invalid_key',
      };
    }

    if (response.status === 429) {
      // Rate limited - key is valid
      return { valid: true };
    }

    return {
      valid: false,
      error: errorData?.error?.message || `API error: ${response.status}`,
      errorType: 'unknown',
    };
  }

  /**
   * Validate Azure OpenAI API key
   */
  private static async validateAzureOpenAI(
    apiKey: string,
    provider: AIProvider | undefined | null,
    timeout: number
  ): Promise<APIKeyValidationResult> {
    if (!provider?.baseUrl) {
      return {
        valid: false,
        error: 'Azure OpenAI requires a base URL to be configured',
        errorType: 'invalid_key',
      };
    }

    // Azure uses api-key header
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${provider.baseUrl}/deployments?api-version=2024-02-01`, {
        method: 'GET',
        headers: {
          'api-key': apiKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { valid: true };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          error: 'Invalid API key or unauthorized access',
          errorType: 'invalid_key',
        };
      }

      const errorData = await this.tryParseError(response);
      return {
        valid: false,
        error: errorData?.error?.message || `API error: ${response.status}`,
        errorType: 'unknown',
      };
    } catch (error) {
      return this.handleFetchError(error, timeout);
    }
  }

  /**
   * Validate OpenAI-compatible API key
   */
  private static async validateOpenAICompatible(
    apiKey: string,
    baseUrl: string,
    timeout: number
  ): Promise<APIKeyValidationResult> {
    const url = `${baseUrl}/models`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { valid: true };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          error: 'Invalid API key',
          errorType: 'invalid_key',
        };
      }

      // For other errors, key might still be valid
      if (response.status === 429) {
        return { valid: true };
      }

      return {
        valid: false,
        error: `API error: ${response.status}`,
        errorType: 'unknown',
      };
    } catch (error) {
      return this.handleFetchError(error, timeout);
    }
  }

  /**
   * Basic format validation for unknown providers
   */
  private static validateFormat(providerId: string, apiKey: string): APIKeyValidationResult {
    // Basic sanity checks
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        valid: false,
        error: 'API key cannot be empty',
        errorType: 'invalid_key',
      };
    }

    if (apiKey.length < 10) {
      return {
        valid: false,
        error: 'API key is too short',
        errorType: 'invalid_key',
      };
    }

    // Check for obviously invalid patterns
    if (apiKey.includes(' ') || apiKey.includes('\n') || apiKey.includes('\t')) {
      return {
        valid: false,
        error: 'API key contains invalid characters',
        errorType: 'invalid_key',
      };
    }

    // For unknown providers, we can only do format validation
    // Return valid with a note that we couldn't verify with API
    return { valid: true };
  }

  /**
   * Try to parse error response as JSON
   */
  private static async tryParseError(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Handle fetch errors (network, timeout, etc.)
   */
  private static handleFetchError(error: unknown, timeout: number): APIKeyValidationResult {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          valid: false,
          error: `Validation timed out after ${timeout}ms`,
          errorType: 'timeout',
        };
      }

      if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
        return {
          valid: false,
          error: 'Network error. Please check your internet connection.',
          errorType: 'network_error',
        };
      }

      return {
        valid: false,
        error: error.message,
        errorType: 'unknown',
      };
    }

    return {
      valid: false,
      error: 'Unknown error during validation',
      errorType: 'unknown',
    };
  }
}
