/**
 * Project Page
 * Project overview with detected tools and configuration summary
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  RefreshCw,
  Check,
  AlertCircle,
  FileText,
  Server,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { Button, Badge, ToolIcon } from '@/components/common';
import {
  useAppStore,
  selectCurrentProject,
  selectDetectedTools,
  selectSyncStatus,
  selectSyncPreview,
  selectSyncLoading,
  selectUnifiedConfig,
  selectSyncPreferences,
  selectImportLoading,
  selectExportLoading,
} from '@/stores/appStore';
import { SyncPreviewDialog } from '@/components/SyncPreviewDialog';
import { SyncSettingsDialog } from '@/components/SyncSettingsDialog';
import { SyncModeDialog, type SyncMode } from '@/components/SyncModeDialog';
import { UnifiedConfigDialog } from '@/components/UnifiedConfigDialog';
import { cn } from '@/lib/utils';

export function Project() {
  const navigate = useNavigate();
  const currentProject = useAppStore(selectCurrentProject);
  const detectedTools = useAppStore(selectDetectedTools);
  const syncStatus = useAppStore(selectSyncStatus);
  const syncPreview = useAppStore(selectSyncPreview);
  const syncLoading = useAppStore(selectSyncLoading);
  const unifiedConfig = useAppStore(selectUnifiedConfig);
  const syncPreferences = useAppStore(selectSyncPreferences);
  const importLoading = useAppStore(selectImportLoading);
  const exportLoading = useAppStore(selectExportLoading);
  const {
    previewSync,
    executeSync,
    clearSyncPreview,
    lastSyncTime,
    refreshTools,
    updateSyncPreferences,
    importConfig,
    exportConfig,
  } = useAppStore();

  const [showSyncModeDialog, setShowSyncModeDialog] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [showSyncPreview, setShowSyncPreview] = useState(false);
  const [showUnifiedConfigDialog, setShowUnifiedConfigDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const detectedCount = detectedTools.filter(t => t.detected).length;

  // Handle sync mode selection
  const handleSyncModeSelect = (mode: SyncMode) => {
    setShowSyncModeDialog(false);
    if (mode === 'direct-sync') {
      // Always show settings dialog to allow user to change selection
      setShowSyncSettings(true);
    } else {
      // Unified config mode
      setShowUnifiedConfigDialog(true);
    }
  };

  // Execute sync after preview confirmation
  const handleConfirmSync = async () => {
    await executeSync();
    setShowSyncPreview(false);
  };

  const handleCloseSyncPreview = () => {
    setShowSyncPreview(false);
    clearSyncPreview();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshTools();
    setRefreshing(false);
  };

  const handleSyncSettingsConfirm = async (sourceTool: string, targetTools: string[]) => {
    updateSyncPreferences({ sourceTool, targetTools });
    await previewSync(sourceTool, targetTools);
    setShowSyncSettings(false);
    setShowSyncPreview(true);
  };

  const handleImportConfirm = async (options: { mergeMultiple: boolean; sourceTool?: string }) => {
    const result = await importConfig(options);
    return result;
  };

  const handleExportConfirm = async (targetTools: string[], options: { createBackup: boolean }) => {
    const result = await exportConfig(targetTools, options);
    return result;
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
        <Button onClick={() => navigate('/')}>Go to Home</Button>
      </div>
    );
  }

  // Calculate stats from unified config
  const rulesCount = unifiedConfig?.rules?.length ?? 0;
  const mcpServersCount = unifiedConfig?.mcp?.servers?.length ?? 0;
  const configFilesCount = detectedTools
    .filter(t => t.detected)
    .reduce((acc, t) => {
      if (t.hasRules) acc++;
      if (t.hasMcp) acc++;
      if (t.hasSettings) acc++;
      return acc;
    }, 0);

  return (
    <div className="p-6 animate-fade-in">
      {/* Sync Mode Dialog */}
      <SyncModeDialog
        open={showSyncModeDialog}
        onClose={() => setShowSyncModeDialog(false)}
        onSelectMode={handleSyncModeSelect}
        hasUnifiedConfig={!!unifiedConfig}
        detectedToolsCount={detectedCount}
      />

      {/* Sync Settings Dialog (for direct sync mode) */}
      <SyncSettingsDialog
        open={showSyncSettings}
        onClose={() => setShowSyncSettings(false)}
        onConfirm={handleSyncSettingsConfirm}
        detectedTools={detectedTools}
        initialSource={syncPreferences.sourceTool || undefined}
        initialTargets={syncPreferences.targetTools}
      />

      {/* Sync Preview Dialog */}
      <SyncPreviewDialog
        open={showSyncPreview}
        onClose={handleCloseSyncPreview}
        onConfirm={handleConfirmSync}
        preview={syncPreview}
        loading={syncLoading}
      />

      {/* Unified Config Dialog */}
      <UnifiedConfigDialog
        open={showUnifiedConfigDialog}
        onClose={() => setShowUnifiedConfigDialog(false)}
        detectedTools={detectedTools}
        unifiedConfig={unifiedConfig}
        onImport={handleImportConfirm}
        onExport={handleExportConfirm}
        importLoading={importLoading}
        exportLoading={exportLoading}
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
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn('w-4 h-4 mr-1', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowSyncModeDialog(true)}
            disabled={detectedCount < 1}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Sync Config
          </Button>
        </div>
      </div>

      {/* Sync Status */}
      {(syncStatus !== 'idle' || lastSyncTime) && (
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg mb-6 text-sm',
            syncStatus === 'success' && 'bg-success-muted text-success',
            syncStatus === 'error' && 'bg-error-muted text-error',
            syncStatus === 'syncing' && 'bg-info-muted text-info',
            syncStatus === 'idle' && 'bg-bg-tertiary text-text-tertiary'
          )}
        >
          {syncStatus === 'success' && <Check className="w-4 h-4" />}
          {syncStatus === 'error' && <AlertCircle className="w-4 h-4" />}
          {syncStatus === 'syncing' && <RefreshCw className="w-4 h-4 animate-spin" />}
          {syncStatus === 'idle' && lastSyncTime && <Check className="w-4 h-4" />}
          <span>
            {syncStatus === 'syncing' && 'Syncing configurations...'}
            {syncStatus === 'success' && 'Sync completed successfully'}
            {syncStatus === 'error' && 'Sync failed'}
            {syncStatus === 'idle' &&
              lastSyncTime &&
              `Last synced: ${new Date(lastSyncTime).toLocaleString()}`}
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
            <p className="text-sm mt-1">
              Open a project with AI tool configurations to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {detectedTools.map(tool => (
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
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    tool.detected ? 'bg-primary-muted' : 'bg-bg-tertiary'
                  )}
                >
                  <ToolIcon toolId={tool.id} size="sm" />
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
                {tool.detected && <ChevronRight className="w-5 h-5 text-text-tertiary" />}
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
            <span className="text-text-tertiary">
              {rulesCount > 0 ? `${rulesCount} files` : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-text-tertiary" />
              <span className="text-text-secondary">MCP Servers</span>
            </div>
            <span className="text-text-tertiary">
              {mcpServersCount > 0 ? `${mcpServersCount} servers` : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-text-tertiary" />
              <span className="text-text-secondary">Settings</span>
            </div>
            <span className="text-text-tertiary">
              {detectedCount > 0 ? `${detectedCount} tools configured` : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
