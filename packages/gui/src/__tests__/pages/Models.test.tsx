/**
 * Models Page Critical Tests
 * Focus on the core interactions that must work correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Models } from '@/pages/Models';
import { mockModelAPI } from '../setup';

const mockProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    enabled: true,
    priority: 100,
    models: [],
    toolId: 'global',
    isGlobal: true,
    isCurrentGlobal: true,
    isCurrentTool: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    enabled: true,
    priority: 90,
    models: [],
    toolId: 'global',
    isGlobal: true,
    isCurrentGlobal: false,
    isCurrentTool: false,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude Code)',
    type: 'anthropic',
    enabled: true,
    priority: 100,
    models: [],
    toolId: 'claude-code',
    isGlobal: false,
    isCurrentGlobal: false,
    isCurrentTool: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

describe('Models Page - Critical Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModelAPI.getProviders.mockResolvedValue(mockProviders);
    mockModelAPI.getActiveProvider.mockResolvedValue(mockProviders[0]);
    mockModelAPI.getUsageSummary.mockResolvedValue({
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      byProvider: [],
      byModel: [],
      byDate: [],
    });
  });

  describe('Use Global Button', () => {
    it('should call clearToolOverride when clicked', async () => {
      await act(async () => {
        render(<Models />);
      });

      await waitFor(() => {
        expect(screen.getByText('Providers')).toBeInTheDocument();
      });

      const claudeCodeTab = screen.getByRole('button', { name: /claude code/i });
      fireEvent.click(claudeCodeTab);

      await waitFor(() => {
        const useGlobalButton = screen.getByRole('button', { name: /use global/i });
        expect(useGlobalButton).toBeInTheDocument();
      });

      const useGlobalButton = screen.getByRole('button', { name: /use global/i });
      await act(async () => {
        fireEvent.click(useGlobalButton);
      });

      await waitFor(() => {
        expect(mockModelAPI.clearToolOverride).toHaveBeenCalledWith('claude-code');
      });
    });

    it('should NOT call setProviderEnabled when clicking Use Global', async () => {
      await act(async () => {
        render(<Models />);
      });

      await waitFor(() => {
        expect(screen.getByText('Providers')).toBeInTheDocument();
      });

      const claudeCodeTab = screen.getByRole('button', { name: /claude code/i });
      fireEvent.click(claudeCodeTab);

      await waitFor(() => {
        const useGlobalButton = screen.getByRole('button', { name: /use global/i });
        expect(useGlobalButton).toBeInTheDocument();
      });

      const useGlobalButton = screen.getByRole('button', { name: /use global/i });
      await act(async () => {
        fireEvent.click(useGlobalButton);
      });

      await waitFor(() => {
        expect(mockModelAPI.clearToolOverride).toHaveBeenCalled();
      });

      expect(mockModelAPI.setProviderEnabled).not.toHaveBeenCalled();
    });

    it('should NOT call deleteProvider when clicking Use Global', async () => {
      await act(async () => {
        render(<Models />);
      });

      await waitFor(() => {
        expect(screen.getByText('Providers')).toBeInTheDocument();
      });

      const claudeCodeTab = screen.getByRole('button', { name: /claude code/i });
      fireEvent.click(claudeCodeTab);

      await waitFor(() => {
        const useGlobalButton = screen.getByRole('button', { name: /use global/i });
        expect(useGlobalButton).toBeInTheDocument();
      });

      const useGlobalButton = screen.getByRole('button', { name: /use global/i });
      await act(async () => {
        fireEvent.click(useGlobalButton);
      });

      await waitFor(() => {
        expect(mockModelAPI.clearToolOverride).toHaveBeenCalled();
      });

      expect(mockModelAPI.deleteProvider).not.toHaveBeenCalled();
    });
  });

  describe('Provider Selection in Tool Tab', () => {
    it('should NOT call setToolOverrideProvider when clicking provider', async () => {
      await act(async () => {
        render(<Models />);
      });

      await waitFor(() => {
        expect(screen.getByText('Providers')).toBeInTheDocument();
      });

      const claudeCodeTab = screen.getByRole('button', { name: /claude code/i });
      fireEvent.click(claudeCodeTab);

      await waitFor(() => {
        expect(mockModelAPI.getProviders).toHaveBeenCalled();
      });

      vi.clearAllMocks();

      const allButtons = screen.getAllByRole('button');
      const providerButton = allButtons.find(
        btn =>
          btn.textContent?.includes('Anthropic (Claude Code)') &&
          btn.className.includes('rounded border')
      );

      if (providerButton) {
        await act(async () => {
          fireEvent.click(providerButton);
        });
      }

      expect(mockModelAPI.setToolOverrideProvider).not.toHaveBeenCalled();
    });
  });

  describe('Provider Selection in Global Tab', () => {
    it('should select provider without making API calls', async () => {
      await act(async () => {
        render(<Models />);
      });

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });

      vi.clearAllMocks();

      const openaiButton = screen.getByRole('button', { name: /openai/i });
      await act(async () => {
        fireEvent.click(openaiButton);
      });

      await waitFor(() => {
        expect(openaiButton.className).toContain('border-primary');
      });

      expect(mockModelAPI.setToolOverrideProvider).not.toHaveBeenCalled();
      expect(mockModelAPI.setProviderEnabled).not.toHaveBeenCalled();
    });
  });
});
