/**
 * Provider Detail Component
 * Displays detailed information about a provider
 */

import { useState } from 'react';
import type { AIProvider } from '@unify-ai/core/model';
import { useModelStore } from '../../stores/modelStore';
import { Button, Card } from '../common';
import { Settings, Trash2, Key, Check, Pencil } from 'lucide-react';
import { APIKeyDialog } from './APIKeyDialog';

interface ProviderDetailProps {
  provider: AIProvider;
}

export function ProviderDetail({ provider }: ProviderDetailProps) {
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [editingBaseUrl, setEditingBaseUrl] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState(provider.baseUrl || '');
  const { updateProvider, deleteProvider, setProviderEnabled } = useModelStore();

  const handleToggleEnabled = async () => {
    await setProviderEnabled(provider.id, !provider.enabled);
  };

  const handleSaveBaseUrl = async () => {
    await updateProvider(provider.id, { baseUrl: baseUrlInput.trim() || undefined });
    setEditingBaseUrl(false);
  };

  const handleDelete = async () => {
    if (confirm(`Delete provider "${provider.name}"? This cannot be undone.`)) {
      await deleteProvider(provider.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{provider.name}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Type: {provider.type} • Priority: {provider.priority}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleToggleEnabled}>
            {provider.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* API Key Section */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <h3 className="font-semibold">API Key</h3>
          </div>
          <Button size="sm" onClick={() => setShowKeyDialog(true)}>
            {provider.enabled ? 'Update Key' : 'Add Key'}
          </Button>
        </div>
        <p className="mt-2 text-sm text-text-secondary">Status: Encrypted and secure</p>
      </Card>

      {/* Models Section */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <h3 className="font-semibold">Models</h3>
        </div>
        <div className="mt-3 space-y-2">
          {provider.models.map(model => (
            <div
              key={model.id}
              className="flex items-center justify-between rounded border border-border p-2"
            >
              <div>
                <p className="font-medium">{model.displayName}</p>
                <p className="text-xs text-text-secondary">
                  {model.contextWindow.toLocaleString()} tokens
                </p>
              </div>
              {provider.defaultModel === model.id && (
                <div className="flex items-center gap-1 text-sm text-primary">
                  <Check className="h-4 w-4" />
                  Default
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Configuration */}
      <Card className="p-4">
        <h3 className="font-semibold">Configuration</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-text-secondary">Base URL</dt>
            {editingBaseUrl ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={baseUrlInput}
                  onChange={e => setBaseUrlInput(e.target.value)}
                  className="w-48 rounded border border-border bg-surface px-2 py-1 text-xs font-mono"
                  placeholder="https://api.openai.com/v1"
                />
                <Button size="sm" onClick={handleSaveBaseUrl}>
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <dd className="flex items-center gap-2 font-mono">
                {provider.baseUrl || 'Default'}
                <button
                  onClick={() => {
                    setBaseUrlInput(provider.baseUrl || '');
                    setEditingBaseUrl(true);
                  }}
                  className="text-text-tertiary hover:text-primary"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </dd>
            )}
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Created</dt>
            <dd>{new Date(provider.createdAt).toLocaleDateString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Updated</dt>
            <dd>{new Date(provider.updatedAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </Card>

      {/* API Key Dialog */}
      <APIKeyDialog
        open={showKeyDialog}
        onClose={() => setShowKeyDialog(false)}
        providerId={provider.id}
        providerName={provider.name}
      />
    </div>
  );
}
