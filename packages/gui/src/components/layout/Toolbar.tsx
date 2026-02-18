import React from 'react';
import { RefreshCw, Download, Upload, List, LayoutGrid, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolbarProps, BreadcrumbItem } from '@/types/layout';

/**
 * Toolbar component for the unify-ai GUI
 *
 * Features:
 * - Breadcrumb navigation
 * - Action buttons (Sync, Import, Export)
 * - View toggle (list/card)
 */
export const Toolbar: React.FC<ToolbarProps> = ({
  breadcrumbs = [],
  viewMode = 'card',
  onViewModeChange,
  onSync,
  onImport,
  onExport,
}) => {
  return (
    <header className="flex items-center justify-between h-14 px-6 bg-bg-secondary border-b border-border">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((item: BreadcrumbItem, index: number) => (
          <React.Fragment key={index}>
            {index > 0 && <ChevronRight className="w-4 h-4 text-text-tertiary mx-1" />}
            {item.path ? (
              <button
                onClick={() => {
                  // Navigate to path
                  window.location.hash = item.path || '';
                }}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                {item.label}
              </button>
            ) : (
              <span className="text-text-primary font-medium">{item.label}</span>
            )}
          </React.Fragment>
        ))}
        {breadcrumbs.length === 0 && (
          <span className="text-text-primary font-medium">Dashboard</span>
        )}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Sync Button */}
        <button
          onClick={onSync}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-md transition-all hover:shadow-glow active:scale-[0.98]"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Sync</span>
        </button>

        {/* Import Button */}
        <button
          onClick={onImport}
          className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary hover:bg-bg-hover border border-border hover:border-border-hover text-text-secondary hover:text-text-primary text-sm rounded-md transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span>Import</span>
        </button>

        {/* Export Button */}
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary hover:bg-bg-hover border border-border hover:border-border-hover text-text-secondary hover:text-text-primary text-sm rounded-md transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-border mx-2" />

        {/* View Toggle */}
        <div className="flex items-center bg-bg-tertiary rounded-md border border-border p-0.5">
          <button
            onClick={() => onViewModeChange?.('list')}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'list'
                ? 'bg-primary text-white'
                : 'text-text-tertiary hover:text-text-primary'
            )}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange?.('card')}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'card'
                ? 'bg-primary text-white'
                : 'text-text-tertiary hover:text-text-primary'
            )}
            title="Card view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Toolbar;
