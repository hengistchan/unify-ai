/**
 * Proxy Control Component
 * UI for starting/stopping proxy server and viewing stats
 */

import { useEffect } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { Button, Card } from '../common';
import { Play, Square, Activity, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function ProxyControl() {
  const {
    proxyStatus,
    proxyStats,
    startProxy,
    stopProxy,
    loadProxyStatus,
    loadProxyStats,
    loading,
  } = useModelStore();

  useEffect(() => {
    loadProxyStatus();
    loadProxyStats();

    // Refresh stats every 5 seconds if running
    const interval = setInterval(() => {
      if (proxyStatus === 'running') {
        loadProxyStats();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [loadProxyStatus, loadProxyStats, proxyStatus]);

  const handleToggleProxy = async () => {
    try {
      if (proxyStatus === 'running') {
        await stopProxy();
      } else {
        await startProxy({ port: 8787, host: 'localhost' });
      }
    } catch (error) {
      console.error('Failed to toggle proxy:', error);
    }
  };

  const isRunning = proxyStatus === 'running';
  const isStarting = proxyStatus === 'starting' || proxyStatus === 'stopping';

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Wifi className="h-5 w-5 text-success" />
            ) : (
              <WifiOff className="h-5 w-5 text-text-secondary" />
            )}
            <div>
              <h3 className="font-semibold">Proxy Server</h3>
              <p className="text-sm text-text-secondary">
                {isRunning ? 'Running on http://localhost:8787' : 'Stopped'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleToggleProxy}
            disabled={isStarting || loading}
            variant={isRunning ? 'danger' : 'primary'}
            className="gap-2"
          >
            {isStarting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                {proxyStatus === 'starting' ? 'Starting...' : 'Stopping...'}
              </>
            ) : isRunning ? (
              <>
                <Square className="h-4 w-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Stats Grid */}
      {isRunning && proxyStats && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-text-secondary">Total Requests</p>
                <p className="text-lg font-bold">{proxyStats.totalRequests}</p>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-success" />
              <div>
                <p className="text-xs text-text-secondary">Success Rate</p>
                <p className="text-lg font-bold">
                  {proxyStats.totalRequests > 0
                    ? `${Math.round((proxyStats.successfulRequests / proxyStats.totalRequests) * 100)}%`
                    : '0%'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-warning" />
              <div>
                <p className="text-xs text-text-secondary">Data Transferred</p>
                <p className="text-lg font-bold">
                  {((proxyStats.bytesReceived + proxyStats.bytesSent) / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-info" />
              <div>
                <p className="text-xs text-text-secondary">Uptime</p>
                <p className="text-lg font-bold">{formatUptime(proxyStats.uptime)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Configuration Info */}
      <Card className="p-4">
        <h4 className="mb-2 text-sm font-semibold">How to Configure AI Tools</h4>
        <div className="space-y-2 text-sm text-text-secondary">
          <p>1. Start the proxy server above</p>
          <p>2. Configure your AI tool to use:</p>
          <div className="rounded bg-bg-secondary p-2 font-mono text-xs">
            <div>Base URL: http://localhost:8787/v1</div>
            <div>API Key: (any value, proxy will inject real key)</div>
          </div>
          <p>3. Select active provider in the Models page</p>
          <p>4. All requests will route through the selected provider</p>
        </div>
      </Card>

      {/* Error Display */}
      {proxyStats?.lastError && (
        <Card className="border-error bg-error-muted p-3">
          <p className="text-sm text-error">
            <strong>Error:</strong> {proxyStats.lastError}
          </p>
        </Card>
      )}
    </div>
  );
}
