/**
 * Tool Detail Page
 * Detailed view of a specific AI tool configuration
 */

import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Server,
  Settings,
  Edit,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { Button, Badge, Card } from '@/components/common';
import { useAppStore } from '@/stores/appStore';

// Tool information map
const toolInfo: Record<string, { name: string; description: string; emoji: string }> = {
  'claude-code': {
    name: 'Claude Code',
    description: 'Anthropic\'s official CLI for Claude',
    emoji: '🤖',
  },
  cursor: {
    name: 'Cursor',
    description: 'AI-first code editor',
    emoji: '⚡',
  },
  copilot: {
    name: 'GitHub Copilot',
    description: 'AI pair programmer by GitHub',
    emoji: '🐙',
  },
  windsurf: {
    name: 'Windsurf',
    description: 'AI-powered IDE by Codeium',
    emoji: '🌊',
  },
  codex: {
    name: 'Codex',
    description: 'OpenAI\'s coding assistant',
    emoji: '📝',
  },
  cline: {
    name: 'Cline',
    description: 'Autonomous coding agent for VS Code',
    emoji: '📋',
  },
  aider: {
    name: 'Aider',
    description: 'AI pair programming in your terminal',
    emoji: '🤝',
  },
  continue: {
    name: 'Continue',
    description: 'Open-source AI code assistant',
    emoji: '▶️',
  },
};

// Mock data for demonstration
const mockRules = [
  { id: '1', name: 'CLAUDE.md', path: '.claude/CLAUDE.md', enabled: true, lastModified: '2024-01-15' },
  { id: '2', name: 'plans.md', path: '.claude/rules/plans.md', enabled: true, lastModified: '2024-01-14' },
  { id: '3', name: 'typescript.md', path: '.claude/rules/typescript.md', enabled: false, lastModified: '2024-01-10' },
];

const mockMCPServers = [
  { id: '1', name: 'filesystem', command: 'mcp-filesystem', enabled: true },
  { id: '2', name: 'github', command: 'mcp-github', enabled: true },
  { id: '3', name: 'postgres', command: 'mcp-postgres', enabled: false },
];

const mockSettings = [
  { key: 'defaultModel', value: 'claude-3-5-sonnet', type: 'string' },
  { key: 'autoSave', value: 'true', type: 'boolean' },
  { key: 'timeout', value: '30000', type: 'number' },
];

export function ToolDetail() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const { addToast } = useAppStore();

  const info = toolInfo[toolId ?? ''];

  if (!info) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-semibold text-text-secondary mb-2">Tool not found</h2>
        <p className="text-text-tertiary mb-4">The tool "{toolId}" was not found.</p>
        <Button onClick={() => navigate('/project')}>
          Back to Project
        </Button>
      </div>
    );
  }

  const handleEdit = (section: string) => {
    addToast({
      type: 'info',
      title: 'Coming soon',
      message: `Edit ${section} feature is in development`,
    });
  };

  const handleView = (section: string, item: string) => {
    addToast({
      type: 'info',
      title: 'Coming soon',
      message: `View ${item} in ${section} feature is in development`,
    });
  };

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/project')}
          className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary-muted flex items-center justify-center">
            <span className="text-2xl">{info.emoji}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">{info.name}</h1>
              <Badge variant="success">Detected</Badge>
            </div>
            <p className="text-text-tertiary">{info.description}</p>
          </div>
        </div>
      </div>

      {/* Rules Section */}
      <Card className="mb-6">
        <Card.Header
          title="Rules"
          subtitle={`${mockRules.length} rule files configured`}
          icon={<FileText className="w-5 h-5" />}
          badge={{ text: 'Full Support', variant: 'success' }}
          action={
            <Button variant="secondary" size="sm" onClick={() => handleEdit('rules')}>
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          }
        />
        <Card.Body className="p-0">
          <div className="divide-y divide-border">
            {mockRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-4 hover:bg-bg-hover/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-text-tertiary" />
                  <div>
                    <p className="text-sm font-medium text-text-secondary">{rule.name}</p>
                    <p className="text-xs text-text-tertiary font-mono">{rule.path}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {rule.enabled ? (
                    <Badge variant="success">Enabled</Badge>
                  ) : (
                    <Badge variant="default">Disabled</Badge>
                  )}
                  <span className="text-xs text-text-tertiary">{rule.lastModified}</span>
                  <button
                    onClick={() => handleView('rules', rule.name)}
                    className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>

      {/* MCP Servers Section */}
      <Card className="mb-6">
        <Card.Header
          title="MCP Servers"
          subtitle={`${mockMCPServers.filter((s) => s.enabled).length} of ${mockMCPServers.length} servers enabled`}
          icon={<Server className="w-5 h-5" />}
          badge={{ text: 'Full Support', variant: 'success' }}
          action={
            <Button variant="secondary" size="sm" onClick={() => handleEdit('MCP servers')}>
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          }
        />
        <Card.Body className="p-0">
          <div className="divide-y divide-border">
            {mockMCPServers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between p-4 hover:bg-bg-hover/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-text-tertiary" />
                  <div>
                    <p className="text-sm font-medium text-text-secondary">{server.name}</p>
                    <p className="text-xs text-text-tertiary font-mono">{server.command}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {server.enabled ? (
                    <Badge variant="success">Enabled</Badge>
                  ) : (
                    <Badge variant="default">Disabled</Badge>
                  )}
                  <button
                    onClick={() => handleView('MCP', server.name)}
                    className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>

      {/* Settings Section */}
      <Card>
        <Card.Header
          title="Settings"
          subtitle={`${mockSettings.length} settings configured`}
          icon={<Settings className="w-5 h-5" />}
          badge={{ text: 'Full Support', variant: 'success' }}
          action={
            <Button variant="secondary" size="sm" onClick={() => handleEdit('settings')}>
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          }
        />
        <Card.Body className="p-0">
          <div className="divide-y divide-border">
            {mockSettings.map((setting, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 hover:bg-bg-hover/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-text-tertiary" />
                  <p className="text-sm font-medium text-text-secondary font-mono">{setting.key}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="info">{setting.type}</Badge>
                  <span className="text-sm text-text-tertiary font-mono">{setting.value}</span>
                </div>
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>

      {/* Tool Links */}
      <div className="mt-6 p-4 bg-bg-secondary border border-border rounded-lg">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Resources</h3>
        <div className="flex gap-4">
          <a
            href="#"
            className="flex items-center gap-1 text-sm text-primary hover:text-primary-hover transition-colors"
          >
            Documentation
            <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href="#"
            className="flex items-center gap-1 text-sm text-primary hover:text-primary-hover transition-colors"
          >
            Configuration Guide
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
