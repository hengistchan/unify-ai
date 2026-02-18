/**
 * Sync Settings Dialog
 * Allows users to configure source tool and target tools for sync
 */

import { useState, useEffect } from 'react';
import { X, ArrowRight, Check, RefreshCw, Info } from 'lucide-react';
import { Button, ToolIcon } from '@/components/common';
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

  const detectedList = detectedTools.filter(t => t.detected);

  // Initialize with default values
  useEffect(() => {
    if (open && detectedTools.length > 0) {
      const detected = detectedTools.filter(t => t.detected);
      if (detected.length > 0) {
        // Use initial values if provided, otherwise use first as source and rest as targets
        const defaultSource = initialSource || detected[0].id;
        const defaultTargets = initialTargets || detected.slice(1).map(t => t.id);

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
    }
  };

  const canConfirm = sourceTool && targetTools.size > 0;

  const sourceToolInfo = detectedList.find(t => t.id === sourceTool);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-bg-secondary border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Sync Configuration
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-hover rounded transition-colors">
            <X className="w-5 h-5 text-text-tertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Explanation */}
          <div className="bg-bg-tertiary border border-border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm text-text-primary font-medium">How does sync work?</p>
                <p className="text-sm text-text-secondary">
                  Sync reads configuration (rules, MCP servers, settings) from the{' '}
                  <strong className="text-text-primary">source tool</strong> and writes it to the{' '}
                  <strong className="text-text-primary">target tools</strong>' config files.
                </p>
              </div>
            </div>
          </div>

          {/* Visual Flow */}
          <div className="flex items-center justify-center gap-4 py-4">
            {/* Source */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-16 bg-primary-muted border-2 border-primary rounded-lg flex items-center justify-center">
                {sourceToolInfo ? (
                  <ToolIcon toolId={sourceToolInfo.id} size="md" />
                ) : (
                  <span className="text-2xl">?</span>
                )}
              </div>
              <span className="text-xs text-text-secondary">
                {sourceToolInfo?.name || 'Select source'}
              </span>
              <span className="text-xs text-primary font-medium">Source</span>
            </div>

            {/* Arrow */}
            <div className="flex items-center gap-1">
              <ArrowRight className="w-6 h-6 text-primary" />
              <RefreshCw className="w-5 h-5 text-text-tertiary" />
              <ArrowRight className="w-6 h-6 text-primary" />
            </div>

            {/* Targets */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-16 bg-success-muted border-2 border-success rounded-lg flex items-center justify-center">
                <span className="text-2xl">{targetTools.size > 0 ? '📁' : '?'}</span>
              </div>
              <span className="text-xs text-text-secondary">
                {targetTools.size > 0 ? `${targetTools.size} tool(s)` : 'Select targets'}
              </span>
              <span className="text-xs text-success font-medium">Targets</span>
            </div>
          </div>

          {/* Source Tool Selection */}
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs">
                1
              </span>
              Select source tool (configuration origin)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {detectedList.map(tool => (
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
                  <ToolIcon toolId={tool.id} size="sm" />
                  <span className="font-medium">{tool.name}</span>
                  {sourceTool === tool.id && <Check className="w-5 h-5 text-primary ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Target Tools Selection */}
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs">
                2
              </span>
              Select target tools (will receive configuration)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {detectedList.map(tool => {
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
                        ? 'bg-success-muted border-success text-text-primary'
                        : 'bg-bg-tertiary border-border hover:border-border-hover text-text-secondary'
                    )}
                  >
                    <ToolIcon toolId={tool.id} size="sm" className={isSource ? 'opacity-50' : ''} />
                    <span className="font-medium">
                      {isSource ? `${tool.name} (Source)` : tool.name}
                    </span>
                    {isSelected && !isSource && <Check className="w-5 h-5 text-success ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          {canConfirm && (
            <div className="p-4 bg-success-muted border border-success/30 rounded-lg">
              <p className="text-sm text-success font-medium mb-1">Ready to sync</p>
              <p className="text-sm text-text-secondary">
                Configuration from{' '}
                <strong className="text-text-primary">{sourceToolInfo?.name}</strong> will be synced
                to <strong className="text-text-primary">{targetTools.size} tool(s)</strong>:{' '}
                {Array.from(targetTools).map((id, i) => {
                  const tool = detectedList.find(t => t.id === id);
                  return (
                    <span key={id}>
                      {i > 0 && ', '}
                      <strong>{tool?.name}</strong>
                    </span>
                  );
                })}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-bg-tertiary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!canConfirm}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Start Sync
          </Button>
        </div>
      </div>
    </div>
  );
}
