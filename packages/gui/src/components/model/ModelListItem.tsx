/**
 * Model List Item Component
 * Displays a single model with action buttons
 */

import { Check, Pencil, Trash2, Power, PowerOff } from 'lucide-react';
import type { ModelInfo } from '@unify-ai/core/model';
import { Button } from '../common';

interface ModelListItemProps {
  model: ModelInfo;
  isDefault: boolean;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}

export function ModelListItem({
  model,
  isDefault,
  onSetDefault,
  onEdit,
  onDelete,
  onToggleEnabled,
}: ModelListItemProps) {
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  const formatPrice = (pricePerK: number) => {
    if (pricePerK === 0) return 'Free';
    return `$${pricePerK.toFixed(2)}/1K`;
  };

  return (
    <div
      className={`flex items-center justify-between rounded border p-3 transition-colors ${
        model.enabled
          ? 'border-border bg-surface hover:border-border-hover'
          : 'border-border bg-bg-tertiary opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleEnabled}
          className={`flex-shrink-0 ${model.enabled ? 'text-success' : 'text-text-tertiary'} hover:opacity-80`}
          title={model.enabled ? 'Click to disable' : 'Click to enable'}
        >
          {model.enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={`font-medium ${model.enabled ? 'text-text-primary' : 'text-text-secondary'}`}
            >
              {model.displayName}
            </p>
            {isDefault && (
              <span className="inline-flex items-center gap-1 rounded bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
                <Check className="h-3 w-3" />
                Default
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            {formatTokens(model.contextWindow)} tokens context
            {model.pricing.inputPerK > 0 || model.pricing.outputPerK > 0 ? (
              <span className="ml-2">
                {formatPrice(model.pricing.inputPerK)} in / {formatPrice(model.pricing.outputPerK)}{' '}
                out
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {!isDefault && (
          <Button variant="ghost" size="sm" onClick={onSetDefault} title="Set as default">
            <Check className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onEdit} title="Edit model">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          title="Delete model"
          className="hover:text-error"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
