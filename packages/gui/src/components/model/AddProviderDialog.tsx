/**
 * Add Provider Dialog
 * Modal for adding a new AI provider
 */

import { useState } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { Modal, Button } from '../common';
import type { CreateProviderInput, ProviderType } from '@unify-ai/core/model';

interface AddProviderDialogProps {
  open: boolean;
  onClose: () => void;
}

const PROVIDER_TEMPLATES: Array<{ id: string; name: string; type: ProviderType }> = [
  { id: 'openai', name: 'OpenAI', type: 'openai-compatible' },
  { id: 'anthropic', name: 'Anthropic', type: 'anthropic' },
  { id: 'deepseek', name: 'DeepSeek', type: 'openai-compatible' },
  { id: 'google', name: 'Google AI', type: 'openai-compatible' },
  { id: 'azure-openai', name: 'Azure OpenAI', type: 'azure' },
];

export function AddProviderDialog({ open, onClose }: AddProviderDialogProps) {
  const { createProvider } = useModelStore();
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    const template = PROVIDER_TEMPLATES.find(t => t.id === type);
    if (template) {
      setName(template.name);
    }
    setStep('configure');
  };

  const handleCreate = async () => {
    if (!selectedType || !name.trim()) return;

    setLoading(true);
    try {
      const template = PROVIDER_TEMPLATES.find(t => t.id === selectedType);
      if (!template) throw new Error('Invalid provider type');

      const input: CreateProviderInput = {
        id: selectedType,
        name: name.trim(),
        type: template.type,
      };

      await createProvider(input);

      // Set API key if provided
      if (apiKey.trim()) {
        const { setAPIKey } = useModelStore.getState();
        await setAPIKey({
          providerId: selectedType,
          key: apiKey.trim(),
        });
      }

      handleClose();
    } catch (error) {
      console.error('Failed to create provider:', error);
      alert(error instanceof Error ? error.message : 'Failed to create provider');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedType(null);
    setName('');
    setApiKey('');
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title={step === 'select' ? 'Add Provider' : 'Configure Provider'}
      size="lg"
    >
      {step === 'select' ? (
        <div className="grid grid-cols-2 gap-3">
          {PROVIDER_TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => handleSelectType(template.id)}
              className="rounded border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary-muted"
            >
              <p className="font-medium">{template.name}</p>
              <p className="mt-1 text-xs text-text-secondary">{template.type}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Provider name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">API Key (Optional)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-sm font-mono"
              placeholder="sk-..."
            />
            <p className="mt-1 text-xs text-text-secondary">
              You can add the API key later if needed
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setStep('select')}>
              Back
            </Button>
            <Button onClick={handleCreate} loading={loading}>
              Add Provider
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
