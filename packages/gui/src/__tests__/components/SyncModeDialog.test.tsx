/**
 * SyncModeDialog Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncModeDialog } from '@/components/SyncModeDialog';

describe('SyncModeDialog', () => {
  const mockOnClose = vi.fn();
  const mockOnSelectMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('When closed', () => {
    it('should not render when open is false', () => {
      render(
        <SyncModeDialog
          open={false}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={3}
        />
      );

      expect(screen.queryByText('Sync Configuration')).not.toBeInTheDocument();
    });
  });

  describe('When open', () => {
    it('should render dialog title', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={3}
        />
      );

      expect(screen.getByText('Sync Configuration')).toBeInTheDocument();
    });

    it('should render both sync mode options', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={3}
        />
      );

      expect(screen.getByText('Sync Between Tools')).toBeInTheDocument();
      expect(screen.getByText('Manage Unified Config')).toBeInTheDocument();
    });

    it('should show warning when less than 2 tools detected and direct-sync selected', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={1}
        />
      );

      fireEvent.click(screen.getByText('Sync Between Tools'));

      expect(screen.getByText(/At least 2 detected tools are required/)).toBeInTheDocument();
    });

    it('should not show warning when less than 2 tools but no mode selected', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={1}
        />
      );

      expect(screen.queryByText(/At least 2 detected tools are required/)).not.toBeInTheDocument();
    });

    it('should show "Config exists" badge when unified config exists', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={true}
          detectedToolsCount={3}
        />
      );

      expect(screen.getByText('Config exists')).toBeInTheDocument();
    });
  });

  describe('Mode Selection', () => {
    it('should select direct-sync mode when clicked', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={3}
        />
      );

      fireEvent.click(screen.getByText('Sync Between Tools'));
      expect(screen.getAllByText('Selected')).toHaveLength(1);
    });

    it('should select unified-config mode when clicked', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={3}
        />
      );

      fireEvent.click(screen.getByText('Manage Unified Config'));
      expect(screen.getAllByText('Selected')).toHaveLength(1);
    });

    it('should allow switching between modes', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={3}
        />
      );

      fireEvent.click(screen.getByText('Sync Between Tools'));
      fireEvent.click(screen.getByText('Manage Unified Config'));

      // Only one should be selected at a time
      expect(screen.getAllByText('Selected')).toHaveLength(1);
    });
  });

  describe('Actions', () => {
    it('should call onClose when Cancel is clicked', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={3}
        />
      );

      fireEvent.click(screen.getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onSelectMode with selected mode when Continue is clicked', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={3}
        />
      );

      // Select a mode first
      fireEvent.click(screen.getByText('Sync Between Tools'));
      fireEvent.click(screen.getByText('Continue'));

      expect(mockOnSelectMode).toHaveBeenCalledWith('direct-sync');
    });

    it('should disable Continue when no mode selected', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={3}
        />
      );

      expect(screen.getByText('Continue').closest('button')).toBeDisabled();
    });

    it('should disable Continue when less than 2 tools', () => {
      render(
        <SyncModeDialog
          open={true}
          onClose={mockOnClose}
          onSelectMode={mockOnSelectMode}
          hasUnifiedConfig={false}
          detectedToolsCount={1}
        />
      );

      fireEvent.click(screen.getByText('Sync Between Tools'));
      expect(screen.getByText('Continue').closest('button')).toBeDisabled();
    });
  });
});
