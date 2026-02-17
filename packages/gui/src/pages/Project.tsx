/**
 * Project Page
 * Project overview with detected tools and configuration summary
 */

import { useState } from 'react';
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
  Eye,
  Loader2,
} from 'lucide-react';
import { Button, Badge } from '@/components/common';
import {
  useAppStore,
  selectCurrentProject,
  selectDetectedTools,
  selectSyncStatus,
  selectSyncPreview,
  selectSyncLoading,
  selectUnifiedConfig,
} from '@/stores/appStore';
import { SyncPreviewDialog } from '@/components/SyncPreviewDialog';
import { cn } from '@/lib/utils';

export function Project() {
  const navigate = useNavigate();
  const currentProject = useAppStore(selectCurrentProject);
  const detectedTools = useAppStore(selectDetectedTools);
  const syncStatus = useAppStore(selectSyncStatus);
  const syncPreview = useAppStore(selectSyncPreview);
  const syncLoading = useAppStore(selectSyncLoading);
  const unifiedConfig = useAppStore(selectUnifiedConfig);
  const {
    previewSync,
    executeSync,
    clearSyncPreview,
    addToast,
    lastSyncTime,
  } = useAppStore();

  const [showSyncDialog, setShowSyncDialog] = useState(false);

  // Preview sync button handler
  const handlePreviewSync = async () => {
    if (detectedTools.length === 0) {
      addToast({
        type: 'warning',
        title: 'No Tools',
        message: 'No tools detected to sync',
      });
      return;
    }

    // Use first detected tool as source, others as targets
    const detectedList = detectedTools.filter((t) => t.detected);
    if (detectedList.length < 2) {
      addToast({
        type: 'info',
        title: 'Need Multiple Tools',
        message: 'At least 2 detected tools are needed for sync',
      });
      return;
    }

    const sourceTool = detectedList[0].id;
    const targetTools = detectedList.slice(1).map((t) => t.id);

    await previewSync(sourceTool, targetTools);
    setShowSyncDialog(true);
  };

  // Execute sync after preview confirmation
  const handleConfirmSync = async () => {
    await executeSync();
    setShowSyncDialog(false);
  };

  const handleCloseDialog = () => {
    setShowSyncDialog(false);
    clearSyncPreview();
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

  const detectedCount = detectedTools.filter((t) => t.detected).length;

  // Calculate stats from unified config
  const rulesCount = unifiedConfig?.rules?.length ?? 0;
  const mcpServersCount = unifiedConfig?.mcp?.servers?.length ?? 0;
  const configFilesCount = detectedTools.filter((t) => t.detected).reduce((acc, t) => {
    if (t.hasRules) acc++;
    if (t.hasMcp) acc++;
    if (t.hasSettings) acc++;
    return acc;
  }, 0);

  return (
    <div className="p-6 animate-fade-in">
      {/* Sync Preview Dialog */}
      <SyncPreviewDialog
        open={showSyncDialog}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmSync}
        preview={syncPreview}
        loading={syncLoading}
      />

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
            onClick={handlePreviewSync}
            disabled={syncLoading || detectedCount < 2}
          >
            {syncLoading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Eye className="w-4 h-4 mr-1" />
            )}
            {syncLoading ? 'Previewing...' : 'Preview Sync'}
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
          <p className="text-2xl font-bold text-text-primary">{configFilesCount || '-'}</p>
        </div>
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <p className="text-text-tertiary text-sm mb-1">MCP Servers</p>
          <p className="text-2xl font-bold text-text-primary">{mcpServersCount || '-'}</p>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Detected Tools</h2>
        {detectedTools.length === 0 ? (
          <div className="text-center py-8 text-text-tertiary">
            <p>No AI tools detected in this project</p>
            <p className="text-sm mt-1">Open a project with AI tool configurations to get started</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {detectedTools.map((tool) => (
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
        )}
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
            <span className="text-text-tertiary">{rulesCount > 0 ? `${rulesCount} files` : '-'}</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-text-tertiary" />
              <span className="text-text-secondary">MCP Servers</span>
            </div>
            <span className="text-text-tertiary">{mcpServersCount > 0 ? `${mcpServersCount} servers` : '-'}</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-text-tertiary" />
              <span className="text-text-secondary">Settings</span>
            </div>
            <span className="text-text-tertiary">{detectedCount > 0 ? `${detectedCount} tools configured` : '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
