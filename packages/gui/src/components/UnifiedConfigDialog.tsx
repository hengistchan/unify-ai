/**
 * Unified Config Dialog
 * Manage unified.json - import from tools, export to tools
 */

import { useState } from 'react';
import { X, FileJson, Download, Upload, Check, AlertCircle } from 'lucide-react';
import { Button, Badge, ToolIcon } from '@/components/common';
import type { DetectedTool, UnifiedConfig } from '@/stores/appStore';
import { cn } from '@/lib/utils';

interface UnifiedConfigDialogProps {
  open: boolean;
  onClose: () => void;
  detectedTools: DetectedTool[];
  unifiedConfig: UnifiedConfig | null;
  onImport: (options: { mergeMultiple: boolean; sourceTool?: string }) => Promise<{ success: boolean }>;
  onExport: (targetTools: string[], options: { createBackup: boolean }) => Promise<{ success: boolean }>;
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
  const [importSource, setImportSource] = useState<string>('');
  const [exportTargets, setExportTargets] = useState<Set<string>>(new Set());
  const [createBackup, setCreateBackup] = useState(true);

  const detectedList = detectedTools.filter((t) => t.detected);

  // Config stats
  const rulesCount = unifiedConfig?.rules?.length ?? 0;
  const mcpCount = unifiedConfig?.mcp?.servers?.length ?? 0;
  const hasSettings = unifiedConfig?.settings !== undefined;
  const commandsCount = unifiedConfig?.commands?.length ?? 0;

  if (!open) return null;

  const handleImport = async () => {
    const result = await onImport({
      mergeMultiple: !importSource,
      sourceTool: importSource || undefined,
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
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

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
              {step === 'import' && 'Import from Tool'}
              {step === 'export' && 'Export to Tools'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bg-hover rounded transition-colors"
          >
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
                    <p className="text-xs text-text-tertiary">Your centralized configuration file</p>
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
                      <p className="text-lg font-bold text-text-primary">{hasSettings ? '✓' : '-'}</p>
                      <p className="text-xs text-text-tertiary">Settings</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-warning-muted rounded text-warning text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>No unified config yet. Import from a tool to create one.</span>
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
                    <h4 className="font-medium text-text-primary">Import from Tool</h4>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Read configuration from a tool into unified.json
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
                  <div className={cn(
                    'p-2 rounded-lg',
                    unifiedConfig ? 'bg-success-muted' : 'bg-bg-secondary'
                  )}>
                    <Upload className={cn('w-5 h-5', unifiedConfig ? 'text-success' : 'text-text-tertiary')} />
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
                <h3 className="text-sm font-medium text-text-primary mb-3">
                  Select source tool to import from:
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {detectedList.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => setImportSource(tool.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-all',
                        importSource === tool.id
                          ? 'bg-primary-muted border-primary'
                          : 'bg-bg-tertiary border-border hover:border-border-hover'
                      )}
                    >
                      <ToolIcon toolId={tool.id} size="sm" />
                      <div className="flex-1 text-left">
                        <div className="font-medium text-text-primary">{tool.name}</div>
                        <div className="text-xs text-text-tertiary truncate">{tool.configPath}</div>
                      </div>
                      {importSource === tool.id && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-border">
                <Button variant="secondary" onClick={() => setStep('overview')}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleImport}
                  disabled={!importSource || importLoading}
                  loading={importLoading}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Import
                </Button>
              </div>
            </div>
          )}

          {step === 'export' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-3">
                  Select target tools to export to:
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {detectedList.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => toggleExportTarget(tool.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-all',
                        exportTargets.has(tool.id)
                          ? 'bg-success-muted border-success'
                          : 'bg-bg-tertiary border-border hover:border-border-hover'
                      )}
                    >
                      <ToolIcon toolId={tool.id} size="sm" />
                      <div className="flex-1 text-left">
                        <div className="font-medium text-text-primary">{tool.name}</div>
                        <div className="text-xs text-text-tertiary truncate">{tool.configPath}</div>
                      </div>
                      {exportTargets.has(tool.id) && (
                        <Check className="w-5 h-5 text-success" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="p-3 bg-bg-tertiary border border-border rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createBackup}
                    onChange={(e) => setCreateBackup(e.target.checked)}
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
                  Export
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
