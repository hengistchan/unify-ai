/**
 * Sync Settings Dialog
 * Allows users to configure source tool and target tools for sync
 */

import { useState, useEffect } from 'react';
import { X, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/common';
import type { DetectedTool } from '@/stores/appStore';
import { cn } from '@/lib/utils';

interface SyncSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (sourceTool: string, targetTools: string[]) => void;
  detectedTools: DetectedTool[];
  initialSource?: string;
  initialTargets?: string[];
}

export function SyncSettingsDialog({
  open,
  onClose,
  onConfirm,
  detectedTools,
  initialSource,
  initialTargets,
}: SyncSettingsDialogProps) {
  const [sourceTool, setSourceTool] = useState<string>('');
  const [targetTools, setTargetTools] = useState<Set<string>>(new Set());

  const detectedList = detectedTools.filter((t) => t.detected);

  // Initialize with default values
  useEffect(() => {
    if (open && detectedTools.length > 0) {
      const detected = detectedTools.filter((t) => t.detected);
      if (detected.length > 0) {
        // Use initial values if provided, otherwise use first as source and rest as targets
        const defaultSource = initialSource || detected[0].id;
        const defaultTargets = initialTargets || detected.slice(1).map((t) => t.id);

        setSourceTool(defaultSource);
        setTargetTools(new Set(defaultTargets));
      }
    }
  }, [open, detectedTools, initialSource, initialTargets]);

  const handleToggleTarget = (toolId: string) => {
    const newTargets = new Set(targetTools);
    if (newTargets.has(toolId)) {
      newTargets.delete(toolId);
    } else {
      newTargets.add(toolId);
    }
    setTargetTools(newTargets);
  };

  const handleSelectSource = (toolId: string) => {
    setSourceTool(toolId);
    // Remove source from targets if it's there
    const newTargets = new Set(targetTools);
    newTargets.delete(toolId);
    setTargetTools(newTargets);
  };

  const handleConfirm = () => {
    if (sourceTool && targetTools.size > 0) {
      onConfirm(sourceTool, Array.from(targetTools));
      onClose();
    }
  };

  const canConfirm = sourceTool && targetTools.size > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-bg-secondary border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Sync Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-bg-hover rounded transition-colors"
          >
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <p className="text-text-secondary mb-6">
            Select the source tool to sync from and the target tools to sync to.
          </p>

          {/* Source Tool Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary" />
              Source Tool
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {detectedList.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleSelectSource(tool.id)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all',
                    sourceTool === tool.id
                      ? 'bg-primary-muted border-primary text-text-primary'
                      : 'bg-bg-tertiary border-border hover:border-border-hover text-text-secondary'
                  )}
                >
                  <div className="flex-1 text-left">
                    <div className="font-medium">{tool.name}</div>
                    <div className="text-xs text-text-tertiary">{tool.configPath}</div>
                  </div>
                  {sourceTool === tool.id && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Target Tools Selection */}
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary" />
              Target Tools
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {detectedList.map((tool) => {
                const isSource = tool.id === sourceTool;
                const isSelected = targetTools.has(tool.id);

                return (
                  <button
                    key={tool.id}
                    onClick={() => !isSource && handleToggleTarget(tool.id)}
                    disabled={isSource}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-all',
                      isSource && 'opacity-50 cursor-not-allowed',
                      isSelected && !isSource
                        ? 'bg-primary-muted border-primary text-text-primary'
                        : 'bg-bg-tertiary border-border hover:border-border-hover text-text-secondary'
                    )}
                  >
                    <div className="flex-1 text-left">
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-xs text-text-tertiary">
                        {isSource ? 'Source tool' : tool.configPath}
                      </div>
                    </div>
                    {isSelected && !isSource && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info */}
          {canConfirm && (
            <div className="mt-6 p-3 bg-info-muted border border-info/20 rounded-lg">
              <p className="text-sm text-info">
                Configuration from <strong>{detectedList.find(t => t.id === sourceTool)?.name}</strong> will be synced to{' '}
                <strong>{targetTools.size} tool{targetTools.size > 1 ? 's' : ''}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-bg-tertiary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Apply Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
