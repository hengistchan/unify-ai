/**
 * Project Page
 * Project overview with detected tools and configuration summary
 */

import { useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  RefreshCw,
  Upload,
  Download,
  Check,
  AlertCircle,
  FileText,
  Server,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { Button, Badge } from '@/components/common';
import { useAppStore, selectCurrentProject, selectDetectedTools, selectSyncStatus } from '@/stores/appStore';
import { cn } from '@/lib/utils';

// Mock detected tools for demonstration
const mockDetectedTools = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    detected: true,
    configPath: '.claude/',
    hasRules: true,
    hasMcp: true,
    hasSettings: true,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    detected: true,
    configPath: '.cursor/',
    hasRules: true,
    hasMcp: false,
    hasSettings: true,
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    detected: true,
    configPath: '.github/copilot-instructions.md',
    hasRules: true,
    hasMcp: false,
    hasSettings: false,
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    detected: false,
    hasRules: false,
    hasMcp: false,
    hasSettings: false,
  },
];

export function Project() {
  const navigate = useNavigate();
  const currentProject = useAppStore(selectCurrentProject);
  const detectedTools = useAppStore(selectDetectedTools);
  const syncStatus = useAppStore(selectSyncStatus);
  const { setSyncStatus, setLastSyncTime, addToast, lastSyncTime } = useAppStore();

  // Use mock data if no tools detected
  const tools = detectedTools.length > 0 ? detectedTools : mockDetectedTools;

  const handleSync = async () => {
    setSyncStatus('syncing');
    // Simulate sync
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSyncStatus('success');
    setLastSyncTime(new Date().toISOString());
    addToast({
      type: 'success',
      title: 'Sync complete',
      message: 'All configurations have been synchronized',
    });
    // Reset to idle after showing success
    setTimeout(() => setSyncStatus('idle'), 3000);
  };

  const handleImport = () => {
    addToast({
      type: 'info',
      title: 'Coming soon',
      message: 'Import feature is in development',
    });
  };

  const handleExport = () => {
    addToast({
      type: 'info',
      title: 'Coming soon',
      message: 'Export feature is in development',
    });
  };

  const handleToolClick = (toolId: string) => {
    navigate(`/project/tool/${toolId}`);
  };

  // Redirect to home if no project
  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <FolderOpen className="w-16 h-16 text-text-tertiary mb-4" />
        <h2 className="text-xl font-semibold text-text-secondary mb-2">No Project Open</h2>
        <p className="text-text-tertiary mb-4">Open a project to manage AI tool configurations</p>
        <Button onClick={() => navigate('/')}>
          Go to Home
        </Button>
      </div>
    );
  }

  const detectedCount = tools.filter((t) => t.detected).length;

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Project Overview</h1>
          <div className="flex items-center gap-2 text-text-tertiary">
            <FolderOpen className="w-4 h-4" />
            <span className="text-sm font-mono">{currentProject}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleImport}
          >
            <Upload className="w-4 h-4 mr-1" />
            Import
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSync}
            disabled={syncStatus === 'syncing'}
          >
            <RefreshCw className={cn('w-4 h-4 mr-1', syncStatus === 'syncing' && 'animate-spin')} />
            {syncStatus === 'syncing' ? 'Syncing...' : 'Sync'}
          </Button>
        </div>
      </div>

      {/* Sync Status */}
      {(syncStatus !== 'idle' || lastSyncTime) && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg mb-6 text-sm',
          syncStatus === 'success' && 'bg-success-muted text-success',
          syncStatus === 'error' && 'bg-error-muted text-error',
          syncStatus === 'syncing' && 'bg-info-muted text-info',
          syncStatus === 'idle' && 'bg-bg-tertiary text-text-tertiary'
        )}>
          {syncStatus === 'success' && <Check className="w-4 h-4" />}
          {syncStatus === 'error' && <AlertCircle className="w-4 h-4" />}
          {syncStatus === 'syncing' && <RefreshCw className="w-4 h-4 animate-spin" />}
          {syncStatus === 'idle' && lastSyncTime && <Check className="w-4 h-4" />}
          <span>
            {syncStatus === 'syncing' && 'Syncing configurations...'}
            {syncStatus === 'success' && 'Sync completed successfully'}
            {syncStatus === 'error' && 'Sync failed'}
            {syncStatus === 'idle' && lastSyncTime && `Last synced: ${new Date(lastSyncTime).toLocaleString()}`}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <p className="text-text-tertiary text-sm mb-1">Detected Tools</p>
          <p className="text-2xl font-bold text-text-primary">{detectedCount}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <p className="text-text-tertiary text-sm mb-1">Config Files</p>
          <p className="text-2xl font-bold text-text-primary">12</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <p className="text-text-tertiary text-sm mb-1">MCP Servers</p>
          <p className="text-2xl font-bold text-text-primary">5</p>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Detected Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => tool.detected && handleToolClick(tool.id)}
              disabled={!tool.detected}
              className={cn(
                'flex items-center gap-4 p-4 bg-bg-secondary border border-border rounded-lg text-left transition-all',
                tool.detected
                  ? 'hover:bg-bg-elevated hover:border-border-hover cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                tool.detected ? 'bg-primary-muted' : 'bg-bg-tertiary'
              )}>
                <span className="text-lg">
                  {tool.id === 'claude-code' && '🤖'}
                  {tool.id === 'cursor' && '⚡'}
                  {tool.id === 'copilot' && '🐙'}
                  {tool.id === 'windsurf' && '🌊'}
                  {tool.id === 'codex' && '📝'}
                  {tool.id === 'cline' && '📋'}
                  {tool.id === 'aider' && '🤝'}
                  {tool.id === 'continue' && '▶️'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-text-primary truncate">{tool.name}</h3>
                  {tool.detected ? (
                    <Badge variant="success">Detected</Badge>
                  ) : (
                    <Badge variant="default">Not Found</Badge>
                  )}
                </div>
                {tool.detected && (
                  <div className="flex items-center gap-3 mt-1">
                    {tool.hasRules && (
                      <span className="flex items-center gap-1 text-xs text-text-tertiary">
                        <FileText className="w-3 h-3" />
                        Rules
                      </span>
                    )}
                    {tool.hasMcp && (
                      <span className="flex items-center gap-1 text-xs text-text-tertiary">
                        <Server className="w-3 h-3" />
                        MCP
                      </span>
                    )}
                    {tool.hasSettings && (
                      <span className="flex items-center gap-1 text-xs text-text-tertiary">
                        <Settings className="w-3 h-3" />
                        Settings
                      </span>
                    )}
                  </div>
                )}
              </div>
              {tool.detected && (
                <ChevronRight className="w-5 h-5 text-text-tertiary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Config Summary */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Configuration Summary</h2>
        <div className="bg-bg-secondary border border-border rounded-lg divide-y divide-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-text-tertiary" />
              <span className="text-text-secondary">Rules Files</span>
            </div>
            <span className="text-text-tertiary">8 files</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-text-tertiary" />
              <span className="text-text-secondary">MCP Servers</span>
            </div>
            <span className="text-text-tertiary">5 servers</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-text-tertiary" />
              <span className="text-text-secondary">Settings</span>
            </div>
            <span className="text-text-tertiary">3 tools configured</span>
          </div>
        </div>
      </div>
    </div>
  );
}
