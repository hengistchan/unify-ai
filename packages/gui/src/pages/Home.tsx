/**
 * Home Page
 * Welcome screen with project management options
 */

import { useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  Plus,
  Download,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAppStore, selectRecentProjects } from '@/stores/appStore';
import { formatRelativeTime } from '@/lib/utils';

export function Home() {
  const navigate = useNavigate();
  const recentProjects = useAppStore(selectRecentProjects);
  const { setProject, addRecentProject, addToast } = useAppStore();

  const handleOpenProject = async () => {
    // In a real Electron app, this would use the dialog API
    // For now, simulate with a mock path
    const mockPath = '/Users/example/my-project';

    // Simulate file selection
    const path = prompt('Enter project path:', mockPath);
    if (path) {
      setProject(path);
      addRecentProject({
        path,
        name: path.split('/').pop() ?? path,
        lastOpened: new Date().toISOString(),
      });
      addToast({
        type: 'success',
        title: 'Project opened',
        message: path,
      });
      navigate('/project');
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

  const handleOpenRecent = (path: string) => {
    setProject(path);
    addRecentProject({
      path,
      name: path.split('/').pop() ?? path,
      lastOpened: new Date().toISOString(),
    });
    navigate('/project');
  };

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-4">
          <Sparkles className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-text-primary mb-3">
          Welcome to Unify AI
        </h1>
        <p className="text-lg text-text-tertiary max-w-lg mx-auto">
          Unified configuration management for AI coding assistants.
          Sync your configs across Cursor, Claude Code, Copilot, and more.
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
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              Open Project
            </h3>
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
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              Create New Config
            </h3>
            <p className="text-sm text-text-tertiary">
              Start fresh with a new unified configuration
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-text-tertiary group-hover:text-success transition-colors" />
        </button>
      </div>

      {/* Import from Tool */}
      <div className="mb-12">
        <button
          onClick={handleImportFromTool}
          className="w-full flex items-center gap-4 p-4 bg-bg-tertiary/50 border border-border border-dashed rounded-lg hover:bg-bg-secondary hover:border-border-hover transition-all group"
        >
          <div className="p-2 bg-bg-elevated rounded-lg">
            <Download className="w-5 h-5 text-text-tertiary" />
          </div>
          <div className="text-left flex-1">
            <h3 className="text-sm font-medium text-text-secondary">
              Import from Tool
            </h3>
            <p className="text-xs text-text-tertiary">
              Import existing configuration from a specific AI tool
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
            {recentProjects.map((project) => (
              <button
                key={project.path}
                onClick={() => handleOpenRecent(project.path)}
                className="w-full flex items-center gap-3 p-3 bg-bg-tertiary/50 border border-border rounded-lg hover:bg-bg-secondary hover:border-border-hover transition-all text-left"
              >
                <FolderOpen className="w-5 h-5 text-text-tertiary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-secondary truncate">
                    {project.name}
                  </p>
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
