import { FolderOpen, RefreshCw, ArrowRight } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

export function HomePage() {
  const { currentProject, detectedTools, syncStatus, setProject, setDetectedTools, setSyncStatus } = useAppStore();

  const handleOpenFolder = async () => {
    if (window.electronAPI) {
      const folder = await window.electronAPI.openFolder();
      if (folder) {
        setProject(folder);
        const tools = await window.electronAPI.detectTools(folder);
        // Convert string[] to DetectedTool[]
        const detectedToolsList = tools.map((id) => ({
          id: id as any,
          name: id,
          detected: true,
          hasRules: true,
          hasMcp: false,
          hasSettings: false,
        }));
        setDetectedTools(detectedToolsList);
      }
    }
  };

  const handleSync = async () => {
    if (!currentProject || detectedTools.length === 0) return;

    setSyncStatus('syncing');
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.syncConfig(
          {},
          detectedTools.map((t) => t.id)
        );
        setSyncStatus(result.success ? 'success' : 'error');
      }
    } catch (error) {
      setSyncStatus('error');
    }
  };

  return (
    <div className="h-full p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Welcome to Unify AI
          </h1>
          <p className="text-text-secondary">
            Manage and synchronize your AI coding assistant configurations across multiple tools.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Open Folder Card */}
          <div className="card hover:border-border-hover transition-colors cursor-pointer" onClick={handleOpenFolder}>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary-muted rounded-lg">
                <FolderOpen className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary mb-1">Open Project</h3>
                <p className="text-sm text-text-tertiary">
                  Select a project folder to detect and manage AI tool configurations.
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-text-tertiary" />
            </div>
          </div>

          {/* Sync Card */}
          <div
            className={`card transition-colors ${
              currentProject && detectedTools.length > 0
                ? 'hover:border-border-hover cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
            onClick={currentProject && detectedTools.length > 0 ? handleSync : undefined}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${syncStatus === 'syncing' ? 'bg-info-muted' : 'bg-success-muted'}`}>
                <RefreshCw className={`w-6 h-6 ${syncStatus === 'syncing' ? 'text-info animate-spin' : 'text-success'}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary mb-1">Sync Configurations</h3>
                <p className="text-sm text-text-tertiary">
                  Synchronize your unified configuration across all detected AI tools.
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-text-tertiary" />
            </div>
          </div>
        </div>

        {/* Current Project Info */}
        {currentProject && (
          <div className="card mb-8">
            <h3 className="font-semibold text-text-primary mb-4">Current Project</h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-tertiary">Path:</span>
              <code className="px-2 py-1 bg-bg-tertiary rounded text-text-secondary font-mono text-xs">
                {currentProject}
              </code>
            </div>
            {detectedTools.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-text-secondary mb-2">
                  Detected Tools ({detectedTools.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {detectedTools.map((tool) => (
                    <span
                      key={tool.id}
                      className="px-2 py-1 bg-bg-tertiary text-text-secondary rounded text-sm"
                    >
                      {tool.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Getting Started */}
        <div className="card">
          <h3 className="font-semibold text-text-primary mb-4">Getting Started</h3>
          <ol className="space-y-3 text-text-secondary">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-muted text-primary rounded-full flex items-center justify-center text-sm font-medium">
                1
              </span>
              <span>Open a project folder containing AI tool configurations</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-muted text-primary rounded-full flex items-center justify-center text-sm font-medium">
                2
              </span>
              <span>Review detected tools and their configurations</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-muted text-primary rounded-full flex items-center justify-center text-sm font-medium">
                3
              </span>
              <span>Sync configurations to keep all tools consistent</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
