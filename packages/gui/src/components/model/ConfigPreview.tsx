/**
 * Config Preview Component
 * Shows a preview of configuration in JSON format with syntax highlighting
 */

import { useMemo } from 'react';
import { cn } from '../../utils/cn';

interface ConfigPreviewProps {
  config: Record<string, unknown>;
  title?: string;
  className?: string;
  maxHeight?: string;
}

interface SyntaxHighlightProps {
  json: string;
}

function SyntaxHighlight({ json }: SyntaxHighlightProps) {
  const highlighted = useMemo(() => {
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      match => {
        let cls: string;
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-primary';
          } else {
            cls = 'text-success';
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-warning';
        } else if (/null/.test(match)) {
          cls = 'text-text-tertiary';
        } else {
          cls = 'text-info';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }, [json]);

  return (
    <pre
      className="text-xs leading-relaxed overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

export function ConfigPreview({
  config,
  title = 'Configuration Preview',
  className,
  maxHeight = '300px',
}: ConfigPreviewProps) {
  const jsonString = useMemo(() => {
    return JSON.stringify(config, null, 2);
  }, [config]);

  return (
    <div className={cn('rounded-lg border border-border overflow-hidden', className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-bg-tertiary border-b border-border">
        <h4 className="text-xs font-medium text-text-secondary">{title}</h4>
        <span className="text-xs text-text-tertiary">JSON</span>
      </div>
      <div className="p-3 bg-bg-primary overflow-auto font-mono" style={{ maxHeight }}>
        <SyntaxHighlight json={jsonString} />
      </div>
    </div>
  );
}

interface AffectedToolsPreviewProps {
  tools: string[];
  action: 'use' | 'override';
  className?: string;
}

export function AffectedToolsPreview({ tools, action, className }: AffectedToolsPreviewProps) {
  if (tools.length === 0) return null;

  const message =
    action === 'use'
      ? `${tools.length} tool${tools.length > 1 ? 's' : ''} will use this provider`
      : `This will override ${tools.length} tool${tools.length > 1 ? 's' : ''}`;

  return (
    <div className={cn('rounded-lg border border-border-muted p-3', className)}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium',
            action === 'use' ? 'bg-success-muted text-success' : 'bg-warning-muted text-warning'
          )}
        >
          {tools.length}
        </span>
        <span className="text-sm text-text-secondary">{message}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tools.map(tool => (
          <span
            key={tool}
            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-bg-tertiary text-text-secondary"
          >
            {tool}
          </span>
        ))}
      </div>
    </div>
  );
}

export default ConfigPreview;
