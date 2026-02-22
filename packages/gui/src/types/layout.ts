/**
 * Types for AI tools supported by unify-ai
 */
export type AITool =
  | 'cursor'
  | 'claude'
  | 'copilot'
  | 'windsurf'
  | 'codex'
  | 'cline'
  | 'aider'
  | 'opencode';

/**
 * Tool configuration status
 */
export type ToolStatus = 'configured' | 'not-configured' | 'error' | 'pending';

/**
 * Tool information for sidebar display
 */
export interface ToolInfo {
  id: AITool;
  name: string;
  status: ToolStatus;
  configCount: number;
}

/**
 * Sync status for the application
 */
export type SyncStatus = 'synced' | 'syncing' | 'error' | 'pending';

/**
 * Status bar information
 */
export interface StatusBarInfo {
  syncStatus: SyncStatus;
  lastUpdateTime: Date | null;
  errorCount: number;
  warningCount: number;
}

/**
 * Breadcrumb item for navigation
 */
export interface BreadcrumbItem {
  label: string;
  path?: string;
}

/**
 * View mode for content display
 */
export type ViewMode = 'list' | 'card';

/**
 * Sidebar props
 */
export interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  currentProject?: {
    name: string;
    path: string;
  };
  tools?: ToolInfo[];
  selectedTool?: AITool | null;
  onSelectTool?: (tool: AITool) => void;
  onOpenSettings?: () => void;
  onSync?: () => void;
}

/**
 * Toolbar props
 */
export interface ToolbarProps {
  breadcrumbs?: BreadcrumbItem[];
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onSync?: () => void;
  onImport?: () => void;
  onExport?: () => void;
}

/**
 * StatusBar props
 */
export interface StatusBarProps {
  status: StatusBarInfo;
}
