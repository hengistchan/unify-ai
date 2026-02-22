/**
 * Conflict Warning Component
 * Displays warnings when global and tool providers conflict
 */

import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../utils/cn';
import { ToolIcon, getToolName } from '../common/ToolIcon';

export interface ToolProviderStatus {
  toolId: string;
  globalProvider?: string;
  toolProvider?: string;
  effectiveProvider: string;
  hasOverride: boolean;
  willBeOverridden?: boolean;
}

interface ConflictWarningProps {
  conflicts: ToolProviderStatus[];
  newProviderId?: string;
  className?: string;
}

export function ConflictWarning({ conflicts, newProviderId, className }: ConflictWarningProps) {
  if (conflicts.length === 0) return null;

  const hasActualConflicts = conflicts.some(c => c.hasOverride || c.willBeOverridden);

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        hasActualConflicts ? 'border-warning bg-warning-muted/10' : 'border-info bg-info-muted/10',
        className
      )}
    >
      <div className="flex items-start gap-2">
        {hasActualConflicts ? (
          <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
        ) : (
          <Info className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <h4
            className={cn('text-sm font-medium', hasActualConflicts ? 'text-warning' : 'text-info')}
          >
            {hasActualConflicts ? 'Provider Conflicts Detected' : 'Provider Assignment'}
          </h4>
          <p className="mt-1 text-xs text-text-secondary">
            {hasActualConflicts
              ? 'Some tools have overrides that will take precedence over global settings.'
              : 'Review which provider each tool will use.'}
          </p>

          <div className="mt-3 space-y-2">
            {conflicts.map(conflict => (
              <ConflictItem
                key={conflict.toolId}
                conflict={conflict}
                newProviderId={newProviderId}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConflictItemProps {
  conflict: ToolProviderStatus;
  newProviderId?: string;
}

function ConflictItem({ conflict, newProviderId }: ConflictItemProps) {
  const isOverridden = conflict.hasOverride && conflict.globalProvider !== conflict.toolProvider;
  const willBeOverridden = conflict.willBeOverridden;

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-bg-secondary border border-border-muted">
      <ToolIcon toolId={conflict.toolId} size="sm" />
      <span className="text-sm font-medium flex-shrink-0">{getToolName(conflict.toolId)}</span>

      <div className="flex-1 flex items-center justify-end gap-2 text-xs">
        {isOverridden ? (
          <>
            <span className="text-text-tertiary line-through">
              {conflict.globalProvider || 'none'}
            </span>
            <span className="text-text-secondary">→</span>
            <span className="text-warning font-medium">{conflict.toolProvider}</span>
            <span className="px-1.5 py-0.5 rounded bg-warning-muted text-warning text-[10px]">
              override
            </span>
          </>
        ) : willBeOverridden ? (
          <>
            <span className="text-text-tertiary line-through">
              {conflict.toolProvider || 'none'}
            </span>
            <span className="text-text-secondary">→</span>
            <span className="text-success font-medium">{newProviderId}</span>
            <span className="px-1.5 py-0.5 rounded bg-success-muted text-success text-[10px]">
              new
            </span>
          </>
        ) : (
          <span className="text-success font-medium">{conflict.effectiveProvider}</span>
        )}
      </div>
    </div>
  );
}

interface GlobalConflictWarningProps {
  globalProvider: string;
  toolOverrides: Array<{ toolId: string; providerId: string }>;
  className?: string;
}

export function GlobalConflictWarning({
  globalProvider,
  toolOverrides,
  className,
}: GlobalConflictWarningProps) {
  if (toolOverrides.length === 0) return null;

  return (
    <div className={cn('rounded-lg border border-warning bg-warning-muted/10 p-3', className)}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-warning">Tool-Specific Overrides Active</h4>
          <p className="mt-1 text-xs text-text-secondary">
            Global provider is <span className="font-medium">{globalProvider}</span>, but{' '}
            {toolOverrides.length} tool{toolOverrides.length > 1 ? 's' : ''} have custom providers.
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {toolOverrides.map(override => (
              <span
                key={override.toolId}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-bg-secondary border border-border-muted"
              >
                <ToolIcon toolId={override.toolId} size="sm" />
                <span>{getToolName(override.toolId)}</span>
                <span className="text-text-tertiary">→</span>
                <span className="text-warning font-medium">{override.providerId}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConflictWarning;
