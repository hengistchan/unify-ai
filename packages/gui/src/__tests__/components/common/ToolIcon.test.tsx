/**
 * ToolIcon Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolIcon, getToolName } from '@/components/common/ToolIcon';

describe('ToolIcon', () => {
  describe('Bootstrap Icons', () => {
    it('should render Bootstrap icon for claude-code', () => {
      render(<ToolIcon toolId="claude-code" />);
      const icon = document.querySelector('.bi-claude');
      expect(icon).toBeInTheDocument();
    });

    it('should render Bootstrap icon for copilot', () => {
      render(<ToolIcon toolId="copilot" />);
      const icon = document.querySelector('.bi-github');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Emoji Fallbacks', () => {
    it('should render emoji for cursor', () => {
      render(<ToolIcon toolId="cursor" />);
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('should render emoji for windsurf', () => {
      render(<ToolIcon toolId="windsurf" />);
      expect(screen.getByText('🌊')).toBeInTheDocument();
    });

    it('should render emoji for codex', () => {
      render(<ToolIcon toolId="codex" />);
      expect(screen.getByText('📝')).toBeInTheDocument();
    });

    it('should render emoji for cline', () => {
      render(<ToolIcon toolId="cline" />);
      expect(screen.getByText('📋')).toBeInTheDocument();
    });

    it('should render emoji for aider', () => {
      render(<ToolIcon toolId="aider" />);
      expect(screen.getByText('🤝')).toBeInTheDocument();
    });

    it('should render emoji for continue', () => {
      render(<ToolIcon toolId="continue" />);
      expect(screen.getByText('▶️')).toBeInTheDocument();
    });
  });

  describe('Unknown Tool', () => {
    it('should render default emoji for unknown tool', () => {
      render(<ToolIcon toolId="unknown-tool" />);
      expect(screen.getByText('🔧')).toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('should apply sm size class', () => {
      render(<ToolIcon toolId="cursor" size="sm" />);
      expect(screen.getByText('⚡').className).toContain('text-lg');
    });

    it('should apply md size class by default', () => {
      render(<ToolIcon toolId="cursor" />);
      expect(screen.getByText('⚡').className).toContain('text-2xl');
    });

    it('should apply lg size class', () => {
      render(<ToolIcon toolId="cursor" size="lg" />);
      expect(screen.getByText('⚡').className).toContain('text-4xl');
    });
  });

  describe('Custom ClassName', () => {
    it('should apply custom className', () => {
      render(<ToolIcon toolId="cursor" className="custom-class" />);
      expect(screen.getByText('⚡').className).toContain('custom-class');
    });
  });
});

describe('getToolName', () => {
  it('should return display name for claude-code', () => {
    expect(getToolName('claude-code')).toBe('Claude Code');
  });

  it('should return display name for cursor', () => {
    expect(getToolName('cursor')).toBe('Cursor');
  });

  it('should return display name for copilot', () => {
    expect(getToolName('copilot')).toBe('GitHub Copilot');
  });

  it('should return display name for windsurf', () => {
    expect(getToolName('windsurf')).toBe('Windsurf');
  });

  it('should return display name for codex', () => {
    expect(getToolName('codex')).toBe('Codex');
  });

  it('should return display name for cline', () => {
    expect(getToolName('cline')).toBe('Cline');
  });

  it('should return display name for aider', () => {
    expect(getToolName('aider')).toBe('Aider');
  });

  it('should return display name for continue', () => {
    expect(getToolName('continue')).toBe('Continue');
  });

  it('should return the input for unknown tool', () => {
    expect(getToolName('unknown')).toBe('unknown');
  });
});
