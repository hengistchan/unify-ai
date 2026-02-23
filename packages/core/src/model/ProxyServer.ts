/**
 * Proxy Server
 * HTTP proxy server that intercepts AI API requests and routes them through configured providers
 * Supports OpenAI, Anthropic, Azure, and custom OpenAI-compatible providers
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';
import type { ModelManager } from './ModelManager';
import type { AIProvider, ProxyConfig, ProxyStats, ProxyStatus, RequestLog } from './types';

/**
 * Default proxy configuration
 */
const DEFAULT_CONFIG: ProxyConfig = {
  port: 8787,
  host: 'localhost',
  enableLogging: true,
  enableUsageTracking: true,
};

/**
 * Provider-specific configuration
 */
interface ProviderRequestConfig {
  hostname: string;
  port: number;
  path: string;
  headers: Record<string, string>;
  body?: Buffer;
}

/**
 * Proxy Server Implementation
 */
export class ProxyServer {
  private server: http.Server | null = null;
  private modelManager: ModelManager;
  private config: ProxyConfig;
  private status: ProxyStatus = 'stopped';
  private stats: ProxyStats;
  private requestLogs: RequestLog[] = [];
  private startTime: number = 0;
  private requestCounter: number = 0;

  constructor(modelManager: ModelManager, config?: Partial<ProxyConfig>) {
    this.modelManager = modelManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = this.initStats();
  }

  /**
   * Initialize statistics
   */
  private initStats(): ProxyStats {
    return {
      status: 'stopped',
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      bytesReceived: 0,
      bytesSent: 0,
      uptime: 0,
    };
  }

  /**
   * Start the proxy server
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Proxy server is already running');
    }

    this.status = 'starting';
    this.stats.status = 'starting';

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        await this.handleRequest(req, res);
      });

      this.server.on('error', (error: Error) => {
        console.error('[ProxyServer] Server error:', error);
        this.status = 'error';
        this.stats.status = 'error';
        this.stats.lastError = error.message;
      });

      this.server.listen(this.config.port, this.config.host, () => {
        this.status = 'running';
        this.stats.status = 'running';
        this.startTime = Date.now();
        console.log(`[ProxyServer] Started on http://${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the proxy server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    this.status = 'stopping';
    this.stats.status = 'stopping';

    return new Promise((resolve, reject) => {
      this.server!.close(error => {
        if (error) {
          console.error('[ProxyServer] Error stopping server:', error);
          this.status = 'error';
          this.stats.status = 'error';
          this.stats.lastError = error.message;
          reject(error);
        } else {
          this.server = null;
          this.status = 'stopped';
          this.stats.status = 'stopped';
          console.log('[ProxyServer] Stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get current proxy status
   */
  getStatus(): ProxyStatus {
    return this.status;
  }

  /**
   * Get proxy statistics
   */
  getStats(): ProxyStats {
    if (this.status === 'running') {
      this.stats.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    }
    return { ...this.stats };
  }

  /**
   * Get request logs
   */
  getRequestLogs(limit: number = 100): RequestLog[] {
    return this.requestLogs.slice(-limit);
  }

  /**
   * Clear request logs
   */
  clearLogs(): void {
    this.requestLogs = [];
  }

  /**
   * Get proxy URL for tool configuration
   */
  getProxyUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  /**
   * Build provider-specific request configuration
   */
  private buildProviderRequest(
    provider: AIProvider,
    apiKey: string,
    originalPath: string,
    originalHeaders: http.IncomingHttpHeaders,
    requestBody: Buffer
  ): ProviderRequestConfig {
    const baseUrl = provider.baseUrl || this.getDefaultBaseUrl(provider);
    const targetUrl = new URL(originalPath, baseUrl);

    const baseHeaders: Record<string, string> = {
      ...this.extractHeaders(originalHeaders),
      host: targetUrl.hostname,
    };

    switch (provider.type) {
      case 'anthropic':
        return this.buildAnthropicRequest(provider, apiKey, targetUrl, baseHeaders, requestBody);

      case 'azure':
        return this.buildAzureRequest(provider, apiKey, targetUrl, baseHeaders, requestBody);

      case 'openai-compatible':
      case 'custom':
      default:
        return this.buildOpenAICompatibleRequest(
          provider,
          apiKey,
          targetUrl,
          baseHeaders,
          requestBody
        );
    }
  }

  /**
   * Get default base URL for provider type
   */
  private getDefaultBaseUrl(provider: AIProvider): string {
    switch (provider.type) {
      case 'anthropic':
        return 'https://api.anthropic.com';
      case 'azure':
        return provider.baseUrl || 'https://your-resource.openai.azure.com';
      case 'openai-compatible':
      case 'custom':
      default:
        if (provider.id === 'openai') {
          return 'https://api.openai.com';
        }
        if (provider.id === 'deepseek') {
          return 'https://api.deepseek.com';
        }
        if (provider.id === 'google' || provider.id === 'gemini') {
          return 'https://generativelanguage.googleapis.com';
        }
        return provider.baseUrl || 'https://api.openai.com';
    }
  }

  /**
   * Build OpenAI-compatible request
   */
  private buildOpenAICompatibleRequest(
    _provider: AIProvider,
    apiKey: string,
    targetUrl: URL,
    headers: Record<string, string>,
    body: Buffer
  ): ProviderRequestConfig {
    return {
      hostname: targetUrl.hostname,
      port: parseInt(targetUrl.port) || 443,
      path: targetUrl.pathname + targetUrl.search,
      headers: {
        ...headers,
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body,
    };
  }

  /**
   * Build Anthropic request
   * Anthropic uses x-api-key header and requires anthropic-version
   */
  private buildAnthropicRequest(
    provider: AIProvider,
    apiKey: string,
    targetUrl: URL,
    headers: Record<string, string>,
    body: Buffer
  ): ProviderRequestConfig {
    let path = targetUrl.pathname + targetUrl.search;

    if (!path.includes('/v1/')) {
      path = '/v1' + path;
    }

    const anthropicHeaders: Record<string, string> = {
      ...headers,
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    };

    delete anthropicHeaders['authorization'];

    return {
      hostname: targetUrl.hostname,
      port: parseInt(targetUrl.port) || 443,
      path,
      headers: anthropicHeaders,
      body,
    };
  }

  /**
   * Build Azure OpenAI request
   * Azure uses api-key header and requires deployment ID in path
   */
  private buildAzureRequest(
    provider: AIProvider,
    apiKey: string,
    targetUrl: URL,
    headers: Record<string, string>,
    body: Buffer
  ): ProviderRequestConfig {
    const config = provider.config || {};
    const deploymentId = config.deploymentId || provider.defaultModel || 'gpt-4';
    const apiVersion = config.apiVersion || '2024-02-15-preview';

    let path = targetUrl.pathname;

    if (!path.includes('/deployments/')) {
      const parsedBody = this.parseRequestBody(body);
      const model = parsedBody.model || deploymentId;
      path = `/deployments/${model}/chat/completions?api-version=${apiVersion}`;
    }

    const azureHeaders: Record<string, string> = {
      ...headers,
      'api-key': apiKey,
      'content-type': 'application/json',
    };

    delete azureHeaders['authorization'];

    return {
      hostname: targetUrl.hostname,
      port: parseInt(targetUrl.port) || 443,
      path,
      headers: azureHeaders,
      body,
    };
  }

  /**
   * Extract safe headers from original request
   */
  private extractHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
    const result: Record<string, string> = {};
    const skipHeaders = new Set([
      'host',
      'authorization',
      'x-api-key',
      'api-key',
      'content-length',
      'transfer-encoding',
    ]);

    for (const [key, value] of Object.entries(headers)) {
      if (skipHeaders.has(key.toLowerCase())) continue;
      if (Array.isArray(value)) {
        result[key] = value.join(', ');
      } else if (value) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const requestId = `req-${++this.requestCounter}`;
    const startTime = Date.now();

    let requestBody = Buffer.alloc(0);
    let responseBody = Buffer.alloc(0);

    req.on('data', chunk => {
      requestBody = Buffer.concat([requestBody, chunk]);
    });

    req.on('end', async () => {
      try {
        const activeProvider = await this.modelManager.getActiveProvider();

        if (!activeProvider) {
          this.sendError(res, 503, 'No active provider configured');
          this.logRequest({
            id: requestId,
            timestamp: new Date().toISOString(),
            method: req.method || 'GET',
            path: req.url || '/',
            headers: this.sanitizeHeaders(req.headers),
            requestSize: requestBody.length,
            responseStatus: 503,
            responseSize: 0,
            duration: Date.now() - startTime,
            success: false,
            error: 'No active provider',
          });
          return;
        }

        const apiKey = await this.modelManager.getAPIKey(activeProvider.id);

        if (!apiKey) {
          this.sendError(res, 503, 'No API key configured for active provider');
          this.logRequest({
            id: requestId,
            timestamp: new Date().toISOString(),
            method: req.method || 'GET',
            path: req.url || '/',
            providerId: activeProvider.id,
            headers: this.sanitizeHeaders(req.headers),
            requestSize: requestBody.length,
            responseStatus: 503,
            responseSize: 0,
            duration: Date.now() - startTime,
            success: false,
            error: 'No API key',
          });
          return;
        }

        const requestInfo = this.parseRequestBody(requestBody);

        const providerConfig = this.buildProviderRequest(
          activeProvider,
          apiKey,
          req.url || '/',
          req.headers,
          requestBody
        );

        const options: https.RequestOptions = {
          hostname: providerConfig.hostname,
          port: providerConfig.port,
          path: providerConfig.path,
          method: req.method,
          headers: providerConfig.headers,
        };

        const proxyReq = https.request(options, proxyRes => {
          proxyRes.on('data', chunk => {
            responseBody = Buffer.concat([responseBody, chunk]);
          });

          proxyRes.on('end', () => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            res.end(responseBody);

            this.stats.totalRequests++;
            this.stats.bytesReceived += requestBody.length;
            this.stats.bytesSent += responseBody.length;

            if (proxyRes.statusCode && proxyRes.statusCode < 400) {
              this.stats.successfulRequests++;
            } else {
              this.stats.failedRequests++;
            }

            this.logRequest({
              id: requestId,
              timestamp: new Date().toISOString(),
              method: req.method || 'GET',
              path: req.url || '/',
              providerId: activeProvider.id,
              model: requestInfo.model,
              headers: this.sanitizeHeaders(req.headers),
              requestSize: requestBody.length,
              responseStatus: proxyRes.statusCode || 200,
              responseSize: responseBody.length,
              duration: Date.now() - startTime,
              success: (proxyRes.statusCode || 200) < 400,
            });

            if (this.config.enableUsageTracking && requestInfo.model) {
              this.trackUsage(
                activeProvider.id,
                requestInfo.model,
                responseBody,
                proxyRes.statusCode || 200
              );
            }
          });
        });

        proxyReq.on('error', error => {
          console.error('[ProxyServer] Proxy request error:', error);
          this.sendError(res, 502, 'Bad Gateway');
          this.stats.totalRequests++;
          this.stats.failedRequests++;

          this.logRequest({
            id: requestId,
            timestamp: new Date().toISOString(),
            method: req.method || 'GET',
            path: req.url || '/',
            providerId: activeProvider.id,
            model: requestInfo.model,
            headers: this.sanitizeHeaders(req.headers),
            requestSize: requestBody.length,
            responseStatus: 502,
            responseSize: 0,
            duration: Date.now() - startTime,
            success: false,
            error: error.message,
          });
        });

        if (providerConfig.body && providerConfig.body.length > 0) {
          proxyReq.write(providerConfig.body);
        }
        proxyReq.end();
      } catch (error) {
        console.error('[ProxyServer] Error handling request:', error);
        this.sendError(res, 500, 'Internal Server Error');
        this.stats.totalRequests++;
        this.stats.failedRequests++;

        this.logRequest({
          id: requestId,
          timestamp: new Date().toISOString(),
          method: req.method || 'GET',
          path: req.url || '/',
          headers: this.sanitizeHeaders(req.headers),
          requestSize: requestBody.length,
          responseStatus: 500,
          responseSize: 0,
          duration: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  /**
   * Send error response
   */
  private sendError(res: http.ServerResponse, statusCode: number, message: string): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }

  /**
   * Sanitize headers (remove sensitive info)
   */
  private sanitizeHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (['authorization', 'x-api-key', 'api-key', 'cookie'].includes(key.toLowerCase())) {
        sanitized[key] = '***';
      } else if (Array.isArray(value)) {
        sanitized[key] = value.join(', ');
      } else if (value) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Parse request body to extract model info
   */
  private parseRequestBody(body: Buffer): { model?: string } {
    try {
      if (body.length === 0) return {};
      const data = JSON.parse(body.toString());
      return { model: data.model };
    } catch {
      return {};
    }
  }

  /**
   * Log request
   */
  private logRequest(log: RequestLog): void {
    if (this.config.enableLogging) {
      this.requestLogs.push(log);
      if (this.requestLogs.length > 1000) {
        this.requestLogs.shift();
      }
    }
  }

  /**
   * Track usage
   */
  private async trackUsage(
    providerId: string,
    model: string,
    responseBody: Buffer,
    _statusCode: number
  ): Promise<void> {
    try {
      const response = JSON.parse(responseBody.toString());
      const usage = response.usage;

      if (usage) {
        await this.modelManager.logUsage({
          providerId,
          model: model,
          inputTokens: usage.prompt_tokens || usage.input_tokens || 0,
          outputTokens: usage.completion_tokens || usage.output_tokens || 0,
        });
      }
    } catch (error) {
      console.error('[ProxyServer] Error tracking usage:', error);
    }
  }
}
