/**
 * Export Dialog
 * Allows users to export unified configuration to target tools
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Check, Download, Loader2, AlertCircle, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/common';
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
  'opencode',
] as const;

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (targetTools: string[], options: { createBackup: boolean }) => void;
  detectedTools: DetectedTool[];
  unifiedConfig: UnifiedConfig | null;
  loading: boolean;
}

export function ExportDialog({
  open,
  onClose,
  onConfirm,
  detectedTools,
  unifiedConfig,
  loading,
}: ExportDialogProps) {
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [createBackup, setCreateBackup] = useState(true);

  // Get detected tool IDs as a set for quick lookup
  const detectedToolIds = useMemo(() => {
    return new Set(detectedTools.filter(t => t.detected).map(t => t.id));
  }, [detectedTools]);

  // Get list of all supported tools with their status
  const allToolsWithStatus = useMemo(() => {
    return SUPPORTED_TOOLS.map(toolId => ({
      id: toolId,
      name: getToolName(toolId),
      isDetected: detectedToolIds.has(toolId),
    }));
  }, [detectedToolIds]);

  // Initialize with detected tools selected when dialog opens
  useEffect(() => {
    if (open && selectedTools.size === 0) {
      // Default to selecting detected tools
      const detected = allToolsWithStatus.filter(t => t.isDetected).map(t => t.id);
      if (detected.length > 0) {
        setSelectedTools(new Set(detected));
      }
    }
  }, [open, allToolsWithStatus, selectedTools.size]);

  const handleToggleTool = (toolId: string) => {
    const newSelected = new Set(selectedTools);
    if (newSelected.has(toolId)) {
      newSelected.delete(toolId);
    } else {
      newSelected.add(toolId);
    }
    setSelectedTools(newSelected);
  };

  const handleConfirm = () => {
    if (selectedTools.size > 0) {
      onConfirm(Array.from(selectedTools), { createBackup });
    }
  };

  const hasConfig =
    unifiedConfig &&
    ((unifiedConfig.rules && unifiedConfig.rules.length > 0) ||
      (unifiedConfig.mcp && unifiedConfig.mcp.servers.length > 0) ||
      unifiedConfig.settings);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-bg-secondary border border-border rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Configuration
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bg-hover rounded transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* No Config Warning */}
          {!hasConfig && (
            <div className="flex items-start gap-2 p-3 bg-warning-muted border border-warning/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
              <p className="text-sm text-warning">
                No configuration loaded. Please import configuration first before exporting.
              </p>
            </div>
          )}

          {/* Description */}
          <p className="text-text-secondary text-sm">
            Export your unified configuration to selected AI tools. This will write configuration
            files to the appropriate locations for each tool.
          </p>

          {/* Target Tools Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-primary">Target Tools</h3>
            <p className="text-xs text-text-tertiary">
              Select tools to export your unified configuration. Detected tools may be overwritten.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {allToolsWithStatus.map(tool => {
                const isSelected = selectedTools.has(tool.id);

                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToggleTool(tool.id)}
                    disabled={loading}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                      isSelected
                        ? 'bg-primary-muted border-primary text-text-primary'
                        : 'bg-bg-tertiary border-border hover:border-border-hover text-text-secondary'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{tool.name}</div>
                      <div className="text-xs text-text-tertiary flex items-center gap-1">
                        {tool.isDetected ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-warning" />
                            <span className="text-warning">Will overwrite</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3 text-success" />
                            <span className="text-success">New config</span>
                          </>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Backup Option */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createBackup}
                onChange={e => setCreateBackup(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                disabled={loading}
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-text-primary">
                  Create backup before export
                </span>
                <p className="text-xs text-text-tertiary mt-1">
                  Save a backup of existing configuration files before overwriting.
                </p>
              </div>
            </label>
          </div>

          {/* Config Summary */}
          {hasConfig && (
            <div className="bg-bg-tertiary border border-border rounded-lg p-4">
              <h4 className="text-sm font-medium text-text-primary mb-2">
                Configuration to Export
              </h4>
              <div className="space-y-1 text-xs text-text-secondary">
                {unifiedConfig?.rules && unifiedConfig.rules.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-success" />
                    <span>{unifiedConfig.rules.length} rule(s)</span>
                  </div>
                )}
                {unifiedConfig?.mcp && unifiedConfig.mcp.servers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-success" />
                    <span>{unifiedConfig.mcp.servers.length} MCP server(s)</span>
                  </div>
                )}
                {unifiedConfig?.settings && (
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-success" />
                    <span>Tool settings</span>
                  </div>
                )}
                {unifiedConfig?.commands && unifiedConfig.commands.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-success" />
                    <span>{unifiedConfig.commands.length} command(s)</span>
                  </div>
                )}
                {unifiedConfig?.prompts && unifiedConfig.prompts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-success" />
                    <span>{unifiedConfig.prompts.length} prompt template(s)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Selection Summary */}
          {selectedTools.size > 0 && (
            <div className="text-sm text-text-secondary">
              Will export to{' '}
              <strong className="text-text-primary">
                {selectedTools.size} tool{selectedTools.size > 1 ? 's' : ''}
              </strong>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-bg-tertiary">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={loading || selectedTools.size === 0 || !hasConfig}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-1" />
                Export
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
