import React, { useState } from 'react';
import {
  Settings,
  RefreshCw,
  Search,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SidebarProps, ToolInfo, ToolStatus } from '@/types/layout';

/**
 * Default tools configuration
 */
const DEFAULT_TOOLS: ToolInfo[] = [
  { id: 'cursor', name: 'Cursor', status: 'configured', configCount: 3 },
  { id: 'claude', name: 'Claude Code', status: 'configured', configCount: 5 },
  { id: 'copilot', name: 'Copilot', status: 'not-configured', configCount: 0 },
  { id: 'windsurf', name: 'Windsurf', status: 'configured', configCount: 2 },
  { id: 'codex', name: 'Codex', status: 'not-configured', configCount: 0 },
  { id: 'cline', name: 'Cline', status: 'not-configured', configCount: 0 },
  { id: 'aider', name: 'Aider', status: 'not-configured', configCount: 0 },
  { id: 'continue', name: 'Continue', status: 'not-configured', configCount: 0 },
];

/**
 * Get status icon for tool
 */
function getStatusIcon(status: ToolStatus) {
  switch (status) {
    case 'configured':
      return <CheckCircle className="w-3.5 h-3.5 text-success" />;
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-error" />;
    case 'pending':
      return <Clock className="w-3.5 h-3.5 text-warning" />;
    default:
      return null;
  }
}

/**
 * Get status badge styles
 */
function getStatusBadgeStyles(status: ToolStatus) {
  switch (status) {
    case 'configured':
      return 'bg-success-muted text-success';
    case 'error':
      return 'bg-error-muted text-error';
    case 'pending':
      return 'bg-warning-muted text-warning';
    default:
      return 'bg-bg-tertiary text-text-tertiary';
  }
}

/**
 * Sidebar component for the unify-ai GUI
 *
 * Features:
 * - Collapsible sidebar (220px expanded, 60px collapsed)
 * - Logo section with branding
 * - Search input for filtering
 * - Current project section
 * - Tools list with status badges
 * - Settings and Sync buttons at bottom
 */
export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
  currentProject,
  tools = DEFAULT_TOOLS,
  selectedTool,
  onSelectTool,
  onOpenSettings,
  onSync,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-bg-secondary border-r border-border transition-all duration-normal',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}
    >
      {/* Logo Section */}
      <div className="flex items-center h-14 px-4 border-b border-border">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">U</span>
          </div>
          {!collapsed && (
            <span className="text-text-primary font-semibold text-base whitespace-nowrap">
              unify-ai
            </span>
          )}
        </div>
      </div>

      {/* Search Input */}
      {!collapsed && (
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-bg-tertiary border border-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-primary-muted transition-colors"
            />
          </div>
        </div>
      )}

      {/* Current Project Section */}
      {!collapsed && currentProject && (
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 text-text-tertiary text-xs uppercase tracking-wider mb-2">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Current Project</span>
          </div>
          <div className="bg-bg-tertiary rounded-md p-2">
            <div className="text-text-primary text-sm font-medium truncate">
              {currentProject.name}
            </div>
            <div className="text-text-tertiary text-xs truncate mt-0.5">{currentProject.path}</div>
          </div>
        </div>
      )}

      {/* Tools List */}
      <div className="flex-1 overflow-y-auto py-2">
        {!collapsed && (
          <div className="px-3 mb-2 text-text-tertiary text-xs uppercase tracking-wider">Tools</div>
        )}
        <nav className="space-y-0.5 px-2">
          {filteredTools.map(tool => (
            <button
              key={tool.id}
              onClick={() => onSelectTool?.(tool.id)}
              className={cn(
                'w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors',
                selectedTool === tool.id
                  ? 'bg-primary-muted text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                collapsed && 'justify-center'
              )}
              title={collapsed ? tool.name : undefined}
            >
              {collapsed ? (
                getStatusIcon(tool.status)
              ) : (
                <>
                  <span className="flex-1 truncate text-sm">{tool.name}</span>
                  {getStatusIcon(tool.status)}
                  {tool.configCount > 0 && (
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full',
                        getStatusBadgeStyles(tool.status)
                      )}
                    >
                      {tool.configCount}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-border p-2 space-y-1">
        <button
          onClick={() => window.location.href = '/models'}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Models' : undefined}
        >
          <Cpu className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Models</span>}
        </button>
        <button
          onClick={onOpenSettings}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Settings</span>}
        </button>
        <button
          onClick={onSync}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Sync' : undefined}
        >
          <RefreshCw className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Sync</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute top-1/2 -right-3 w-6 h-6 bg-bg-secondary border border-border rounded-full flex items-center justify-center text-text-tertiary hover:text-text-primary hover:border-border-hover transition-colors"
        style={{ transform: 'translateY(-50%)' }}
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
};

export default Sidebar;
