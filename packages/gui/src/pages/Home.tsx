/**
 * Home Page
 * Welcome screen with project management options
 */

import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Download, Clock, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import {
  useAppStore,
  selectRecentProjects,
  selectCurrentProject,
  selectDetectedTools,
} from '@/stores/appStore';
import { formatRelativeTime } from '@/lib/utils';

export function Home() {
  const navigate = useNavigate();
  const recentProjects = useAppStore(selectRecentProjects);
  const currentProject = useAppStore(selectCurrentProject);
  const detectedTools = useAppStore(selectDetectedTools);
  const { setProject, setDetectedTools, addRecentProject, addToast, previewSync } = useAppStore();

  const handleOpenProject = async () => {
    try {
      // Use Electron's dialog API
      const path = await window.electronAPI.openFolder();
      if (path) {
        setProject(path);
        addRecentProject({
          path,
          name: path.split('/').pop() ?? path,
          lastOpened: new Date().toISOString(),
        });

        // Detect tools in the selected folder
        try {
          const tools = await window.electronAPI.detectTools(path);
          setDetectedTools(tools);
        } catch (detectError) {
          console.error('Failed to detect tools:', detectError);
          // Continue even if detection fails
        }

        addToast({
          type: 'success',
          title: 'Project opened',
          message: path,
        });
        navigate('/project');
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to open folder',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleCreateConfig = () => {
    addToast({
      type: 'info',
      title: 'Coming soon',
      message: 'Create new config feature is in development',
    });
  };

  const handleImportFromTool = () => {
    addToast({
      type: 'info',
      title: 'Coming soon',
      message: 'Import from tool feature is in development',
    });
  };

  const handleOpenRecent = async (path: string) => {
    setProject(path);
    addRecentProject({
      path,
      name: path.split('/').pop() ?? path,
      lastOpened: new Date().toISOString(),
    });

    // Detect tools in the selected folder
    try {
      const tools = await window.electronAPI.detectTools(path);
      setDetectedTools(tools);
    } catch (detectError) {
      console.error('Failed to detect tools:', detectError);
    }

    navigate('/project');
  };

  const handleQuickSync = async () => {
    if (!currentProject || detectedTools.length < 1) {
      addToast({
        type: 'warning',
        title: 'Cannot sync',
        message: 'Open a project with at least 1 detected tool to sync',
      });
      return;
    }

    const detectedList = detectedTools.filter(t => t.detected);
    if (detectedList.length < 1) {
      addToast({
        type: 'info',
        title: 'Need at least one tool',
        message: 'At least 1 detected tool is needed for sync',
      });
      return;
    }

    const sourceTool = detectedList[0].id;
    const targetTools = detectedList.slice(1).map(t => t.id);
    await previewSync(sourceTool, targetTools);
    navigate('/project');
  };

  // Calculate project status
  const hasCurrentProject = !!currentProject;
  const detectedCount = detectedTools.filter(t => t.detected).length;

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-4">
          <Sparkles className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-text-primary mb-3">Welcome to Unify AI</h1>
        <p className="text-lg text-text-tertiary max-w-lg mx-auto">
          Unified configuration management for AI coding assistants. Sync your configs across
          Cursor, Claude Code, Copilot, and more.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        {/* Open Project */}
        <button
          onClick={handleOpenProject}
          className="flex items-center gap-4 p-6 bg-bg-secondary border border-border rounded-lg hover:bg-bg-elevated hover:border-border-hover transition-all group"
        >
          <div className="p-3 bg-primary-muted rounded-lg">
            <FolderOpen className="w-6 h-6 text-primary" />
          </div>
          <div className="text-left flex-1">
            <h3 className="text-lg font-semibold text-text-primary mb-1">Open Project</h3>
            <p className="text-sm text-text-tertiary">
              Open an existing project to manage AI tool configurations
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-text-tertiary group-hover:text-primary transition-colors" />
        </button>

        {/* Create New Config */}
        <button
          onClick={handleCreateConfig}
          className="flex items-center gap-4 p-6 bg-bg-secondary border border-border rounded-lg hover:bg-bg-elevated hover:border-border-hover transition-all group"
        >
          <div className="p-3 bg-success-muted rounded-lg">
            <Plus className="w-6 h-6 text-success" />
          </div>
          <div className="text-left flex-1">
            <h3 className="text-lg font-semibold text-text-primary mb-1">Create New Config</h3>
            <p className="text-sm text-text-tertiary">
              Start fresh with a new unified configuration
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-text-tertiary group-hover:text-success transition-colors" />
        </button>
      </div>

      {/* Current Project Status */}
      {hasCurrentProject && (
        <div className="mb-8 p-4 bg-bg-secondary border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FolderOpen className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-text-primary">Current Project</p>
                <p className="text-xs text-text-tertiary font-mono truncate max-w-[300px]">
                  {currentProject}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-text-secondary">{detectedCount} tools detected</p>
              </div>
              {detectedCount >= 1 && (
                <button
                  onClick={handleQuickSync}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-md text-sm hover:bg-primary-hover transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sync
                </button>
              )}
              <button
                onClick={() => navigate('/project')}
                className="text-sm text-primary hover:text-primary-hover transition-colors"
              >
                View Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Unified Config */}
      <div className="mb-12">
        <button
          onClick={handleImportFromTool}
          className="w-full flex items-center gap-4 p-4 bg-bg-tertiary/50 border border-border border-dashed rounded-lg hover:bg-bg-secondary hover:border-border-hover transition-all group"
        >
          <div className="p-2 bg-bg-elevated rounded-lg">
            <Download className="w-5 h-5 text-text-tertiary" />
          </div>
          <div className="text-left flex-1">
            <h3 className="text-sm font-medium text-text-secondary">Generate Unified Config</h3>
            <p className="text-xs text-text-tertiary">
              Generate unified config from AI tools in your project
            </p>
          </div>
        </button>
      </div>

      {/* Recent Projects */}
      {recentProjects.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-text-tertiary" />
            <h2 className="text-sm font-medium text-text-tertiary">Recent Projects</h2>
          </div>
          <div className="space-y-2">
            {recentProjects.map(project => (
              <button
                key={project.path}
                onClick={() => handleOpenRecent(project.path)}
                className="w-full flex items-center gap-3 p-3 bg-bg-tertiary/50 border border-border rounded-lg hover:bg-bg-secondary hover:border-border-hover transition-all text-left"
              >
                <FolderOpen className="w-5 h-5 text-text-tertiary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-secondary truncate">{project.name}</p>
                  <p className="text-xs text-text-tertiary truncate font-mono">{project.path}</p>
                </div>
                <span className="text-xs text-text-tertiary">
                  {formatRelativeTime(project.lastOpened)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentProjects.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-text-tertiary">
            No recent projects. Open a project to get started.
          </p>
        </div>
      )}
    </div>
  );
}
