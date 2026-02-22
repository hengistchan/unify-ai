/**
 * Tool Detail Page
 * Detailed view of a specific AI tool configuration
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Server,
  Settings,
  Edit,
  Eye,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button, Badge, Card, ToolIcon, getToolName } from '@/components/common';
import { useAppStore, selectUnifiedConfig, selectDetectedTools } from '@/stores/appStore';
import type { RuleConfig, MCPServerConfig, ToolSettings } from '@/stores/appStore';

// Tool information map (without emoji - uses ToolIcon component)
const toolDescriptions: Record<string, string> = {
  'claude-code': "Anthropic's official CLI for Claude",
  cursor: 'AI-first code editor',
  copilot: 'AI pair programmer by GitHub',
  windsurf: 'AI-powered IDE by Codeium',
  codex: "OpenAI's coding assistant",
  cline: 'Autonomous coding agent for VS Code',
  aider: 'AI pair programming in your terminal',
  opencode: 'Interactive CLI tool for software engineering tasks',
};

export function ToolDetail() {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const unifiedConfig = useAppStore(selectUnifiedConfig);
  const detectedTools = useAppStore(selectDetectedTools);
  const { loadToolConfig, addToast } = useAppStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const description = toolDescriptions[toolId ?? ''];
  const tool = detectedTools.find(t => t.id === toolId);
  const toolName = toolId ? getToolName(toolId) : 'Unknown';

  // Load tool config on mount
  useEffect(() => {
    if (toolId && tool?.detected) {
      console.log('\n🔧 Tool Detail Page');
      console.log('────────────────────────────────');
      console.log('Tool ID:', toolId);
      console.log('Tool Name:', toolName);
      console.log('Config Path:', tool.configPath);
      console.log('Capabilities:', {
        rules: tool.hasRules,
        mcp: tool.hasMcp,
        settings: tool.hasSettings,
      });
      console.log('────────────────────────────────\n');

      setIsLoading(true);
      setError(null);
      loadToolConfig(toolId)
        .then(() => {
          setIsLoading(false);
          console.log('[ToolDetail] Config loaded successfully');
        })
        .catch(err => {
          setIsLoading(false);
          setError(err instanceof Error ? err.message : 'Failed to load config');
          console.error('[ToolDetail] Failed to load config:', err);
        });
    }
  }, [toolId, tool?.detected, loadToolConfig, toolName, tool]);

  // Log config details when loaded
  useEffect(() => {
    if (unifiedConfig && toolId) {
      console.log('\n📋 Loaded Configuration for', toolId);
      console.log('────────────────────────────────');
      console.log('Rules:', unifiedConfig.rules?.length || 0);
      if (unifiedConfig.rules?.length) {
        unifiedConfig.rules.forEach((rule, i) => {
          console.log(
            `  ${i + 1}. ${rule.name || rule.id} (${rule.enabled !== false ? 'enabled' : 'disabled'})`
          );
        });
      }
      console.log('MCP Servers:', unifiedConfig.mcp?.servers?.length || 0);
      if (unifiedConfig.mcp?.servers?.length) {
        unifiedConfig.mcp.servers.forEach((server, i) => {
          console.log(`  ${i + 1}. ${server.name} - ${server.command}`);
        });
      }
      console.log('Has Settings:', !!unifiedConfig.settings);
      console.log('────────────────────────────────\n');
    }
  }, [unifiedConfig, toolId]);

  // Extract data from unified config
  const rules: RuleConfig[] = unifiedConfig?.rules ?? [];
  const mcpServers: MCPServerConfig[] = unifiedConfig?.mcp?.servers ?? [];
  const settings: ToolSettings = unifiedConfig?.settings ?? {};

  // Flatten settings for display
  const settingsEntries: { key: string; value: string; type: string }[] = [];
  if (settings.model?.default) {
    settingsEntries.push({ key: 'model.default', value: settings.model.default, type: 'string' });
  }
  if (settings.model?.available?.length) {
    settingsEntries.push({
      key: 'model.available',
      value: settings.model.available.join(', '),
      type: 'array',
    });
  }
  if (settings.permissions?.allow?.length) {
    settingsEntries.push({
      key: 'permissions.allow',
      value: settings.permissions.allow.join(', '),
      type: 'array',
    });
  }
  if (settings.permissions?.deny?.length) {
    settingsEntries.push({
      key: 'permissions.deny',
      value: settings.permissions.deny.join(', '),
      type: 'array',
    });
  }
  if (settings.behavior?.autoSave !== undefined) {
    settingsEntries.push({
      key: 'behavior.autoSave',
      value: String(settings.behavior.autoSave),
      type: 'boolean',
    });
  }
  if (settings.behavior?.verbose !== undefined) {
    settingsEntries.push({
      key: 'behavior.verbose',
      value: String(settings.behavior.verbose),
      type: 'boolean',
    });
  }
  if (settings.behavior?.timeout !== undefined) {
    settingsEntries.push({
      key: 'behavior.timeout',
      value: String(settings.behavior.timeout),
      type: 'number',
    });
  }
  // Add tool-specific settings
  if (settings.toolSpecific) {
    for (const [key, value] of Object.entries(settings.toolSpecific)) {
      settingsEntries.push({
        key: `toolSpecific.${key}`,
        value: JSON.stringify(value),
        type: 'object',
      });
    }
  }

  if (!description) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h2 className="text-xl font-semibold text-text-secondary mb-2">Tool not found</h2>
        <p className="text-text-tertiary mb-4">The tool "{toolId}" was not found.</p>
        <Button onClick={() => navigate('/project')}>Back to Project</Button>
      </div>
    );
  }

  if (!tool?.detected) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AlertCircle className="w-12 h-12 text-warning mb-4" />
        <h2 className="text-xl font-semibold text-text-secondary mb-2">Tool not detected</h2>
        <p className="text-text-tertiary mb-4">
          The tool "{toolName}" was not detected in this project.
        </p>
        <Button onClick={() => navigate('/project')}>Back to Project</Button>
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

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/project')}
            className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary-muted flex items-center justify-center">
              {toolId && <ToolIcon toolId={toolId} size="lg" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{toolName}</h1>
              <p className="text-text-tertiary">{description}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
          <p className="text-text-secondary">Loading configuration...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/project')}
            className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary-muted flex items-center justify-center">
              {toolId && <ToolIcon toolId={toolId} size="lg" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{toolName}</h1>
              <p className="text-text-tertiary">{description}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="w-12 h-12 text-error mb-4" />
          <h2 className="text-xl font-semibold text-text-secondary mb-2">
            Failed to load configuration
          </h2>
          <p className="text-text-tertiary mb-4">{error}</p>
          <Button onClick={() => toolId && loadToolConfig(toolId)}>Retry</Button>
        </div>
      </div>
    );
  }

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
            {toolId && <ToolIcon toolId={toolId} size="lg" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">{toolName}</h1>
              <Badge variant="success">Detected</Badge>
            </div>
            <p className="text-text-tertiary">{description}</p>
          </div>
        </div>
      </div>

      {/* Rules Section */}
      <Card className="mb-6">
        <Card.Header
          title="Rules"
          subtitle={
            rules.length > 0 ? `${rules.length} rule files configured` : 'No rules configured'
          }
          icon={<FileText className="w-5 h-5" />}
          badge={{
            text: tool.hasRules ? 'Full Support' : 'Not Available',
            variant: tool.hasRules ? 'success' : 'default',
          }}
          action={
            <Button variant="secondary" size="sm" onClick={() => handleEdit('rules')}>
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          }
        />
        <Card.Body className="p-0">
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
              <FileText className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No rules configured</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 hover:bg-bg-hover/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="text-sm font-medium text-text-secondary">
                        {rule.name || rule.id}
                      </p>
                      <p className="text-xs text-text-tertiary truncate max-w-[300px]">
                        {rule.description || rule.content.slice(0, 50)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {rule.enabled !== false ? (
                      <Badge variant="success">Enabled</Badge>
                    ) : (
                      <Badge variant="default">Disabled</Badge>
                    )}
                    {rule.globs && rule.globs.length > 0 && (
                      <span className="text-xs text-text-tertiary">{rule.globs.join(', ')}</span>
                    )}
                    <button
                      onClick={() => handleView('rules', rule.name || rule.id)}
                      className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* MCP Servers Section */}
      <Card className="mb-6">
        <Card.Header
          title="MCP Servers"
          subtitle={
            mcpServers.length > 0
              ? `${mcpServers.filter(s => !s.disabled).length} of ${mcpServers.length} servers enabled`
              : 'No MCP servers configured'
          }
          icon={<Server className="w-5 h-5" />}
          badge={{
            text: tool.hasMcp ? 'Full Support' : 'Not Available',
            variant: tool.hasMcp ? 'success' : 'default',
          }}
          action={
            <Button variant="secondary" size="sm" onClick={() => handleEdit('MCP servers')}>
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          }
        />
        <Card.Body className="p-0">
          {mcpServers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
              <Server className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No MCP servers configured</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {mcpServers.map(server => (
                <div
                  key={server.name}
                  className="flex items-center justify-between p-4 hover:bg-bg-hover/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Server className="w-5 h-5 text-text-tertiary" />
                    <div>
                      <p className="text-sm font-medium text-text-secondary">{server.name}</p>
                      <p className="text-xs text-text-tertiary font-mono">
                        {server.command} {server.args?.join(' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!server.disabled ? (
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
          )}
        </Card.Body>
      </Card>

      {/* Settings Section */}
      <Card>
        <Card.Header
          title="Settings"
          subtitle={
            settingsEntries.length > 0
              ? `${settingsEntries.length} settings configured`
              : 'No settings configured'
          }
          icon={<Settings className="w-5 h-5" />}
          badge={{
            text: tool.hasSettings ? 'Full Support' : 'Not Available',
            variant: tool.hasSettings ? 'success' : 'default',
          }}
          action={
            <Button variant="secondary" size="sm" onClick={() => handleEdit('settings')}>
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          }
        />
        <Card.Body className="p-0">
          {settingsEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
              <Settings className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No settings configured</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {settingsEntries.map((setting, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 hover:bg-bg-hover/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-text-tertiary" />
                    <p className="text-sm font-medium text-text-secondary font-mono">
                      {setting.key}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="info">{setting.type}</Badge>
                    <span className="text-sm text-text-tertiary font-mono truncate max-w-[200px]">
                      {setting.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
