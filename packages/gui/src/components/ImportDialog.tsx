/**
 * Import Dialog
 * Allows users to import configuration from detected tools
 */

import { useState, useEffect } from 'react';
import { X, Check, Upload, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/common';
import type { DetectedTool } from '@/stores/appStore';
import { cn } from '@/lib/utils';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (options: { mergeMultiple: boolean; sourceTool?: string }) => void;
  detectedTools: DetectedTool[];
  loading: boolean;
}

export function ImportDialog({
  open,
  onClose,
  onConfirm,
  detectedTools,
  loading,
}: ImportDialogProps) {
  const [mergeMultiple, setMergeMultiple] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string>('');

  const detectedList = detectedTools.filter(t => t.detected);

  // Initialize with first detected tool
  useEffect(() => {
    if (open && detectedList.length > 0 && !selectedSource) {
      setSelectedSource(detectedList[0].id);
    }
  }, [open, detectedList, selectedSource]);

  const handleConfirm = () => {
    onConfirm({
      mergeMultiple,
      sourceTool: mergeMultiple ? undefined : selectedSource,
    });
  };

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
            <Upload className="w-5 h-5" />
            Import Configuration
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
          {/* Description */}
          <p className="text-text-secondary text-sm">
            Import AI tool configuration from your project. The imported configuration can then be
            synced to other tools or exported.
          </p>

          {/* Merge Option */}
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mergeMultiple}
                onChange={e => setMergeMultiple(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                disabled={loading}
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-text-primary">
                  Merge from all detected tools
                </span>
                <p className="text-xs text-text-tertiary mt-1">
                  Combine configurations from all detected tools into a unified config. Disable to
                  import from a single source.
                </p>
              </div>
            </label>
          </div>

          {/* Source Selection (when not merging) */}
          {!mergeMultiple && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-text-primary">Source Tool</h3>
              <div className="grid grid-cols-2 gap-2">
                {detectedList.map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedSource(tool.id)}
                    disabled={loading}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-all',
                      selectedSource === tool.id
                        ? 'bg-primary-muted border-primary text-text-primary'
                        : 'bg-bg-tertiary border-border hover:border-border-hover text-text-secondary'
                    )}
                  >
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{tool.name}</div>
                    </div>
                    {selectedSource === tool.id && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Detected Tools Summary */}
          <div className="bg-bg-tertiary border border-border rounded-lg p-4">
            <h4 className="text-sm font-medium text-text-primary mb-2">
              Detected Tools ({detectedList.length})
            </h4>
            <div className="space-y-1">
              {detectedList.map(tool => (
                <div key={tool.id} className="flex items-center gap-2 text-xs text-text-secondary">
                  <Check className="w-3 h-3 text-success" />
                  <span>{tool.name}</span>
                  <span className="text-text-tertiary">({tool.configPath})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Warning */}
          {detectedList.length === 0 && (
            <div className="flex items-start gap-2 p-3 bg-warning-muted border border-warning/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
              <p className="text-sm text-warning">
                No AI tools detected in this project. Make sure you have tool configuration files in
                your project directory.
              </p>
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
            disabled={loading || detectedList.length === 0 || (!mergeMultiple && !selectedSource)}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-1" />
                Import
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
