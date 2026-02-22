/**
 * Tool Icon Component
 * Renders icons for AI tools using Bootstrap Icons or emojis as fallback
 */

export interface ToolIconProps {
  toolId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-4xl',
};

/**
 * Get icon element for a tool
 * Bootstrap Icons available: anthropic, claude, openai, github
 * Fallback to emojis for other tools
 */
export function ToolIcon({ toolId, size = 'md', className = '' }: ToolIconProps) {
  const sizeClass = sizeMap[size];

  // Tools with Bootstrap Icons
  const bootstrapIconMap: Record<string, string> = {
    'claude-code': 'bi-claude',
    copilot: 'bi-github', // Copilot is GitHub's product
  };

  // Tools with emoji fallbacks
  const emojiMap: Record<string, string> = {
    'claude-code': '⚡',
    opencode: '🔵',
    codex: '📝',
    cline: '📋',
  };

  const bootstrapIcon = bootstrapIconMap[toolId];
  const emoji = emojiMap[toolId];

  if (bootstrapIcon) {
    return <i className={`bi ${bootstrapIcon} ${sizeClass} ${className}`} aria-hidden="true" />;
  }

  if (emoji) {
    return (
      <span className={`${sizeClass} ${className}`} aria-hidden="true">
        {emoji}
      </span>
    );
  }

  // Default fallback
  return (
    <span className={`${sizeClass} ${className}`} aria-hidden="true">
      🔧
    </span>
  );
}

/**
 * Get tool display name
 */
export function getToolName(toolId: string): string {
  const names: Record<string, string> = {
    'claude-code': 'Claude Code',
    opencode: 'OpenCode',
    codex: 'Codex',
    cline: 'Cline',
  };
  return names[toolId] || toolId;
}

export default ToolIcon;
