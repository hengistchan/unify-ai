/**
 * Provider List Component
 * Displays a list of AI providers with status indicators
 */

import type { AIProvider } from '@unify-ai/core/model';
import { useModelStore } from '../../stores/modelStore';
import { cn } from '../../utils/cn';
import { Check, AlertTriangle, X } from 'lucide-react';

interface ProviderListProps {
  providers: AIProvider[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ProviderList({ providers, selectedId, onSelect }: ProviderListProps) {
  const activeProvider = useModelStore(state => state.activeProvider);

  if (providers.length === 0) {
    return (
      <div className="rounded border border-dashed border-border p-4 text-center text-sm text-text-secondary">
        No providers configured yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {providers.map(provider => {
        const isActive = activeProvider?.id === provider.id;
        const isSelected = selectedId === provider.id;

        return (
          <button
            key={provider.id}
            onClick={() => onSelect(provider.id)}
            className={cn(
              'w-full rounded border p-3 text-left transition-colors',
              isSelected
                ? 'border-primary bg-primary-muted'
                : 'border-border hover:border-primary',
              !provider.enabled && 'opacity-50'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {isActive && (
                    <div className="h-2 w-2 rounded-full bg-success" title="Active" />
                  )}
                  <h3 className="font-medium">{provider.name}</h3>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {provider.defaultModel || 'No default model'}
                </p>
              </div>
              <ProviderStatusIcon provider={provider} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ProviderStatusIcon({ provider }: { provider: AIProvider }) {
  if (!provider.enabled) {
    return <X className="h-4 w-4 text-error" title="Disabled" />;
  }

  // Check if has valid API key (simplified - in real app would check API key status)
  const hasValidKey = true; // Would check provider.hasValidKey

  if (hasValidKey) {
    return <Check className="h-4 w-4 text-success" title="Valid API key" />;
  }

  return <AlertTriangle className="h-4 w-4 text-warning" title="No valid API key" />;
}
