/**
 * Main Layout Component
 * Combines Sidebar, Toolbar, main content area, and StatusBar
 * Uses React Router Outlet for nested route content
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import type {
  ViewMode,
  AITool,
  ToolInfo,
  StatusBarInfo,
  BreadcrumbItem,
} from '@/types/layout';

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
 * Default status bar info
 */
const DEFAULT_STATUS: StatusBarInfo = {
  syncStatus: 'synced',
  lastUpdateTime: new Date(),
  errorCount: 0,
  warningCount: 0,
};

/**
 * MainLayout component for the unify-ai GUI
 *
 * Features:
 * - Combines Sidebar, Toolbar, main content area, and StatusBar
 * - Uses React Router Outlet for nested route content
 * - Manages sidebar collapsed state
 * - Manages view mode state
 * - Manages selected tool state
 */
export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [status] = useState<StatusBarInfo>(DEFAULT_STATUS);

  // TODO: Get project info from store/context
  const currentProject = {
    name: 'my-project',
    path: '/Users/dev/my-project',
  };

  const handleToggleCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleSelectTool = (tool: AITool) => {
    setSelectedTool(tool);
    // Update breadcrumbs when tool is selected
    setBreadcrumbs([
      { label: 'Projects' },
      { label: currentProject.name },
      { label: DEFAULT_TOOLS.find((t) => t.id === tool)?.name || tool },
    ]);
  };

  const handleOpenSettings = () => {
    // TODO: Navigate to settings or open settings modal
    console.log('Open settings');
  };

  const handleSync = () => {
    // TODO: Trigger sync action
    console.log('Sync triggered');
  };

  const handleImport = () => {
    // TODO: Open import dialog
    console.log('Import triggered');
  };

  const handleExport = () => {
    // TODO: Open export dialog
    console.log('Export triggered');
  };

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary">
      {/* Sidebar */}
      <div className="relative flex-shrink-0">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          currentProject={currentProject}
          tools={DEFAULT_TOOLS}
          selectedTool={selectedTool}
          onSelectTool={handleSelectTool}
          onOpenSettings={handleOpenSettings}
          onSync={handleSync}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <Toolbar
          breadcrumbs={breadcrumbs}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSync={handleSync}
          onImport={handleImport}
          onExport={handleExport}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-bg-primary p-6">
          <Outlet context={{ viewMode, selectedTool }} />
        </main>

        {/* Status Bar */}
        <StatusBar status={status} />
      </div>
    </div>
  );
}

export default MainLayout;
