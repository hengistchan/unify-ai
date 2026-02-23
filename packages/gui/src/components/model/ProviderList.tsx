/**
 * Provider List Component
 * Displays a list of AI providers with status indicators
 */

import type { AIProvider } from '@unify-ai/core/model';
import { useModelStore } from '../../stores/modelStore';
import { cn } from '../../utils/cn';
import { Check, AlertTriangle, X } from 'lucide-react';
import { Badge } from '../common/Badge';

interface ProviderWithHybridFields extends AIProvider {
  toolId?: string | null;
  isGlobal?: boolean;
  isCurrentGlobal?: boolean;
  isCurrentTool?: boolean;
}

interface ProviderListProps {
  providers: ProviderWithHybridFields[];
  selectedId: string | null;
  selectedToolId: string | null;
  onSelect: (id: string, toolId: string | null) => void;
  currentToolId?: string;
  globalProviderName?: string;
}

export function ProviderList({
  providers,
  selectedId,
  selectedToolId,
  onSelect,
  currentToolId: _currentToolId,
  globalProviderName,
}: ProviderListProps) {
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
        const providerToolId = provider.toolId || 'global';
        const isSelected = selectedId === provider.id && selectedToolId === providerToolId;
        const isGlobal = provider.isGlobal ?? (provider.toolId === 'global' || !provider.toolId);
        const isToolOverride = !isGlobal && provider.toolId;
        const uniqueKey = `${provider.id}:${providerToolId}`;

        return (
          <button
            key={uniqueKey}
            onClick={() => onSelect(provider.id, provider.toolId || null)}
            className={cn(
              'w-full rounded border p-3 text-left transition-colors',
              isSelected ? 'border-primary bg-primary-muted' : 'border-border hover:border-primary',
              !provider.enabled && 'opacity-50'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {isActive && <div className="h-2 w-2 rounded-full bg-success" title="Active" />}
                  <h3 className="font-medium">{provider.name}</h3>
                  {isGlobal && (
                    <Badge variant="info" size="sm">
                      Global
                    </Badge>
                  )}
                  {isToolOverride && (
                    <Badge variant="warning" size="sm">
                      Tool Override
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {provider.defaultModel || 'No default model'}
                </p>
                {!isGlobal && globalProviderName && (
                  <p className="mt-0.5 text-[10px] text-text-tertiary">
                    Using global: {globalProviderName}
                  </p>
                )}
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
    return (
      <span title="Disabled">
        <X className="h-4 w-4 text-error" />
      </span>
    );
  }

  const hasValidKey = true;

  if (hasValidKey) {
    return (
      <span title="Valid API key">
        <Check className="h-4 w-4 text-success" />
      </span>
    );
  }

  return (
    <span title="No valid API key">
      <AlertTriangle className="h-4 w-4 text-warning" />
    </span>
  );
}
