import React from 'react';
import { AlertTriangle, FileText, ArrowRight } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Badge, BadgeVariant } from '@/components/common/Badge';

// Types
export interface FileChange {
  path: string;
  action: 'create' | 'update' | 'delete';
  linesAdded: number;
  linesRemoved: number;
}

export interface Conflict {
  path: string;
  description: string;
}

export interface SyncPreview {
  sourceTool: string;
  targetTools: string[];
  changes: FileChange[];
  conflicts: Conflict[];
}

export interface SyncPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  preview: SyncPreview | null;
  loading: boolean;
}

// Action badge variant mapping
const actionVariantMap: Record<FileChange['action'], BadgeVariant> = {
  create: 'success',
  update: 'info',
  delete: 'error',
};

// Action label mapping
const actionLabelMap: Record<FileChange['action'], string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
};

// Loading Skeleton Component
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="flex gap-2">
      <div className="h-6 w-20 bg-bg-tertiary rounded-full" />
      <div className="h-6 w-16 bg-bg-tertiary rounded-full" />
    </div>
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg">
          <div className="h-4 w-16 bg-border rounded" />
          <div className="h-4 flex-1 bg-border rounded" />
          <div className="h-4 w-12 bg-border rounded" />
        </div>
      ))}
    </div>
  </div>
);

// Empty State Component
const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
    <FileText size={40} className="mb-2 opacity-50" />
    <p className="text-sm">No changes to preview</p>
  </div>
);

// File Change Row Component
const FileChangeRow: React.FC<{ change: FileChange }> = ({ change }) => {
  const fileName = change.path.split('/').pop() ?? change.path;
  const dirPath = change.path.split('/').slice(0, -1).join('/');

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-bg-hover transition-colors">
      <td className="py-3 px-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary truncate max-w-[200px]">
            {fileName}
          </span>
          {dirPath && (
            <span className="text-xs text-text-tertiary truncate max-w-[200px]">
              {dirPath}
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4">
        <Badge variant={actionVariantMap[change.action]}>
          {actionLabelMap[change.action]}
        </Badge>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2 text-xs font-mono">
          {change.linesAdded > 0 && (
            <span className="text-success">+{change.linesAdded}</span>
          )}
          {change.linesRemoved > 0 && (
            <span className="text-error">-{change.linesRemoved}</span>
          )}
          {change.linesAdded === 0 && change.linesRemoved === 0 && (
            <span className="text-text-tertiary">-</span>
          )}
        </div>
      </td>
    </tr>
  );
};

// Conflicts Section Component
const ConflictsSection: React.FC<{ conflicts: Conflict[] }> = ({ conflicts }) => {
  if (conflicts.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-warning" />
        <h4 className="text-sm font-medium text-warning">
          Conflicts ({conflicts.length})
        </h4>
      </div>
      <Card hoverable={false} className="border-warning/30">
        <Card.Body className="p-0">
          <ul className="divide-y divide-border">
            {conflicts.map((conflict, index) => (
              <li
                key={`${conflict.path}-${index}`}
                className="p-3 flex items-start gap-3"
              >
                <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {conflict.path}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {conflict.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card.Body>
      </Card>
    </div>
  );
};

export const SyncPreviewDialog: React.FC<SyncPreviewDialogProps> = ({
  open,
  onClose,
  onConfirm,
  preview,
  loading,
}) => {
  const hasChanges = preview && preview.changes.length > 0;
  const hasConflicts = preview && preview.conflicts.length > 0;

  // Calculate totals
  const totalAdded = preview?.changes.reduce((sum, c) => sum + c.linesAdded, 0) ?? 0;
  const totalRemoved = preview?.changes.reduce((sum, c) => sum + c.linesRemoved, 0) ?? 0;

  // Handle confirm with conflict warning
  const handleConfirm = () => {
    if (hasConflicts) {
      // Could add confirmation dialog here for conflicts
      // For now, just proceed
    }
    onConfirm();
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Sync Preview"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={loading || !hasChanges}
            loading={loading}
          >
            Confirm Sync
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingSkeleton />
      ) : !preview ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {/* Source and Target Tools */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary uppercase tracking-wide">
                Source:
              </span>
              <Badge variant="info">{preview.sourceTool}</Badge>
            </div>
            <ArrowRight size={16} className="text-text-tertiary" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary uppercase tracking-wide">
                Targets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {preview.targetTools.map((tool) => (
                  <Badge key={tool} variant="default">
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Changes Summary */}
          {hasChanges && (
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <span>{preview.changes.length} file(s) affected</span>
              <span className="text-success">+{totalAdded}</span>
              <span className="text-error">-{totalRemoved}</span>
            </div>
          )}

          {/* File Changes Table */}
          {hasChanges && (
            <Card hoverable={false}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-bg-tertiary">
                      <th className="text-left py-2 px-4 text-xs font-medium text-text-tertiary uppercase tracking-wide">
                        File
                      </th>
                      <th className="text-left py-2 px-4 text-xs font-medium text-text-tertiary uppercase tracking-wide">
                        Action
                      </th>
                      <th className="text-right py-2 px-4 text-xs font-medium text-text-tertiary uppercase tracking-wide">
                        Lines
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.changes.map((change, index) => (
                      <FileChangeRow
                        key={`${change.path}-${index}`}
                        change={change}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* No Changes Message */}
          {!hasChanges && (
            <div className="text-center py-6">
              <p className="text-text-secondary">No changes detected</p>
              <p className="text-xs text-text-tertiary mt-1">
                All configurations are already in sync
              </p>
            </div>
          )}

          {/* Conflicts Section */}
          <ConflictsSection conflicts={preview.conflicts} />
        </div>
      )}
    </Modal>
  );
};

export default SyncPreviewDialog;
