/**
 * Add Model Dialog Component
 * Modal for adding a new model to a provider
 */

import { useState } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { Modal, Button, Input } from '../common';
import { Plus, AlertCircle } from 'lucide-react';
import type { AddModelInput } from '@unify-ai/core/model';

interface AddModelDialogProps {
  open: boolean;
  onClose: () => void;
  providerId: string;
  toolId?: string;
  onSuccess: () => void;
}

interface FormErrors {
  id?: string;
  displayName?: string;
  contextWindow?: string;
  maxOutputTokens?: string;
}

export function AddModelDialog({
  open,
  onClose,
  providerId,
  toolId,
  onSuccess,
}: AddModelDialogProps) {
  const { addModel } = useModelStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState<AddModelInput>({
    id: '',
    displayName: '',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    pricing: {
      inputPerK: 0,
      outputPerK: 0,
    },
    enabled: true,
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.id.trim()) {
      newErrors.id = 'Model ID is required';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.id)) {
      newErrors.id = 'Model ID can only contain letters, numbers, hyphens, and underscores';
    }

    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    if (formData.contextWindow < 1) {
      newErrors.contextWindow = 'Context window must be at least 1';
    }

    if (formData.maxOutputTokens < 1) {
      newErrors.maxOutputTokens = 'Max output tokens must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setError(null);

    try {
      await addModel(providerId, formData, toolId);
      handleReset();
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add model');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData({
      id: '',
      displayName: '',
      contextWindow: 8192,
      maxOutputTokens: 4096,
      pricing: {
        inputPerK: 0,
        outputPerK: 0,
      },
      enabled: true,
    });
    setErrors({});
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const updateField = <K extends keyof AddModelInput>(field: K, value: AddModelInput[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const updatePricing = (field: 'inputPerK' | 'outputPerK', value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [field]: numValue,
      },
    }));
  };

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={handleClose} title="Add Model" size="lg">
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded bg-error-muted p-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Model ID"
            value={formData.id}
            onChange={e => updateField('id', e.target.value)}
            error={errors.id}
            hint="Unique identifier (e.g., gpt-4o-mini)"
            placeholder="model-id"
          />

          <Input
            label="Display Name"
            value={formData.displayName}
            onChange={e => updateField('displayName', e.target.value)}
            error={errors.displayName}
            hint="Human-readable name"
            placeholder="GPT-4o Mini"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Context Window (tokens)"
            type="number"
            value={formData.contextWindow}
            onChange={e => updateField('contextWindow', parseInt(e.target.value) || 0)}
            error={errors.contextWindow}
            hint="Maximum context length"
          />

          <Input
            label="Max Output Tokens"
            type="number"
            value={formData.maxOutputTokens}
            onChange={e => updateField('maxOutputTokens', parseInt(e.target.value) || 0)}
            error={errors.maxOutputTokens}
            hint="Maximum output length"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-primary">
            Pricing (per 1K tokens)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Input Price ($)"
              type="number"
              step="0.001"
              min="0"
              value={formData.pricing?.inputPerK ?? 0}
              onChange={e => updatePricing('inputPerK', e.target.value)}
              hint="Cost per 1K input tokens"
            />

            <Input
              label="Output Price ($)"
              type="number"
              step="0.001"
              min="0"
              value={formData.pricing?.outputPerK ?? 0}
              onChange={e => updatePricing('outputPerK', e.target.value)}
              hint="Cost per 1K output tokens"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={formData.enabled}
            onChange={e => updateField('enabled', e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <label htmlFor="enabled" className="text-sm text-text-primary">
            Model is enabled
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving} icon={<Plus className="h-4 w-4" />}>
            {saving ? 'Adding...' : 'Add Model'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
