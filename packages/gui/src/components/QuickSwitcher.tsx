/**
 * Quick Switcher Component
 * A command palette style dialog for quickly switching between AI providers
 * Triggered by global shortcut Cmd+Shift+M (Mac) or Ctrl+Shift+M (Win/Linux)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModelStore } from '@/stores/modelStore';
import type { AIProvider } from '@unify-ai/core/model';

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickSwitcher({ isOpen, onClose }: QuickSwitcherProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const providers = useModelStore(state => state.providers);
  const activeProvider = useModelStore(state => state.activeProvider);
  const setProviderEnabled = useModelStore(state => state.setProviderEnabled);
  const loadActiveProvider = useModelStore(state => state.loadActiveProvider);

  // Filter enabled providers with fuzzy search
  const filteredProviders = useMemo(() => {
    const enabledProviders = providers.filter(p => p.enabled);
    if (!search.trim()) {
      return enabledProviders;
    }

    const searchLower = search.toLowerCase();
    return enabledProviders.filter(provider => {
      const nameMatch = provider.name.toLowerCase().includes(searchLower);
      const idMatch = provider.id.toLowerCase().includes(searchLower);
      const modelMatch = provider.defaultModel?.toLowerCase().includes(searchLower);
      return nameMatch || idMatch || modelMatch;
    });
  }, [providers, search]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      // Focus input after a short delay to ensure the modal is visible
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredProviders.length) {
      setSelectedIndex(Math.max(0, filteredProviders.length - 1));
    }
  }, [filteredProviders.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredProviders.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredProviders[selectedIndex]) {
            handleSelectProvider(filteredProviders[selectedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
      }
    },
    [filteredProviders, selectedIndex, onClose]
  );

  // Handle provider selection
  const handleSelectProvider = async (provider: AIProvider) => {
    try {
      // Set this provider as the active one by setting priority to highest
      await setProviderEnabled(provider.id, true);

      // Reload active provider to reflect change
      await loadActiveProvider();

      onClose();
    } catch (error) {
      console.error('[QuickSwitcher] Failed to select provider:', error);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Switcher"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={cn(
          'relative w-full max-w-lg mx-4',
          'bg-bg-secondary',
          'border border-border',
          'rounded-lg',
          'shadow-2xl',
          'overflow-hidden',
          'animate-fade-in'
        )}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-text-tertiary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search providers..."
            className={cn(
              'flex-1 bg-transparent',
              'text-text-primary',
              'placeholder:text-text-tertiary',
              'outline-none',
              'text-base'
            )}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs text-text-tertiary bg-bg-tertiary border border-border rounded">
            esc
          </kbd>
        </div>

        {/* Provider List */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto py-2"
          role="listbox"
          aria-label="Providers"
        >
          {filteredProviders.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-text-tertiary" />
              <p className="text-text-secondary">No providers found</p>
              {search && (
                <p className="text-sm text-text-tertiary mt-1">
                  Try a different search term
                </p>
              )}
            </div>
          ) : (
            filteredProviders.map((provider, index) => (
              <ProviderItem
                key={provider.id}
                provider={provider}
                isActive={activeProvider?.id === provider.id}
                isSelected={index === selectedIndex}
                onSelect={() => handleSelectProvider(provider)}
                onMouseEnter={() => setSelectedIndex(index)}
                index={index}
              />
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border bg-bg-tertiary flex items-center justify-between text-xs text-text-tertiary">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border rounded">↓</kbd>
              <span className="ml-1">to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-bg-secondary border border-border rounded">↵</kbd>
              <span className="ml-1">to select</span>
            </span>
          </div>
          <span>{filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}

interface ProviderItemProps {
  provider: AIProvider;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  index: number;
}

function ProviderItem({
  provider,
  isActive,
  isSelected,
  onSelect,
  onMouseEnter,
  index,
}: ProviderItemProps) {
  return (
    <button
      data-index={index}
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      className={cn(
        'w-full px-4 py-3 flex items-center gap-3',
        'text-left transition-colors duration-fast',
        isSelected ? 'bg-primary-muted' : 'hover:bg-bg-hover',
        isActive && 'bg-success/5'
      )}
    >
      {/* Active indicator */}
      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
        {isActive && <Check className="w-4 h-4 text-success" />}
      </div>

      {/* Provider info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary truncate">
            {provider.name}
          </span>
          <span className="text-xs text-text-tertiary truncate">
            {provider.id}
          </span>
        </div>
        <div className="text-sm text-text-secondary truncate mt-0.5">
          {provider.defaultModel || 'No default model'}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {provider.enabled && (
          <span className="w-2 h-2 rounded-full bg-success" title="Enabled" />
        )}
      </div>
    </button>
  );
}

export default QuickSwitcher;
