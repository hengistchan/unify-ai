/**
 * Unified Config Dialog
 * Manage unified.json - import from tools, export to tools
 */

import { useState } from 'react';
import { X, FileJson, Download, Upload, Check, AlertCircle, AlertTriangle, Plus } from 'lucide-react';
import { Button, ToolIcon } from '@/components/common';
import type { DetectedTool, UnifiedConfig } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import { getToolName } from '@/components/common/ToolIcon';

// All supported tools
const SUPPORTED_TOOLS = [
  'cursor',
  'claude-code',
  'copilot',
  'windsurf',
  'codex',
  'cline',
  'aider',
  'continue',
] as const;

interface UnifiedConfigDialogProps {
  open: boolean;
  onClose: () => void;
  detectedTools: DetectedTool[];
  unifiedConfig: UnifiedConfig | null;
  onImport: (options: {
    mergeMultiple: boolean;
    sourceTool?: string;
  }) => Promise<{ success: boolean }>;
  onExport: (
    targetTools: string[],
    options: { createBackup: boolean }
  ) => Promise<{ success: boolean }>;
  importLoading: boolean;
  exportLoading: boolean;
}

export function UnifiedConfigDialog({
  open,
  onClose,
  detectedTools,
  unifiedConfig,
  onImport,
  onExport,
  importLoading,
  exportLoading,
}: UnifiedConfigDialogProps) {
  const [step, setStep] = useState<'overview' | 'import' | 'export'>('overview');
  const [importSources, setImportSources] = useState<Set<string>>(new Set());
  const [exportTargets, setExportTargets] = useState<Set<string>>(new Set());
  const [createBackup, setCreateBackup] = useState(true);

  const detectedList = detectedTools.filter(t => t.detected);

  // Config stats
  const rulesCount = unifiedConfig?.rules?.length ?? 0;
  const mcpCount = unifiedConfig?.mcp?.servers?.length ?? 0;
  const hasSettings = unifiedConfig?.settings !== undefined;
  const commandsCount = unifiedConfig?.commands?.length ?? 0;

  if (!open) return null;

  const handleImport = async () => {
    const result = await onImport({
      mergeMultiple: importSources.size > 1,
      sourceTool: importSources.size === 1 ? Array.from(importSources)[0] : undefined,
    });
    if (result.success) {
      setStep('overview');
    }
  };

  const handleExport = async () => {
    if (exportTargets.size === 0) return;
    const result = await onExport(Array.from(exportTargets), { createBackup });
    if (result.success) {
      setStep('overview');
    }
  };

  const toggleImportSource = (toolId: string) => {
    const newSources = new Set(importSources);
    if (newSources.has(toolId)) {
      newSources.delete(toolId);
    } else {
      newSources.add(toolId);
    }
    setImportSources(newSources);
  };

  const toggleExportTarget = (toolId: string) => {
    const newTargets = new Set(exportTargets);
    if (newTargets.has(toolId)) {
      newTargets.delete(toolId);
    } else {
      newTargets.add(toolId);
    }
    setExportTargets(newTargets);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-bg-secondary border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep('overview')}
              className={cn(
                'text-sm px-3 py-1 rounded transition-colors',
                step === 'overview'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              Overview
            </button>
            <span className="text-text-tertiary">/</span>
            <span className="text-sm text-text-secondary">
              {step === 'import' && 'Import from Tools'}
              {step === 'export' && 'Export to Tools'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-bg-hover rounded transition-colors">
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {step === 'overview' && (
            <div className="space-y-6">
              {/* Unified Config Status */}
              <div className="bg-bg-tertiary border border-border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <FileJson className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-medium text-text-primary">unified.json</h3>
                    <p className="text-xs text-text-tertiary">
                      Your centralized configuration file
                    </p>
                  </div>
                </div>

                {unifiedConfig ? (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-2 bg-bg-secondary rounded">
                      <p className="text-lg font-bold text-text-primary">{rulesCount}</p>
                      <p className="text-xs text-text-tertiary">Rules</p>
                    </div>
                    <div className="text-center p-2 bg-bg-secondary rounded">
                      <p className="text-lg font-bold text-text-primary">{mcpCount}</p>
                      <p className="text-xs text-text-tertiary">MCP</p>
                    </div>
                    <div className="text-center p-2 bg-bg-secondary rounded">
                      <p className="text-lg font-bold text-text-primary">{commandsCount}</p>
                      <p className="text-xs text-text-tertiary">Commands</p>
                    </div>
                    <div className="text-center p-2 bg-bg-secondary rounded">
                      <p className="text-lg font-bold text-text-primary">
                        {hasSettings ? '✓' : '-'}
                      </p>
                      <p className="text-xs text-text-tertiary">Settings</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-warning-muted rounded text-warning text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>No unified config yet. Import from tools to create one.</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setStep('import')}
                  className="flex items-center gap-3 p-4 bg-bg-tertiary border border-border rounded-lg hover:border-border-hover transition-colors text-left"
                >
                  <div className="p-2 bg-primary-muted rounded-lg">
                    <Download className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary">Import from Tools</h4>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Read from multiple tools and merge
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setStep('export')}
                  disabled={!unifiedConfig}
                  className={cn(
                    'flex items-center gap-3 p-4 border rounded-lg text-left transition-colors',
                    unifiedConfig
                      ? 'bg-bg-tertiary border-border hover:border-border-hover'
                      : 'bg-bg-tertiary border-border opacity-50 cursor-not-allowed'
                  )}
                >
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      unifiedConfig ? 'bg-success-muted' : 'bg-bg-secondary'
                    )}
                  >
                    <Upload
                      className={cn(
                        'w-5 h-5',
                        unifiedConfig ? 'text-success' : 'text-text-tertiary'
                      )}
                    />
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary">Export to Tools</h4>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Write unified.json to selected tools
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'import' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-2">
                  Select source tools to import from:
                </h3>
                <p className="text-xs text-text-tertiary mb-3">
                  Select multiple tools to merge their configurations
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {detectedList.map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => toggleImportSource(tool.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-all',
                        importSources.has(tool.id)
                          ? 'bg-primary-muted border-primary'
                          : 'bg-bg-tertiary border-border hover:border-border-hover'
                      )}
                    >
                      <ToolIcon toolId={tool.id} size="sm" />
                      <span className="font-medium text-text-primary">{tool.name}</span>
                      {importSources.has(tool.id) && (
                        <Check className="w-5 h-5 text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Merge info */}
              {importSources.size > 1 && (
                <div className="p-3 bg-info-muted border border-info/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-info mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-info">
                      <p className="font-medium">Merge mode enabled</p>
                      <p className="text-xs mt-1">
                        Configurations from {importSources.size} tools will be merged. Conflicts
                        will be resolved by keeping the most recent.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-border">
                <Button variant="secondary" onClick={() => setStep('overview')}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={importSources.size === 0 || importLoading}
                  loading={importLoading}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Import {importSources.size > 0 && `(${importSources.size})`}
                </Button>
              </div>
            </div>
          )}

          {step === 'export' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-2">
                  Select target tools to export to:
                </h3>
                <p className="text-xs text-text-tertiary mb-3">
                  unified.json will be written to selected tools
                </p>

                {/* Get detected tool IDs */}
                {(() => {
                  const detectedToolIds = new Set(detectedList.map(t => t.id));
                  const allToolsWithStatus = SUPPORTED_TOOLS.map(toolId => ({
                    id: toolId,
                    name: getToolName(toolId),
                    isDetected: detectedToolIds.has(toolId),
                  }));

                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {allToolsWithStatus.map(tool => (
                        <button
                          key={tool.id}
                          onClick={() => toggleExportTarget(tool.id)}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                            exportTargets.has(tool.id)
                              ? 'bg-success-muted border-success'
                              : 'bg-bg-tertiary border-border hover:border-border-hover'
                          )}
                        >
                          <ToolIcon toolId={tool.id} size="sm" />
                          <span className="font-medium text-text-primary flex-1">{tool.name}</span>
                          <div className="flex items-center gap-1">
                            {tool.isDetected ? (
                              <AlertTriangle className="w-3 h-3 text-warning" />
                            ) : (
                              <Plus className="w-3 h-3 text-success" />
                            )}
                            {exportTargets.has(tool.id) && (
                              <Check className="w-5 h-5 text-success" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Options */}
              <div className="p-3 bg-bg-tertiary border border-border rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createBackup}
                    onChange={e => setCreateBackup(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm text-text-secondary">Create backup before export</span>
                </label>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border">
                <Button variant="secondary" onClick={() => setStep('overview')}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleExport}
                  disabled={exportTargets.size === 0 || exportLoading}
                  loading={exportLoading}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Export {exportTargets.size > 0 && `(${exportTargets.size})`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
