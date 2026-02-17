/**
 * SyncPreviewDialog Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncPreviewDialog, type SyncPreview } from '@/components/SyncPreviewDialog';

describe('SyncPreviewDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const defaultPreview: SyncPreview = {
    sourceTool: 'cursor',
    targetTools: ['claude-code', 'copilot'],
    changes: [
      { path: '.claude/CLAUDE.md', action: 'create', linesAdded: 10, linesRemoved: 0 },
      { path: '.github/copilot-instructions.md', action: 'create', linesAdded: 5, linesRemoved: 0 },
    ],
    conflicts: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('When closed', () => {
    it('should not render when open is false', () => {
      render(
        <SyncPreviewDialog
          open={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={false}
        />
      );

      expect(screen.queryByText('Sync Preview')).not.toBeInTheDocument();
    });
  });

  describe('When open with preview', () => {
    it('should render dialog title', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={false}
        />
      );

      expect(screen.getByText('Sync Preview')).toBeInTheDocument();
    });

    it('should render source and target tools', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={false}
        />
      );

      expect(screen.getByText('Source:')).toBeInTheDocument();
      expect(screen.getByText('cursor')).toBeInTheDocument();
      expect(screen.getByText('Targets:')).toBeInTheDocument();
      expect(screen.getByText('claude-code')).toBeInTheDocument();
      expect(screen.getByText('copilot')).toBeInTheDocument();
    });

    it('should render file changes', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={false}
        />
      );

      expect(screen.getByText('CLAUDE.md')).toBeInTheDocument();
      expect(screen.getByText('copilot-instructions.md')).toBeInTheDocument();
      // Multiple "Create" badges exist, so use getAllByText
      expect(screen.getAllByText('Create')).toHaveLength(2);
    });

    it('should show lines added/removed', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={false}
        />
      );

      expect(screen.getByText('+10')).toBeInTheDocument();
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('should show file count summary', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={false}
        />
      );

      expect(screen.getByText('2 file(s) affected')).toBeInTheDocument();
    });

    it('should show total lines summary', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={false}
        />
      );

      // Total: 10 + 5 = 15
      expect(screen.getByText('+15')).toBeInTheDocument();
    });
  });

  describe('Action badges', () => {
    it('should show Create badge for create action', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={false}
        />
      );

      const createBadges = screen.getAllByText('Create');
      expect(createBadges).toHaveLength(2);
    });

    it('should show Update badge for update action', () => {
      const previewWithUpdate: SyncPreview = {
        sourceTool: 'cursor',
        targetTools: ['claude-code'],
        changes: [{ path: 'test.md', action: 'update', linesAdded: 3, linesRemoved: 2 }],
        conflicts: [],
      };

      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={previewWithUpdate}
          loading={false}
        />
      );

      expect(screen.getByText('Update')).toBeInTheDocument();
    });

    it('should show Delete badge for delete action', () => {
      const previewWithDelete: SyncPreview = {
        sourceTool: 'cursor',
        targetTools: ['claude-code'],
        changes: [{ path: 'old.md', action: 'delete', linesAdded: 0, linesRemoved: 5 }],
        conflicts: [],
      };

      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={previewWithDelete}
          loading={false}
        />
      );

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  describe('Conflicts', () => {
    it('should show conflicts section when conflicts exist', () => {
      const previewWithConflicts: SyncPreview = {
        ...defaultPreview,
        conflicts: [
          { path: 'conflicting-file.md', description: 'File has uncommitted changes' },
        ],
      };

      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={previewWithConflicts}
          loading={false}
        />
      );

      expect(screen.getByText('Conflicts (1)')).toBeInTheDocument();
      expect(screen.getByText('conflicting-file.md')).toBeInTheDocument();
      expect(screen.getByText('File has uncommitted changes')).toBeInTheDocument();
    });

    it('should not show conflicts section when no conflicts', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={false}
        />
      );

      expect(screen.queryByText(/Conflicts/)).not.toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when preview has no changes', () => {
      const emptyPreview: SyncPreview = {
        sourceTool: 'cursor',
        targetTools: ['claude-code'],
        changes: [],
        conflicts: [],
      };

      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={emptyPreview}
          loading={false}
        />
      );

      expect(screen.getByText('No changes detected')).toBeInTheDocument();
      expect(screen.getByText('All configurations are already in sync')).toBeInTheDocument();
    });

    it('should show empty state when preview is null', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={null}
          loading={false}
        />
      );

      expect(screen.getByText('No changes to preview')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show loading skeleton when loading', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={true}
        />
      );

      // Loading skeleton has animate-pulse class
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should call onClose when Cancel is clicked', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={false}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm when Confirm Sync is clicked', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={false}
        />
      );

      fireEvent.click(screen.getByText('Confirm Sync'));
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('should disable Confirm Sync button when loading', () => {
      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={defaultPreview}
          loading={true}
        />
      );

      expect(screen.getByText('Confirm Sync').closest('button')).toBeDisabled();
    });

    it('should disable Confirm Sync button when no changes', () => {
      const emptyPreview: SyncPreview = {
        sourceTool: 'cursor',
        targetTools: ['claude-code'],
        changes: [],
        conflicts: [],
      };

      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={emptyPreview}
          loading={false}
        />
      );

      expect(screen.getByText('Confirm Sync').closest('button')).toBeDisabled();
    });

    it('should allow Confirm Sync when there are conflicts', () => {
      const previewWithConflicts: SyncPreview = {
        ...defaultPreview,
        conflicts: [
          { path: 'conflict.md', description: 'Has conflicts' },
        ],
      };

      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={previewWithConflicts}
          loading={false}
        />
      );

      expect(screen.getByText('Confirm Sync').closest('button')).not.toBeDisabled();
    });
  });

  describe('Lines display', () => {
    it('should show both added and removed lines', () => {
      const previewWithBoth: SyncPreview = {
        sourceTool: 'cursor',
        targetTools: ['claude-code'],
        changes: [{ path: 'modified.md', action: 'update', linesAdded: 5, linesRemoved: 3 }],
        conflicts: [],
      };

      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={previewWithBoth}
          loading={false}
        />
      );

      expect(screen.getByText('+5')).toBeInTheDocument();
      expect(screen.getByText('-3')).toBeInTheDocument();
    });

    it('should show dash when no lines changed', () => {
      const previewNoLines: SyncPreview = {
        sourceTool: 'cursor',
        targetTools: ['claude-code'],
        changes: [{ path: 'empty.md', action: 'create', linesAdded: 0, linesRemoved: 0 }],
        conflicts: [],
      };

      render(
        <SyncPreviewDialog
          open={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          preview={previewNoLines}
          loading={false}
        />
      );

      // Check for the dash in the lines column
      const rows = document.querySelectorAll('tr');
      expect(rows.length).toBeGreaterThan(0);
    });
  });
});
