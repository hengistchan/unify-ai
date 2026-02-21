/**
 * Models Page
 * Main page for managing AI providers and models
 */

import { useEffect, useState } from 'react';
import { useModelStore } from '../stores/modelStore';
import { ProviderList } from '../components/model/ProviderList';
import { ProviderDetail } from '../components/model/ProviderDetail';
import { UsageDashboard } from '../components/model/UsageDashboard';
import { AddProviderDialog } from '../components/model/AddProviderDialog';
import { ProxyControl } from '../components/model/ProxyControl';
import { Cpu, Plus, Settings } from 'lucide-react';
import { Button } from '../components/common';

export function Models() {
  const {
    providers,
    selectedProviderId,
    loading,
    error,
    loadProviders,
    loadActiveProvider,
    selectProvider,
    initializeTrayListener,
  } = useModelStore();

  const [showAddDialog, setShowAddDialog] = useState(false);

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

  const selectedProvider = providers.find(p => p.id === selectedProviderId);

  return (
    <div className="flex h-screen">
      {/* Provider Sidebar */}
      <div className="w-64 border-r border-border bg-surface p-4 overflow-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Providers</h2>
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        <ProviderList
          providers={providers}
          selectedId={selectedProviderId}
          onSelect={selectProvider}
        />

        {loading && (
          <div className="mt-4 text-center text-sm text-text-secondary">
            Loading...
          </div>
        )}

        {error && (
          <div className="mt-4 rounded bg-error-muted p-2 text-sm text-error">
            {error}
          </div>
        )}
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
            <Button
              className="mt-4 gap-2"
              onClick={() => setShowAddDialog(true)}
            >
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
      <AddProviderDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />
    </div>
  );
}
