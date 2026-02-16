import { Check, X, AlertCircle, Settings, FileText, Plug } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

// Supported tools with their metadata
const SUPPORTED_TOOLS = [
  { id: 'cursor', name: 'Cursor', rules: true, mcp: true, settings: true },
  { id: 'claude-code', name: 'Claude Code', rules: true, mcp: true, settings: true },
  { id: 'copilot', name: 'GitHub Copilot', rules: true, mcp: false, settings: false },
  { id: 'windsurf', name: 'Windsurf', rules: true, mcp: true, settings: true },
  { id: 'cline', name: 'Cline', rules: true, mcp: true, settings: true },
  { id: 'aider', name: 'Aider', rules: true, mcp: false, settings: true },
  { id: 'continue', name: 'Continue', rules: true, mcp: true, settings: true },
  { id: 'codex', name: 'Codex', rules: true, mcp: true, settings: true },
];

export function ToolsPage() {
  const { detectedTools, currentProject } = useAppStore();

  const detectedToolIds = new Set(detectedTools.map((t) => t.id));

  const getStatusIcon = (toolId: string) => {
    if (!currentProject) {
      return <AlertCircle className="w-4 h-4 text-text-disabled" />;
    }
    if (detectedToolIds.has(toolId as any)) {
      return <Check className="w-4 h-4 text-success" />;
    }
    return <X className="w-4 h-4 text-text-disabled" />;
  };

  const getFeatureIcon = (supported: boolean) => {
    return supported ? (
      <Check className="w-4 h-4 text-success" />
    ) : (
      <X className="w-4 h-4 text-text-disabled" />
    );
  };

  return (
    <div className="h-full p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Supported Tools
          </h1>
          <p className="text-text-secondary">
            View all supported AI coding assistants and their detected status in your project.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {SUPPORTED_TOOLS.map((tool) => {
            const detectedTool = detectedTools.find((t) => t.id === tool.id);
            const isDetected = detectedToolIds.has(tool.id as any);

            return (
              <div
                key={tool.id}
                className={`card ${
                  isDetected ? 'border-success' : ''
                } transition-colors`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        isDetected ? 'bg-success-muted' : 'bg-bg-tertiary'
                      }`}
                    >
                      <Settings
                        className={`w-5 h-5 ${
                          isDetected ? 'text-success' : 'text-text-disabled'
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text-primary">
                        {tool.name}
                      </h3>
                      <p className="text-sm text-text-tertiary">{tool.id}</p>
                    </div>
                  </div>
                  {getStatusIcon(tool.id)}
                </div>

                {/* Features */}
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-text-tertiary" />
                    <span className="text-text-tertiary">Rules</span>
                    {getFeatureIcon(tool.rules)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Plug className="w-4 h-4 text-text-tertiary" />
                    <span className="text-text-tertiary">MCP</span>
                    {getFeatureIcon(tool.mcp)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-text-tertiary" />
                    <span className="text-text-tertiary">Settings</span>
                    {getFeatureIcon(tool.settings)}
                  </div>
                </div>

                {/* Detected info */}
                {isDetected && detectedTool && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="text-xs text-text-tertiary">
                      {detectedTool.configPath && (
                        <div className="flex items-center gap-1">
                          <span>Config:</span>
                          <code className="font-mono">{detectedTool.configPath}</code>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 card">
          <h3 className="font-semibold text-text-primary mb-3">Legend</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-text-tertiary" />
              <span className="text-text-secondary">Rules - Project instructions/prompts</span>
            </div>
            <div className="flex items-center gap-2">
              <Plug className="w-4 h-4 text-text-tertiary" />
              <span className="text-text-secondary">MCP - Model Context Protocol support</span>
            </div>
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-text-tertiary" />
              <span className="text-text-secondary">Settings - Tool-specific settings</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
