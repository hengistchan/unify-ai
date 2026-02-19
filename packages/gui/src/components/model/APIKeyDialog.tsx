/**
 * API Key Dialog
 * Modal for managing API keys
 */

import { useState } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { Modal, Button } from '../common';
import { X, Eye, EyeOff, Lock } from 'lucide-react';

interface APIKeyDialogProps {
  open: boolean;
  onClose: () => void;
  providerId: string;
  providerName: string;
}

export function APIKeyDialog({ open, onClose, providerId, providerName }: APIKeyDialogProps) {
  const { setAPIKey, validateAPIKey } = useModelStore();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const handleValidate = async () => {
    if (!apiKey.trim()) return;

    setValidating(true);
    try {
      // First save the key
      await setAPIKey({
        providerId,
        key: apiKey.trim(),
      });

      // Then validate
      const isValid = await validateAPIKey(providerId);
      setValidationStatus(isValid ? 'valid' : 'invalid');
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationStatus('invalid');
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      await setAPIKey({
        providerId,
        key: apiKey.trim(),
      });
      handleClose();
    } catch (error) {
      console.error('Failed to save API key:', error);
      alert(error instanceof Error ? error.message : 'Failed to save API key');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setApiKey('');
    setShowKey(false);
    setValidationStatus('idle');
    onClose();
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-xl font-bold">API Key for {providerName}</h2>
          <button onClick={handleClose} className="text-text-secondary hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2 rounded bg-success-muted p-3 text-sm">
            <Lock className="h-4 w-4 text-success" />
            <span className="text-success">API keys are encrypted and stored securely</span>
          </div>

          <div>
            <label className="block text-sm font-medium">API Key</label>
            <div className="relative mt-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setValidationStatus('idle');
                }}
                className="w-full rounded border border-border bg-surface px-3 py-2 pr-20 font-mono text-sm"
                placeholder="Enter your API key"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidate}
              loading={validating}
              disabled={!apiKey.trim()}
            >
              Validate
            </Button>
            {validationStatus === 'valid' && (
              <span className="text-sm text-success">✓ Valid</span>
            )}
            {validationStatus === 'invalid' && (
              <span className="text-sm text-error">✗ Invalid</span>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={loading}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
