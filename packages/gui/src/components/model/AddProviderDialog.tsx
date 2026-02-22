/**
 * Add Provider Dialog
 * Modal for adding a new AI provider with real-time configuration preview
 */

import { useState, useMemo } from 'react';
import { useModelStore } from '../../stores/modelStore';
import { Modal, Button, Card } from '../common';
import { ToolIcon, getToolName } from '../common/ToolIcon';
import { ConfigPreview, AffectedToolsPreview } from './ConfigPreview';
import { ConflictWarning, type ToolProviderStatus } from './ConflictWarning';
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

const ALL_TOOLS = ['claude-code', 'opencode', 'codex', 'cline'] as const;

type ToolId = (typeof ALL_TOOLS)[number];

export function AddProviderDialog({ open, onClose }: AddProviderDialogProps) {
  const { createProvider, providers } = useModelStore();
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [applyToGlobal, setApplyToGlobal] = useState(true);
  const [selectedTools, setSelectedTools] = useState<Set<ToolId>>(new Set());

  const previewConfig = useMemo(() => {
    if (!selectedType) return null;

    const baseConfig: Record<string, unknown> = {
      id: applyToGlobal ? selectedType : `${selectedType}-{toolId}`,
      name: name.trim() || 'Provider Name',
      type: PROVIDER_TEMPLATES.find(t => t.id === selectedType)?.type || 'openai-compatible',
      enabled: true,
      scope: applyToGlobal ? 'global' : 'tool-specific',
    };

    if (baseUrl.trim()) {
      baseConfig.baseUrl = baseUrl.trim();
    }

    if (applyToGlobal) {
      baseConfig.tools = ALL_TOOLS;
    } else {
      baseConfig.tools = Array.from(selectedTools);
    }

    if (apiKey.trim()) {
      baseConfig.hasApiKey = true;
    }

    return baseConfig;
  }, [selectedType, name, baseUrl, applyToGlobal, selectedTools, apiKey]);

  const toolConflicts = useMemo((): ToolProviderStatus[] => {
    if (!selectedType) return [];

    const globalProviders = providers.filter(
      p => !p.toolId || p.toolId === 'global' || p.toolId === null
    );

    const toolSpecificProviders = providers.filter(
      p => p.toolId && p.toolId !== 'global' && p.toolId !== null
    );

    const targetTools = applyToGlobal ? ALL_TOOLS : Array.from(selectedTools);

    return targetTools.map(toolId => {
      const toolOverride = toolSpecificProviders.find(p => p.toolId === toolId);
      const globalProvider = globalProviders[0];

      let effectiveProvider = selectedType;
      let hasOverride = false;
      let willBeOverridden = false;

      if (applyToGlobal && toolOverride) {
        effectiveProvider = toolOverride.id;
        hasOverride = true;
      } else if (!applyToGlobal && toolOverride) {
        willBeOverridden = true;
      }

      return {
        toolId,
        globalProvider: globalProvider?.id,
        toolProvider: toolOverride?.id,
        effectiveProvider,
        hasOverride,
        willBeOverridden,
      };
    });
  }, [selectedType, applyToGlobal, selectedTools, providers]);

  const affectedTools = useMemo(() => {
    if (applyToGlobal) {
      const toolsWithOverrides = toolConflicts.filter(c => c.hasOverride);
      return ALL_TOOLS.filter(t => !toolsWithOverrides.some(c => c.toolId === t));
    }
    return Array.from(selectedTools);
  }, [applyToGlobal, selectedTools, toolConflicts]);

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    const template = PROVIDER_TEMPLATES.find(t => t.id === type);
    if (template) {
      setName(template.name);
    }
    setStep('configure');
  };

  const toggleTool = (toolId: ToolId) => {
    const newSelected = new Set(selectedTools);
    if (newSelected.has(toolId)) {
      newSelected.delete(toolId);
    } else {
      newSelected.add(toolId);
    }
    setSelectedTools(newSelected);
  };

  const selectAllTools = () => {
    setSelectedTools(new Set(ALL_TOOLS));
  };

  const deselectAllTools = () => {
    setSelectedTools(new Set());
  };

  const handleCreate = async () => {
    if (!selectedType || !name.trim()) return;

    setLoading(true);
    try {
      const template = PROVIDER_TEMPLATES.find(t => t.id === selectedType);
      if (!template) throw new Error('Invalid provider type');

      if (applyToGlobal) {
        const input: CreateProviderInput = {
          id: selectedType,
          name: name.trim(),
          type: template.type,
          toolId: 'global',
          baseUrl: baseUrl.trim() || undefined,
        };
        await createProvider(input);
      } else {
        for (const toolId of selectedTools) {
          const input: CreateProviderInput = {
            id: `${selectedType}-${toolId}`,
            name: `${name.trim()} (${getToolName(toolId)})`,
            type: template.type,
            toolId: toolId,
            baseUrl: baseUrl.trim() || undefined,
          };
          await createProvider(input);
        }
      }

      if (apiKey.trim()) {
        const { setAPIKey } = useModelStore.getState();
        if (applyToGlobal) {
          await setAPIKey({
            providerId: selectedType,
            key: apiKey.trim(),
          });
        } else {
          for (const toolId of selectedTools) {
            await setAPIKey({
              providerId: `${selectedType}-${toolId}`,
              key: apiKey.trim(),
            });
          }
        }
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
    setBaseUrl('');
    setApplyToGlobal(true);
    setSelectedTools(new Set());
    onClose();
  };

  const isValid = applyToGlobal || selectedTools.size > 0;

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title={step === 'select' ? 'Add Provider' : 'Configure Provider'}
      size="3xl"
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
        <div className="grid grid-cols-[1fr,380px] gap-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-sm"
                placeholder="Provider name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">API Key (Optional)</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-sm font-mono"
                placeholder="sk-..."
              />
              <p className="mt-1 text-xs text-text-secondary">
                You can add the API key later if needed
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium">Base URL (Optional)</label>
              <input
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-sm font-mono"
                placeholder="https://api.openai.com/v1"
              />
              <p className="mt-1 text-xs text-text-secondary">
                Leave empty to use the provider's default endpoint
              </p>
            </div>

            <Card className="overflow-visible">
              <Card.Header
                title="Apply to"
                subtitle="Choose where this provider should be available"
              />
              <Card.Body className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToGlobal}
                    onChange={e => {
                      setApplyToGlobal(e.target.checked);
                      if (e.target.checked) {
                        setSelectedTools(new Set());
                      }
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">Global Default (all tools)</span>
                    <p className="text-xs text-text-secondary mt-0.5">
                      This provider will be used as the default for all AI tools
                    </p>
                  </div>
                </label>

                {!applyToGlobal && (
                  <div className="border-t border-border pt-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-text-secondary">
                        Tool-specific overrides
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectAllTools}
                          className="text-xs text-primary hover:underline"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={deselectAllTools}
                          className="text-xs text-text-secondary hover:underline"
                        >
                          Deselect all
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {ALL_TOOLS.map(toolId => (
                        <label
                          key={toolId}
                          className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                            selectedTools.has(toolId)
                              ? 'border-primary bg-primary-muted'
                              : 'border-border hover:border-border-hover'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTools.has(toolId)}
                            onChange={() => toggleTool(toolId)}
                            className="h-4 w-4 rounded border-border"
                          />
                          <ToolIcon toolId={toolId} size="sm" />
                          <span className="text-sm">{getToolName(toolId)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button onClick={handleCreate} loading={loading} disabled={!isValid}>
                Add Provider
              </Button>
            </div>
          </div>

          <div className="space-y-4 border-l border-border pl-4">
            <h4 className="text-sm font-medium text-text-secondary">Preview</h4>

            {previewConfig && <ConfigPreview config={previewConfig} maxHeight="180px" />}

            <AffectedToolsPreview
              tools={affectedTools.map(t => getToolName(t))}
              action={applyToGlobal ? 'use' : 'override'}
            />

            {toolConflicts.some(c => c.hasOverride || c.willBeOverridden) && (
              <ConflictWarning
                conflicts={toolConflicts}
                newProviderId={selectedType || undefined}
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
