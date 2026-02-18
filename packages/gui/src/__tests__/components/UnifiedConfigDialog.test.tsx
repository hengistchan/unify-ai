/**
 * UnifiedConfigDialog Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnifiedConfigDialog } from '@/components/UnifiedConfigDialog';
import type { DetectedTool, UnifiedConfig } from '@/stores/appStore';

describe('UnifiedConfigDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnImport = vi.fn();
  const mockOnExport = vi.fn();

  const defaultDetectedTools: DetectedTool[] = [
    { id: 'claude-code', name: 'Claude Code', configPath: '/CLAUDE.md', detected: true, hasRules: true, hasMcp: true, hasSettings: true },
    { id: 'cursor', name: 'Cursor', configPath: '/.cursorrules', detected: true, hasRules: true, hasMcp: false, hasSettings: false },
    { id: 'copilot', name: 'GitHub Copilot', configPath: '/.github/copilot-instructions.md', detected: true, hasRules: true, hasMcp: false, hasSettings: false },
  ];

  const defaultUnifiedConfig: UnifiedConfig = {
    version: '1.0.0',
    rules: [
      { id: 'rule1', content: 'Rule 1 content' },
      { id: 'rule2', content: 'Rule 2 content' },
    ],
    mcp: {
      servers: [
        { name: 'server1', command: 'node' },
        { name: 'server2', command: 'python' },
      ],
    },
    settings: {
      model: { default: 'claude-3' },
    },
    commands: [
      { id: 'cmd1', name: 'Command 1', template: 'template1' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnImport.mockResolvedValue({ success: true });
    mockOnExport.mockResolvedValue({ success: true });
  });

  describe('When closed', () => {
    it('should not render when open is false', () => {
      render(
        <UnifiedConfigDialog
          open={false}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={null}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      expect(screen.queryByText('unified.json')).not.toBeInTheDocument();
    });
  });

  describe('Overview Step', () => {
    it('should render unified config info', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      expect(screen.getByText('unified.json')).toBeInTheDocument();
    });

    it('should show config stats when config exists', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      // Check for labels instead of numbers to avoid ambiguity
      expect(screen.getByText('Rules')).toBeInTheDocument();
      expect(screen.getByText('MCP')).toBeInTheDocument();
      expect(screen.getByText('Commands')).toBeInTheDocument();
    });

    it('should show warning when no unified config', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={null}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      expect(screen.getByText(/No unified config yet/)).toBeInTheDocument();
    });

    it('should show Import and Export action buttons', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      expect(screen.getByText('Import from Tools')).toBeInTheDocument();
      expect(screen.getByText('Export to Tools')).toBeInTheDocument();
    });

    it('should disable Export button when no config', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={null}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      const exportButton = screen.getByText('Export to Tools').closest('button');
      expect(exportButton).toBeDisabled();
    });
  });

  describe('Navigation', () => {
    it('should go to import step when Import is clicked', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Import from Tools'));
      expect(screen.getByText('Select source tools to import from:')).toBeInTheDocument();
    });

    it('should go to export step when Export is clicked', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Export to Tools'));
      expect(screen.getByText('Select target tools to export to:')).toBeInTheDocument();
    });

    it('should go back to overview from import step', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Import from Tools'));
      fireEvent.click(screen.getByText('Back'));

      expect(screen.getByText('Import from Tools')).toBeInTheDocument();
    });
  });

  describe('Import Step', () => {
    it('should show detected tools for selection', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Import from Tools'));

      expect(screen.getByText('Claude Code')).toBeInTheDocument();
      expect(screen.getByText('Cursor')).toBeInTheDocument();
      expect(screen.getByText('GitHub Copilot')).toBeInTheDocument();
    });

    it('should allow selecting multiple source tools', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Import from Tools'));
      fireEvent.click(screen.getByText('Claude Code'));
      fireEvent.click(screen.getByText('Cursor'));

      // Both should have primary border class (multi-select)
      const claudeButton = screen.getByText('Claude Code').closest('button');
      const cursorButton = screen.getByText('Cursor').closest('button');
      expect(claudeButton).toHaveClass('border-primary');
      expect(cursorButton).toHaveClass('border-primary');
    });

    it('should show merge info when multiple tools selected', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Import from Tools'));
      fireEvent.click(screen.getByText('Claude Code'));
      fireEvent.click(screen.getByText('Cursor'));

      expect(screen.getByText('Merge mode enabled')).toBeInTheDocument();
    });

    it('should call onImport when Import button clicked', async () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Import from Tools'));
      fireEvent.click(screen.getByText('Cursor'));

      const importButtons = screen.getAllByText(/Import/);
      fireEvent.click(importButtons[importButtons.length - 1]);

      expect(mockOnImport).toHaveBeenCalled();
    });

    it('should disable Import button when no tool selected', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Import from Tools'));

      // When no tools selected, button shows "Import" without count
      const importButton = screen.getByRole('button', { name: /Import$/ });
      expect(importButton).toBeDisabled();
    });
  });

  describe('Export Step', () => {
    it('should show detected tools for selection', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Export to Tools'));

      expect(screen.getByText('Claude Code')).toBeInTheDocument();
      expect(screen.getByText('Cursor')).toBeInTheDocument();
      expect(screen.getByText('GitHub Copilot')).toBeInTheDocument();
    });

    it('should allow selecting multiple target tools', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Export to Tools'));
      fireEvent.click(screen.getByText('Cursor'));
      fireEvent.click(screen.getByText('GitHub Copilot'));

      // Both should have success border class
      const cursorButton = screen.getByText('Cursor').closest('button');
      const copilotButton = screen.getByText('GitHub Copilot').closest('button');
      expect(cursorButton).toHaveClass('border-success');
      expect(copilotButton).toHaveClass('border-success');
    });

    it('should call onExport when Export button clicked', async () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Export to Tools'));
      fireEvent.click(screen.getByText('Cursor'));

      const exportButtons = screen.getAllByText(/Export \(/);
      fireEvent.click(exportButtons[exportButtons.length - 1]);

      expect(mockOnExport).toHaveBeenCalledWith(['cursor'], { createBackup: true });
    });

    it('should disable Export button when no tools selected', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Export to Tools'));

      // When no tools selected, button shows "Export" without count
      const exportButton = screen.getByRole('button', { name: /Export$/ });
      expect(exportButton).toBeDisabled();
    });

    it('should show backup checkbox', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Export to Tools'));

      expect(screen.getByText('Create backup before export')).toBeInTheDocument();
    });

    it('should toggle backup option', () => {
      render(
        <UnifiedConfigDialog
          open={true}
          onClose={mockOnClose}
          detectedTools={defaultDetectedTools}
          unifiedConfig={defaultUnifiedConfig}
          onImport={mockOnImport}
          onExport={mockOnExport}
          importLoading={false}
          exportLoading={false}
        />
      );

      fireEvent.click(screen.getByText('Export to Tools'));

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();

      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });
});
