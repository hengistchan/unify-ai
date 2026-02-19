/**
 * Proxy Server
 * HTTP proxy server that intercepts AI API requests and routes them through configured providers
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';
import type { ModelManager } from './ModelManager';
import type { ProxyConfig, ProxyStats, ProxyStatus, RequestLog } from './types';

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
        console.log(
          `[ProxyServer] Started on http://${this.config.host}:${this.config.port}`
        );
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
      this.server!.close((error) => {
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
    // Update uptime
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
   * Handle incoming HTTP request
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const requestId = `req-${++this.requestCounter}`;
    const startTime = Date.now();

    let requestBody = Buffer.alloc(0);
    let responseBody = Buffer.alloc(0);

    // Collect request body
    req.on('data', (chunk) => {
      requestBody = Buffer.concat([requestBody, chunk]);
    });

    req.on('end', async () => {
      try {
        // Get active provider
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

        // Get API key for provider
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

        // Parse request to extract model info
        const requestInfo = this.parseRequestBody(requestBody);

        // Forward request to actual provider
        const targetUrl = new URL(req.url || '/', activeProvider.baseUrl || 'https://api.openai.com');

        const options: https.RequestOptions = {
          hostname: targetUrl.hostname,
          port: targetUrl.port || 443,
          path: targetUrl.pathname + targetUrl.search,
          method: req.method,
          headers: {
            ...req.headers,
            host: targetUrl.hostname,
            authorization: `Bearer ${apiKey}`,
          },
        };

        const proxyReq = https.request(options, (proxyRes) => {
          // Collect response body
          proxyRes.on('data', (chunk) => {
            responseBody = Buffer.concat([responseBody, chunk]);
          });

          proxyRes.on('end', () => {
            // Forward response headers
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            res.end(responseBody);

            // Update stats
            this.stats.totalRequests++;
            this.stats.bytesReceived += requestBody.length;
            this.stats.bytesSent += responseBody.length;

            if (proxyRes.statusCode && proxyRes.statusCode < 400) {
              this.stats.successfulRequests++;
            } else {
              this.stats.failedRequests++;
            }

            // Log request
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

            // Track usage if enabled
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

        proxyReq.on('error', (error) => {
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

        // Send request body
        if (requestBody.length > 0) {
          proxyReq.write(requestBody);
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
      if (key.toLowerCase() === 'authorization') {
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
      // Keep only last 1000 logs
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
    statusCode: number
  ): Promise<void> {
    try {
      // Parse response to extract usage info
      const response = JSON.parse(responseBody.toString());
      const usage = response.usage;

      if (usage) {
        await this.modelManager.logUsage({
          providerId,
          model: model,
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
        });
      }
    } catch (error) {
      console.error('[ProxyServer] Error tracking usage:', error);
    }
  }
}
