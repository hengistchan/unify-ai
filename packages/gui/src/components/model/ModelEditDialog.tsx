/**
 * Model Edit Dialog Component
 * Modal for editing model properties
 */

import { useState, useEffect } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { Modal, Button, Input } from '../common';
import { AlertCircle } from 'lucide-react';
import type { ModelInfo, UpdateModelInput } from '@unify-ai/core/model';

interface ModelEditDialogProps {
  open: boolean;
  onClose: () => void;
  providerId: string;
  toolId?: string;
  model: ModelInfo | null;
  onSuccess: () => void;
}

interface FormErrors {
  displayName?: string;
  contextWindow?: string;
  maxOutputTokens?: string;
}

export function ModelEditDialog({
  open,
  onClose,
  providerId,
  toolId,
  model,
  onSuccess,
}: ModelEditDialogProps) {
  const { updateModelDetails, deleteModel } = useModelStore();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState<UpdateModelInput>({
    displayName: '',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    pricing: {
      inputPerK: 0,
      outputPerK: 0,
    },
    enabled: true,
  });

  useEffect(() => {
    if (model && open) {
      setFormData({
        displayName: model.displayName,
        contextWindow: model.contextWindow,
        maxOutputTokens: model.maxOutputTokens,
        pricing: {
          inputPerK: model.pricing.inputPerK,
          outputPerK: model.pricing.outputPerK,
        },
        enabled: model.enabled,
      });
      setErrors({});
      setError(null);
    }
  }, [model, open]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.displayName?.trim()) {
      newErrors.displayName = 'Display name is required';
    }

    if (formData.contextWindow !== undefined && formData.contextWindow < 1) {
      newErrors.contextWindow = 'Context window must be at least 1';
    }

    if (formData.maxOutputTokens !== undefined && formData.maxOutputTokens < 1) {
      newErrors.maxOutputTokens = 'Max output tokens must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!model || !validateForm()) return;

    setSaving(true);
    setError(null);

    try {
      await updateModelDetails(providerId, model.id, formData, toolId);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update model');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!model) return;

    if (!confirm(`Delete model "${model.displayName}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteModel(providerId, model.id, toolId);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    setError(null);
    onClose();
  };

  const updateField = <K extends keyof UpdateModelInput>(field: K, value: UpdateModelInput[K]) => {
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

  if (!open || !model) return null;

  return (
    <Modal isOpen={open} onClose={handleClose} title={`Edit ${model.displayName}`} size="lg">
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded bg-error-muted p-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded bg-bg-tertiary p-3 text-sm">
          <span className="text-text-secondary">Model ID: </span>
          <span className="font-mono text-text-primary">{model.id}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Display Name"
            value={formData.displayName || ''}
            onChange={e => updateField('displayName', e.target.value)}
            error={errors.displayName}
          />

          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-enabled"
                checked={formData.enabled ?? true}
                onChange={e => updateField('enabled', e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="edit-enabled" className="text-sm text-text-primary">
                Model is enabled
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Context Window (tokens)"
            type="number"
            value={formData.contextWindow ?? 8192}
            onChange={e => updateField('contextWindow', parseInt(e.target.value) || 0)}
            error={errors.contextWindow}
          />

          <Input
            label="Max Output Tokens"
            type="number"
            value={formData.maxOutputTokens ?? 4096}
            onChange={e => updateField('maxOutputTokens', parseInt(e.target.value) || 0)}
            error={errors.maxOutputTokens}
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
            />

            <Input
              label="Output Price ($)"
              type="number"
              step="0.001"
              min="0"
              value={formData.pricing?.outputPerK ?? 0}
              onChange={e => updatePricing('outputPerK', e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button variant="danger" onClick={handleDelete} loading={deleting} disabled={saving}>
            Delete Model
          </Button>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={saving || deleting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving} disabled={deleting}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
