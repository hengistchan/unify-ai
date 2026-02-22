/**
 * Sync Mode Dialog
 * First step: let user choose how they want to sync
 */

import { useState } from 'react';
import { X, RefreshCw, FileJson, ArrowRight } from 'lucide-react';
import { Button } from '@/components/common';
import { cn } from '@/lib/utils';

export type SyncMode = 'direct-sync' | 'unified-config';

interface SyncModeDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectMode: (mode: SyncMode) => void;
  hasUnifiedConfig: boolean;
  detectedToolsCount: number;
}

export function SyncModeDialog({
  open,
  onClose,
  onSelectMode,
  hasUnifiedConfig,
  detectedToolsCount,
}: SyncModeDialogProps) {
  const [selectedMode, setSelectedMode] = useState<SyncMode | null>(null);

  if (!open) return null;

  const handleConfirm = () => {
    if (selectedMode) {
      onSelectMode(selectedMode);
    }
  };

  const needsTwoTools = selectedMode === 'direct-sync';
  const minTools = needsTwoTools ? 2 : 1;
  const canProceed = selectedMode !== null && detectedToolsCount >= minTools;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-bg-secondary border border-border rounded-lg shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in">
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
        <div className="p-6 space-y-4">
          {/* Info */}
          <p className="text-sm text-text-secondary">
            Choose how you want to synchronize your AI tool configurations
          </p>

          {/* Mode Options */}
          <div className="space-y-3">
            {/* Direct Sync */}
            <button
              onClick={() => setSelectedMode('direct-sync')}
              className={cn(
                'w-full text-left p-4 rounded-lg border-2 transition-all',
                selectedMode === 'direct-sync'
                  ? 'border-primary bg-primary-muted'
                  : 'border-border bg-bg-tertiary hover:border-border-hover'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'p-2 rounded-lg',
                    selectedMode === 'direct-sync' ? 'bg-primary text-white' : 'bg-bg-secondary'
                  )}
                >
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-text-primary">Sync Between Tools</h3>
                    {selectedMode === 'direct-sync' && (
                      <span className="text-xs bg-primary text-white px-2 py-0.5 rounded">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mt-1">
                    Read from one tool and write directly to others
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
                    <span>Best for: Quick one-time sync</span>
                    <span>•</span>
                    <span>No persistent config file</span>
                  </div>
                </div>
              </div>
            </button>

            {/* Unified Config */}
            <button
              onClick={() => setSelectedMode('unified-config')}
              className={cn(
                'w-full text-left p-4 rounded-lg border-2 transition-all',
                selectedMode === 'unified-config'
                  ? 'border-primary bg-primary-muted'
                  : 'border-border bg-bg-tertiary hover:border-border-hover'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'p-2 rounded-lg',
                    selectedMode === 'unified-config' ? 'bg-primary text-white' : 'bg-bg-secondary'
                  )}
                >
                  <FileJson className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-text-primary">Manage Unified Config</h3>
                    {selectedMode === 'unified-config' && (
                      <span className="text-xs bg-primary text-white px-2 py-0.5 rounded">
                        Selected
                      </span>
                    )}
                    {hasUnifiedConfig && (
                      <span className="text-xs bg-success-muted text-success px-2 py-0.5 rounded">
                        Config exists
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mt-1">
                    Generate unified.json from tools, edit, then export
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-tertiary">
                    <span>Best for: Long-term config management</span>
                    <span>•</span>
                    <span>Persistent unified.json file</span>
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Requirements */}
          {selectedMode === 'direct-sync' && detectedToolsCount < 2 && (
            <div className="p-3 bg-warning-muted border border-warning/30 rounded-lg">
              <p className="text-sm text-warning">
                At least 2 detected tools are required for direct sync (found {detectedToolsCount})
              </p>
            </div>
          )}
          {selectedMode === 'unified-config' && detectedToolsCount < 1 && (
            <div className="p-3 bg-warning-muted border border-warning/30 rounded-lg">
              <p className="text-sm text-warning">
                At least 1 detected tool is required (found {detectedToolsCount})
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-bg-tertiary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={!canProceed}>
            {selectedMode === 'unified-config' ? 'OpenCode' : 'Continue'}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
