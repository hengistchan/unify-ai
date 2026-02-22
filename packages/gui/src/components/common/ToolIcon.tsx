/**
 * Tool Icon Component
 * Renders icons for AI tools using @lobehub/icons, Bootstrap Icons, or emojis as fallback
 */

import { Cursor, Cline, Windsurf } from '@lobehub/icons';

export interface ToolIconProps {
  toolId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 20,
  md: 32,
  lg: 48,
};

const sizeClassMap = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-4xl',
};

const emojiIcons: Record<string, string> = {
  aider: '🤝',
  codex: '📝',
  opencode: '🔵',
};

const bootstrapIcons: Record<string, string> = {
  'claude-code': 'bi-claude',
  copilot: 'bi-github',
};

export function ToolIcon({ toolId, size = 'md', className = '' }: ToolIconProps) {
  const iconSize = sizeMap[size];
  const sizeClass = sizeClassMap[size];

  if (toolId === 'cursor') {
    return <Cursor size={iconSize} className={className} />;
  }

  if (toolId === 'cline') {
    return <Cline size={iconSize} className={className} />;
  }

  if (toolId === 'windsurf') {
    return <Windsurf size={iconSize} className={className} />;
  }

  const bootstrapIcon = bootstrapIcons[toolId];
  if (bootstrapIcon) {
    return <i className={`bi ${bootstrapIcon} ${sizeClass} ${className}`} aria-hidden="true" />;
  }

  const emoji = emojiIcons[toolId];
  if (emoji) {
    return (
      <span className={`${sizeClass} ${className}`} aria-hidden="true">
        {emoji}
      </span>
    );
  }

  return (
    <span className={`${sizeClass} ${className}`} aria-hidden="true">
      🔧
    </span>
  );
}

export function getToolName(toolId: string): string {
  const names: Record<string, string> = {
    'claude-code': 'Claude Code',
    cursor: 'Cursor',
    copilot: 'GitHub Copilot',
    windsurf: 'Windsurf',
    codex: 'Codex',
    cline: 'Cline',
    aider: 'Aider',
    opencode: 'OpenCode',
  };
  return names[toolId] || toolId;
}

export default ToolIcon;
