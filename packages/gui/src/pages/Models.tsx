/**
 * Models Page
 * Main page for managing AI providers and models
 */

import React, { useEffect, useState } from 'react';
import { useModelStore } from '../stores/modelStore';
import { ProviderList } from '../components/model/ProviderList';
import { ProviderDetail } from '../components/model/ProviderDetail';
import { UsageDashboard } from '../components/model/UsageDashboard';
import { AddProviderDialog } from '../components/model/AddProviderDialog';
import { ProxyControl } from '../components/model/ProxyControl';
import { Cpu, Plus, Globe, LayoutGrid } from 'lucide-react';
import { Button } from '../components/common';
import { ToolIcon } from '../components/common/ToolIcon';

const TOOL_TABS = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'global', label: 'Global', icon: Globe },
  { id: 'claude-code', label: 'Claude Code', icon: null },
  { id: 'opencode', label: 'OpenCode', icon: null },
  { id: 'codex', label: 'Codex', icon: null },
  { id: 'cline', label: 'Cline', icon: null },
];

export function Models() {
  const {
    providers,
    selectedProviderId,
    selectedProviderToolId,
    loading,
    error,
    loadProviders,
    loadActiveProvider,
    selectProviderWithToolId,
    initializeTrayListener,
  } = useModelStore();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedToolTab, setSelectedToolTab] = useState('global');

  const filteredProviders = React.useMemo(() => {
    if (selectedToolTab === 'all') {
      return providers;
    }
    if (selectedToolTab === 'global') {
      return providers.filter(p => !p.toolId || p.toolId === 'global');
    }
    return providers.filter(p => p.toolId === selectedToolTab);
  }, [providers, selectedToolTab]);

  const currentToolProvider = React.useMemo(() => {
    if (selectedToolTab === 'all' || selectedToolTab === 'global') {
      return null;
    }
    return providers.find(p => p.toolId === selectedToolTab && p.isCurrentTool);
  }, [providers, selectedToolTab]);

  const globalProvider = React.useMemo(() => {
    return providers.find(p => (!p.toolId || p.toolId === 'global') && p.isCurrentGlobal);
  }, [providers]);

  // Load providers on mount
  useEffect(() => {
    loadProviders();
    loadActiveProvider();
  }, [loadProviders, loadActiveProvider]);

  // Initialize tray listener
  useEffect(() => {
    const cleanup = initializeTrayListener();
    return cleanup;
  }, [initializeTrayListener]);

  const selectedProvider = providers.find(
    p =>
      p.id === selectedProviderId && (p.toolId || 'global') === (selectedProviderToolId || 'global')
  );

  return (
    <div className="flex h-screen">
      {/* Provider Sidebar */}
      <div className="w-64 border-r border-border bg-surface p-4 overflow-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Providers</h2>
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        {/* Tool Tabs */}
        <div className="mb-4 flex flex-wrap gap-1">
          {TOOL_TABS.map(tab => {
            const isSelected = selectedToolTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedToolTab(tab.id)}
                className={`
                  flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors
                  ${
                    isSelected
                      ? 'bg-primary text-white'
                      : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                  }
                `}
              >
                {tab.id === 'all' && <LayoutGrid className="h-3 w-3" />}
                {tab.id === 'global' && <Globe className="h-3 w-3" />}
                {tab.id !== 'all' && tab.id !== 'global' && <ToolIcon toolId={tab.id} size="sm" />}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tool Override Button */}
        {selectedToolTab !== 'all' && selectedToolTab !== 'global' && (
          <div className="mb-3">
            {currentToolProvider ? (
              <div className="flex items-center justify-between rounded bg-warning-muted px-2 py-1.5 text-xs">
                <span className="truncate text-warning">Using: {currentToolProvider.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const { clearToolOverride, loadProviders } = useModelStore.getState();
                    await clearToolOverride(selectedToolTab);
                    await loadProviders();
                  }}
                >
                  Use Global
                </Button>
              </div>
            ) : globalProvider ? (
              <div className="flex items-center justify-between rounded bg-info-muted px-2 py-1.5 text-xs">
                <span className="truncate text-info">Global: {globalProvider.name}</span>
              </div>
            ) : null}
          </div>
        )}

        <ProviderList
          providers={filteredProviders}
          selectedId={selectedProviderId}
          selectedToolId={selectedProviderToolId}
          onSelect={(providerId, toolId) => {
            selectProviderWithToolId(providerId, toolId);
          }}
        />

        {loading && <div className="mt-4 text-center text-sm text-text-secondary">Loading...</div>}

        {error && <div className="mt-4 rounded bg-error-muted p-2 text-sm text-error">{error}</div>}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 bg-bg-primary">
        {selectedProvider ? (
          <ProviderDetail provider={selectedProvider} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Cpu className="h-16 w-16 text-text-secondary" />
            <h3 className="mt-4 text-xl font-semibold">No Provider Selected</h3>
            <p className="mt-2 text-text-secondary">
              Select a provider from the sidebar or add a new one
            </p>
            <Button className="mt-4 gap-2" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4" />
              Add Provider
            </Button>
          </div>
        )}
      </div>

      {/* Usage Panel */}
      <div className="w-80 border-l border-border bg-surface p-4 overflow-auto">
        <h2 className="mb-4 text-lg font-semibold">Usage & Proxy</h2>

        {/* Proxy Control */}
        <div className="mb-6">
          <ProxyControl />
        </div>

        {/* Usage Dashboard */}
        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-md font-semibold">Usage Statistics</h3>
          <UsageDashboard />
        </div>
      </div>

      {/* Add Provider Dialog */}
      <AddProviderDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
    </div>
  );
}
