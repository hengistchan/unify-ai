/**
 * Proxy Server IPC Handlers
 * Handles all IPC communication for proxy server control
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './channels';
import { ProxyServer } from '@unify-ai/core/model';
import type { ModelManager } from '@unify-ai/core/model';

let proxyServer: ProxyServer | null = null;

/**
 * Initialize ProxyServer instance
 */
export function initializeProxyServer(modelManager: ModelManager): ProxyServer {
  if (!proxyServer) {
    console.log('[Proxy IPC] Initializing ProxyServer...');
    proxyServer = new ProxyServer(modelManager);
    console.log('[Proxy IPC] ProxyServer initialized');
  }
  return proxyServer;
}

/**
 * Get ProxyServer instance
 */
function getProxyServer(): ProxyServer {
  if (!proxyServer) {
    throw new Error('ProxyServer not initialized. Call initializeProxyServer() first.');
  }
  return proxyServer;
}

/**
 * Register all proxy IPC handlers
 */
export function registerProxyIpcHandlers(): void {
  console.log('[Proxy IPC] Registering proxy handlers...');

  // Start proxy server
  ipcMain.handle(IPC_CHANNELS.START_PROXY, async (_event, config?: any) => {
    console.log('[Proxy IPC] Starting proxy server...');
    const proxy = getProxyServer();
    await proxy.start();
    console.log('[Proxy IPC] Proxy server started');
    return { success: true, url: proxy.getProxyUrl() };
  });

  // Stop proxy server
  ipcMain.handle(IPC_CHANNELS.STOP_PROXY, async () => {
    console.log('[Proxy IPC] Stopping proxy server...');
    const proxy = getProxyServer();
    await proxy.stop();
    console.log('[Proxy IPC] Proxy server stopped');
    return { success: true };
  });

  // Get proxy status
  ipcMain.handle(IPC_CHANNELS.GET_PROXY_STATUS, async () => {
    const proxy = getProxyServer();
    const status = proxy.getStatus();
    console.log('[Proxy IPC] Proxy status:', status);
    return status;
  });

  // Get proxy stats
  ipcMain.handle(IPC_CHANNELS.GET_PROXY_STATS, async () => {
    const proxy = getProxyServer();
    const stats = proxy.getStats();
    return stats;
  });

  // Get request logs
  ipcMain.handle(IPC_CHANNELS.GET_REQUEST_LOGS, async (_event, limit?: number) => {
    const proxy = getProxyServer();
    const logs = proxy.getRequestLogs(limit);
    console.log(`[Proxy IPC] Retrieved ${logs.length} request logs`);
    return logs;
  });

  // Clear request logs
  ipcMain.handle(IPC_CHANNELS.CLEAR_REQUEST_LOGS, async () => {
    const proxy = getProxyServer();
    proxy.clearLogs();
    console.log('[Proxy IPC] Request logs cleared');
    return { success: true };
  });

  console.log('[Proxy IPC] All proxy handlers registered');
}

/**
 * Cleanup ProxyServer
 */
export async function cleanupProxyServer(): Promise<void> {
  if (proxyServer) {
    console.log('[Proxy IPC] Cleaning up ProxyServer...');
    const status = proxyServer.getStatus();
    if (status === 'running') {
      await proxyServer.stop();
    }
    proxyServer = null;
    console.log('[Proxy IPC] ProxyServer cleaned up');
  }
}
