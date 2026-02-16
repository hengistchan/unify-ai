import React from 'react';
import {
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Clock,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatusBarProps, SyncStatus } from '@/types/layout';

/**
 * Get sync status icon and color
 */
function getSyncStatusInfo(status: SyncStatus) {
  switch (status) {
    case 'synced':
      return {
        icon: <CheckCircle className="w-3.5 h-3.5" />,
        label: 'Synced',
        className: 'text-success',
      };
    case 'syncing':
      return {
        icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
        label: 'Syncing...',
        className: 'text-primary',
      };
    case 'error':
      return {
        icon: <XCircle className="w-3.5 h-3.5" />,
        label: 'Sync Error',
        className: 'text-error',
      };
    case 'pending':
      return {
        icon: <Clock className="w-3.5 h-3.5" />,
        label: 'Pending',
        className: 'text-warning',
      };
    default:
      return {
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        label: 'Unknown',
        className: 'text-text-tertiary',
      };
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

/**
 * StatusBar component for the unify-ai GUI
 *
 * Features:
 * - Sync status indicator with animated icon
 * - Last update time
 * - Error/warning counts
 */
export const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
  const { icon, label, className } = getSyncStatusInfo(status.syncStatus);

  return (
    <footer className="flex items-center justify-between h-8 px-4 bg-bg-secondary border-t border-border text-xs">
      {/* Left Section - Sync Status */}
      <div className="flex items-center gap-4">
        <div className={cn('flex items-center gap-1.5', className)}>
          {icon}
          <span>{label}</span>
        </div>

        {status.lastUpdateTime && (
          <div className="flex items-center gap-1.5 text-text-tertiary">
            <Clock className="w-3 h-3" />
            <span>Last update: {formatRelativeTime(status.lastUpdateTime)}</span>
          </div>
        )}
      </div>

      {/* Right Section - Error/Warning Counts */}
      <div className="flex items-center gap-4">
        {status.errorCount > 0 && (
          <div className="flex items-center gap-1.5 text-error">
            <XCircle className="w-3 h-3" />
            <span>{status.errorCount} error{status.errorCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        {status.warningCount > 0 && (
          <div className="flex items-center gap-1.5 text-warning">
            <AlertTriangle className="w-3 h-3" />
            <span>{status.warningCount} warning{status.warningCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        {status.errorCount === 0 && status.warningCount === 0 && (
          <div className="flex items-center gap-1.5 text-success">
            <CheckCircle className="w-3 h-3" />
            <span>No issues</span>
          </div>
        )}
      </div>
    </footer>
  );
};

export default StatusBar;
