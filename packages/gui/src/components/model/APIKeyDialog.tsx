/**
 * API Key Dialog
 * Modal for managing API keys with validation before save
 */

import { useState } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { Modal, Button } from '../common';
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import type { APIKeyValidationResult } from '@unify-ai/core/model';

interface APIKeyDialogProps {
  open: boolean;
  onClose: () => void;
  providerId: string;
  providerName: string;
  toolId?: string;
}

export function APIKeyDialog({
  open,
  onClose,
  providerId,
  providerName,
  toolId,
}: APIKeyDialogProps) {
  const { setAPIKey, validateAPIKeyWithoutSaving } = useModelStore();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<APIKeyValidationResult | null>(null);

  /**
   * Validate API key without saving
   * Makes actual API call to verify the key works
   */
  const handleValidate = async () => {
    if (!apiKey.trim()) return;

    setValidating(true);
    setValidationResult(null);

    try {
      const result = await validateAPIKeyWithoutSaving(providerId, apiKey.trim());
      setValidationResult(result);
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationResult({
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        errorType: 'unknown',
      });
    } finally {
      setValidating(false);
    }
  };

  /**
   * Validate then save if valid
   * This is the recommended flow for users
   */
  const handleValidateAndSave = async () => {
    if (!apiKey.trim()) return;

    setValidating(true);
    setValidationResult(null);

    try {
      const result = await validateAPIKeyWithoutSaving(providerId, apiKey.trim());
      setValidationResult(result);

      if (result.valid) {
        // Key is valid, save it
        setSaving(true);
        try {
          await setAPIKey({
            providerId,
            key: apiKey.trim(),
            toolId: toolId ?? 'global',
          });
          handleClose();
        } catch (error) {
          console.error('Failed to save API key:', error);
          setValidationResult({
            valid: false,
            error: error instanceof Error ? error.message : 'Failed to save API key',
            errorType: 'unknown',
          });
        } finally {
          setSaving(false);
        }
      }
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationResult({
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        errorType: 'unknown',
      });
    } finally {
      setValidating(false);
    }
  };

  const handleClose = () => {
    setApiKey('');
    setShowKey(false);
    setValidationResult(null);
    onClose();
  };

  /**
   * Get user-friendly error message
   */
  const getErrorMessage = (result: APIKeyValidationResult): string => {
    switch (result.errorType) {
      case 'invalid_key':
        return 'Invalid API key. Please check and try again.';
      case 'insufficient_quota':
        return 'API key is valid but quota exceeded. Please check your billing.';
      case 'rate_limited':
        return 'Rate limited. Please try again later.';
      case 'network_error':
        return 'Network error. Please check your internet connection.';
      case 'timeout':
        return 'Validation timed out. Please try again.';
      default:
        return result.error || 'Validation failed. Please try again.';
    }
  };

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={handleClose} title={`API Key for ${providerName}`}>
      <div className="space-y-4">
        {/* Security notice */}
        <div className="flex items-center gap-2 rounded bg-success-muted p-3 text-sm">
          <Lock className="h-4 w-4 text-success flex-shrink-0" />
          <span className="text-success">API keys are encrypted and stored securely</span>
        </div>

        {/* API Key input */}
        <div>
          <label className="block text-sm font-medium">API Key</label>
          <div className="relative mt-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => {
                setApiKey(e.target.value);
                setValidationResult(null);
              }}
              className="w-full rounded border border-border bg-surface px-3 py-2 pr-20 font-mono text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter your API key"
              autoFocus
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

        {/* Validation result */}
        {validationResult && (
          <div
            className={`flex items-start gap-2 rounded p-3 text-sm ${
              validationResult.valid ? 'bg-success-muted text-success' : 'bg-error-muted text-error'
            }`}
          >
            {validationResult.valid ? (
              <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            )}
            <span>
              {validationResult.valid
                ? 'API key is valid! Click Save to store it.'
                : getErrorMessage(validationResult)}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleValidate}
              loading={validating}
              disabled={!apiKey.trim() || saving}
            >
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Validating...
                </>
              ) : (
                'Test Key'
              )}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={saving || validating}>
              Cancel
            </Button>
            <Button
              onClick={handleValidateAndSave}
              loading={validating || saving}
              disabled={!apiKey.trim()}
            >
              {validating ? 'Validating...' : saving ? 'Saving...' : 'Validate & Save'}
            </Button>
          </div>
        </div>

        {/* Help text */}
        <p className="text-xs text-text-secondary">
          Click "Test Key" to validate without saving, or "Validate & Save" to verify and store your
          key in one step.
        </p>
      </div>
    </Modal>
  );
}
