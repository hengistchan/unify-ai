/**
 * AppStore Unit Tests
 * Tests the Zustand store functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { useAppStore } from '@/stores/appStore';
import type { DetectedTool, RecentProject } from '@/stores/appStore';
import { mockElectronAPI } from '../setup';

// Helper to fully reset store state
const resetStore = () => {
  const store = useAppStore.getState();
  // Clear project and tools
  store.clearProject();
  store.setDetectedTools([]);
  store.setSyncStatus('idle');
  store.clearSyncPreview();

  // Clear toasts one by one
  const toastIds = store.toasts.map(t => t.id);
  toastIds.forEach(id => store.removeToast(id));

  // Clear recent projects one by one
  const paths = store.recentProjects.map(p => p.path);
  paths.forEach(path => store.removeRecentProject(path));

  // Reset settings to defaults
  store.updateSettings({
    autoSync: true,
    backupEnabled: true,
    animationsEnabled: true,
  });
};

describe('AppStore', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Reset store to initial state
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Project Management', () => {
    describe('setProject', () => {
      it('should set current project path', () => {
        const { setProject } = useAppStore.getState();

        act(() => {
          setProject('/path/to/project');
        });

        expect(useAppStore.getState().currentProject).toBe('/path/to/project');
      });

      it('should update project path when called multiple times', () => {
        const { setProject } = useAppStore.getState();

        act(() => {
          setProject('/path/to/project1');
        });
        expect(useAppStore.getState().currentProject).toBe('/path/to/project1');

        act(() => {
          setProject('/path/to/project2');
        });
        expect(useAppStore.getState().currentProject).toBe('/path/to/project2');
      });
    });

    describe('clearProject', () => {
      it('should clear current project and detected tools', () => {
        const { setProject, setDetectedTools, clearProject } = useAppStore.getState();

        act(() => {
          setProject('/path/to/project');
          setDetectedTools([
            {
              id: 'cursor',
              name: 'Cursor',
              configPath: '/.cursorrules',
              detected: true,
              hasRules: true,
              hasMcp: false,
              hasSettings: false,
            },
          ]);
        });

        expect(useAppStore.getState().currentProject).toBe('/path/to/project');
        expect(useAppStore.getState().detectedTools).toHaveLength(1);

        act(() => {
          clearProject();
        });

        expect(useAppStore.getState().currentProject).toBeNull();
        expect(useAppStore.getState().detectedTools).toEqual([]);
      });
    });
  });

  describe('Tool Management', () => {
    describe('setDetectedTools', () => {
      it('should set detected tools', () => {
        const tools: DetectedTool[] = [
          {
            id: 'cursor',
            name: 'Cursor',
            configPath: '/.cursorrules',
            detected: true,
            hasRules: true,
            hasMcp: false,
            hasSettings: false,
          },
          {
            id: 'claude-code',
            name: 'Claude Code',
            configPath: '/CLAUDE.md',
            detected: true,
            hasRules: true,
            hasMcp: true,
            hasSettings: true,
          },
        ];
        const { setDetectedTools } = useAppStore.getState();

        act(() => {
          setDetectedTools(tools);
        });

        expect(useAppStore.getState().detectedTools).toEqual(tools);
      });

      it('should replace existing tools', () => {
        const tools1: DetectedTool[] = [
          {
            id: 'cursor',
            name: 'Cursor',
            configPath: '/.cursorrules',
            detected: true,
            hasRules: true,
            hasMcp: false,
            hasSettings: false,
          },
        ];
        const tools2: DetectedTool[] = [
          {
            id: 'copilot',
            name: 'Copilot',
            configPath: '/.github/copilot-instructions.md',
            detected: true,
            hasRules: true,
            hasMcp: false,
            hasSettings: false,
          },
          {
            id: 'windsurf',
            name: 'Windsurf',
            configPath: '/.windsurfrules',
            detected: true,
            hasRules: true,
            hasMcp: false,
            hasSettings: false,
          },
        ];
        const { setDetectedTools } = useAppStore.getState();

        act(() => {
          setDetectedTools(tools1);
        });
        expect(useAppStore.getState().detectedTools).toHaveLength(1);

        act(() => {
          setDetectedTools(tools2);
        });
        expect(useAppStore.getState().detectedTools).toEqual(tools2);
        expect(useAppStore.getState().detectedTools).toHaveLength(2);
      });

      it('should set empty tools array', () => {
        const { setDetectedTools } = useAppStore.getState();

        act(() => {
          setDetectedTools([]);
        });

        expect(useAppStore.getState().detectedTools).toEqual([]);
      });
    });
  });

  describe('Sync Status', () => {
    describe('setSyncStatus', () => {
      it('should set sync status to syncing', () => {
        const { setSyncStatus } = useAppStore.getState();

        act(() => {
          setSyncStatus('syncing');
        });

        expect(useAppStore.getState().syncStatus).toBe('syncing');
      });

      it('should set sync status to success', () => {
        const { setSyncStatus } = useAppStore.getState();

        act(() => {
          setSyncStatus('success');
        });

        expect(useAppStore.getState().syncStatus).toBe('success');
      });

      it('should set sync status to error', () => {
        const { setSyncStatus } = useAppStore.getState();

        act(() => {
          setSyncStatus('error');
        });

        expect(useAppStore.getState().syncStatus).toBe('error');
      });
    });

    describe('setLastSyncTime', () => {
      it('should set last sync time', () => {
        const { setLastSyncTime } = useAppStore.getState();
        const time = '2024-01-15T10:30:00.000Z';

        act(() => {
          setLastSyncTime(time);
        });

        expect(useAppStore.getState().lastSyncTime).toBe(time);
      });
    });
  });

  describe('Sync Preview & Execution', () => {
    describe('previewSync', () => {
      it('should show error toast when no project is selected', async () => {
        const { previewSync } = useAppStore.getState();

        await act(async () => {
          await previewSync('cursor', ['claude-code', 'copilot']);
        });

        const toasts = useAppStore.getState().toasts;
        const errorToast = toasts.find(t => t.title === 'No Project');
        expect(errorToast).toBeDefined();
        expect(errorToast?.type).toBe('error');
      });

      it('should call electronAPI.previewSync with correct params', async () => {
        const { setProject, previewSync } = useAppStore.getState();

        // Mock importConfig first (called by previewSync)
        mockElectronAPI.importConfig.mockResolvedValueOnce({
          success: true,
          config: { version: '1.0.0' },
        });
        mockElectronAPI.previewSync.mockResolvedValueOnce([
          {
            success: true,
            toolId: 'claude-code',
            files: [{ path: '.claude/CLAUDE.md', content: 'content' }],
            warnings: [],
          },
        ]);

        act(() => {
          setProject('/test/project');
        });

        await act(async () => {
          await previewSync('cursor', ['claude-code', 'copilot']);
        });

        expect(mockElectronAPI.previewSync).toHaveBeenCalledWith('/test/project', [
          'claude-code',
          'copilot',
        ]);
      });

      it('should set syncPreview with aggregated results', async () => {
        const { setProject, previewSync } = useAppStore.getState();

        // Mock importConfig first (called by previewSync)
        mockElectronAPI.importConfig.mockResolvedValueOnce({
          success: true,
          config: { version: '1.0.0', rules: [], mcp: { servers: [] } },
        });
        mockElectronAPI.previewSync.mockResolvedValueOnce([
          {
            success: true,
            toolId: 'claude-code',
            files: [{ path: '.claude/CLAUDE.md', content: 'line1\nline2\nline3' }],
            warnings: [],
          },
          {
            success: true,
            toolId: 'copilot',
            files: [{ path: '.github/copilot-instructions.md', content: 'content' }],
            warnings: ['Warning 1'],
          },
        ]);

        act(() => {
          setProject('/test/project');
        });

        await act(async () => {
          await previewSync('cursor', ['claude-code', 'copilot']);
        });

        const state = useAppStore.getState();
        expect(state.syncPreview).not.toBeNull();
        expect(state.syncPreview?.sourceTool).toBe('cursor');
        expect(state.syncPreview?.targetTools).toEqual(['claude-code', 'copilot']);
        expect(state.syncPreview?.changes).toHaveLength(2);
        expect(state.syncPreview?.conflicts).toHaveLength(1);
        expect(state.syncLoading).toBe(false);
      });

      it('should set syncLoading to false on error', async () => {
        const { setProject, previewSync } = useAppStore.getState();

        // Mock importConfig first (called by previewSync)
        mockElectronAPI.importConfig.mockResolvedValueOnce({
          success: true,
          config: { version: '1.0.0' },
        });
        mockElectronAPI.previewSync.mockRejectedValueOnce(new Error('Network error'));

        act(() => {
          setProject('/test/project');
        });

        await act(async () => {
          await previewSync('cursor', ['claude-code']);
        });

        expect(useAppStore.getState().syncLoading).toBe(false);
      });
    });

    describe('executeSync', () => {
      it('should show warning when no preview exists', async () => {
        const { executeSync } = useAppStore.getState();

        await act(async () => {
          await executeSync();
        });

        const toasts = useAppStore.getState().toasts;
        const warningToast = toasts.find(t => t.title === 'No Preview');
        expect(warningToast).toBeDefined();
        expect(warningToast?.type).toBe('warning');
      });

      it('should call electronAPI.syncConfig with correct params', async () => {
        const { setProject, previewSync, executeSync } = useAppStore.getState();

        // Mock importConfig first (called by previewSync)
        mockElectronAPI.importConfig.mockResolvedValueOnce({
          success: true,
          config: { version: '1.0.0' },
        });
        mockElectronAPI.previewSync.mockResolvedValueOnce([
          {
            success: true,
            toolId: 'claude-code',
            files: [{ path: '.claude/CLAUDE.md', content: 'content' }],
            warnings: [],
          },
        ]);
        mockElectronAPI.syncConfig.mockResolvedValueOnce({
          success: true,
          message: 'Sync completed successfully',
        });

        act(() => {
          setProject('/test/project');
        });

        await act(async () => {
          await previewSync('cursor', ['claude-code']);
        });

        await act(async () => {
          await executeSync();
        });

        expect(mockElectronAPI.syncConfig).toHaveBeenCalledWith('/test/project', ['claude-code'], {
          createBackup: true,
          overwrite: true,
        });
      });

      it('should clear sync preview and show success toast on success', async () => {
        const { setProject, previewSync, executeSync } = useAppStore.getState();

        // Mock importConfig first (called by previewSync)
        mockElectronAPI.importConfig.mockResolvedValueOnce({
          success: true,
          config: { version: '1.0.0' },
        });
        mockElectronAPI.previewSync.mockResolvedValueOnce([
          {
            success: true,
            toolId: 'claude-code',
            files: [{ path: '.claude/CLAUDE.md', content: 'content' }],
            warnings: [],
          },
        ]);
        mockElectronAPI.syncConfig.mockResolvedValueOnce({
          success: true,
          message: 'Sync completed successfully',
        });

        act(() => {
          setProject('/test/project');
        });

        await act(async () => {
          await previewSync('cursor', ['claude-code']);
        });

        await act(async () => {
          await executeSync();
        });

        const state = useAppStore.getState();
        expect(state.syncPreview).toBeNull();
        expect(state.selectedSourceTool).toBeNull();
        expect(state.syncStatus).toBe('success');
        expect(state.lastSyncTime).not.toBeNull();

        const successToast = state.toasts.find(t => t.title === 'Sync Complete');
        expect(successToast).toBeDefined();
        expect(successToast?.type).toBe('success');
      });

      it('should show error toast on sync failure', async () => {
        const { setProject, previewSync, executeSync } = useAppStore.getState();

        // Mock importConfig first (called by previewSync)
        mockElectronAPI.importConfig.mockResolvedValueOnce({
          success: true,
          config: { version: '1.0.0' },
        });
        mockElectronAPI.previewSync.mockResolvedValueOnce([
          {
            success: true,
            toolId: 'claude-code',
            files: [{ path: '.claude/CLAUDE.md', content: 'content' }],
            warnings: [],
          },
        ]);
        mockElectronAPI.syncConfig.mockResolvedValueOnce({
          success: false,
          errors: ['Permission denied'],
        });

        act(() => {
          setProject('/test/project');
        });

        await act(async () => {
          await previewSync('cursor', ['claude-code']);
        });

        await act(async () => {
          await executeSync();
        });

        const state = useAppStore.getState();
        expect(state.syncStatus).toBe('error');

        const errorToast = state.toasts.find(t => t.title === 'Sync Failed');
        expect(errorToast).toBeDefined();
        expect(errorToast?.type).toBe('error');
      });
    });

    describe('clearSyncPreview', () => {
      it('should clear sync preview and selected source tool', () => {
        const { clearSyncPreview } = useAppStore.getState();

        act(() => {
          clearSyncPreview();
        });

        const state = useAppStore.getState();
        expect(state.syncPreview).toBeNull();
        expect(state.selectedSourceTool).toBeNull();
      });
    });
  });

  describe('Toast Notifications', () => {
    describe('addToast', () => {
      it('should add a toast with generated id', () => {
        const { addToast } = useAppStore.getState();

        act(() => {
          addToast({ type: 'success', title: 'Test Toast' });
        });

        const toasts = useAppStore.getState().toasts;
        const testToast = toasts.find(t => t.title === 'Test Toast');
        expect(testToast).toBeDefined();
        expect(testToast?.type).toBe('success');
        expect(testToast?.id).toBeDefined();
      });

      it('should add toast with message', () => {
        const { addToast } = useAppStore.getState();

        act(() => {
          addToast({ type: 'error', title: 'Error', message: 'Something went wrong' });
        });

        const toasts = useAppStore.getState().toasts;
        const errorToast = toasts.find(t => t.title === 'Error');
        expect(errorToast?.message).toBe('Something went wrong');
      });

      it('should add multiple toasts', () => {
        const { addToast } = useAppStore.getState();

        act(() => {
          addToast({ type: 'success', title: 'Toast 1' });
          addToast({ type: 'info', title: 'Toast 2' });
          addToast({ type: 'warning', title: 'Toast 3' });
        });

        const toasts = useAppStore.getState().toasts;
        expect(toasts.some(t => t.title === 'Toast 1')).toBe(true);
        expect(toasts.some(t => t.title === 'Toast 2')).toBe(true);
        expect(toasts.some(t => t.title === 'Toast 3')).toBe(true);
      });

      it('should auto-remove toast after duration', async () => {
        vi.useFakeTimers();
        const { addToast } = useAppStore.getState();

        act(() => {
          addToast({ type: 'success', title: 'Auto Remove', duration: 1000 });
        });

        let toasts = useAppStore.getState().toasts;
        expect(toasts.some(t => t.title === 'Auto Remove')).toBe(true);

        act(() => {
          vi.advanceTimersByTime(1000);
        });

        toasts = useAppStore.getState().toasts;
        expect(toasts.some(t => t.title === 'Auto Remove')).toBe(false);
        vi.useRealTimers();
      });

      it('should not auto-remove toast when duration is 0', async () => {
        vi.useFakeTimers();
        const { addToast } = useAppStore.getState();

        act(() => {
          addToast({ type: 'success', title: 'Persistent', duration: 0 });
        });

        let toasts = useAppStore.getState().toasts;
        expect(toasts.some(t => t.title === 'Persistent')).toBe(true);

        act(() => {
          vi.advanceTimersByTime(5000);
        });

        toasts = useAppStore.getState().toasts;
        expect(toasts.some(t => t.title === 'Persistent')).toBe(true);
        vi.useRealTimers();
      });
    });

    describe('removeToast', () => {
      it('should remove toast by id', () => {
        const { addToast, removeToast } = useAppStore.getState();

        act(() => {
          addToast({ type: 'success', title: 'Test' });
        });

        const toastId = useAppStore.getState().toasts.find(t => t.title === 'Test')?.id;
        expect(toastId).toBeDefined();

        act(() => {
          removeToast(toastId!);
        });

        expect(useAppStore.getState().toasts.some(t => t.title === 'Test')).toBe(false);
      });

      it('should only remove specified toast', () => {
        const { addToast, removeToast } = useAppStore.getState();

        act(() => {
          addToast({ type: 'success', title: 'Toast 1' });
          addToast({ type: 'info', title: 'Toast 2' });
        });

        const toastId = useAppStore.getState().toasts.find(t => t.title === 'Toast 1')?.id;
        expect(toastId).toBeDefined();

        act(() => {
          removeToast(toastId!);
        });

        const toasts = useAppStore.getState().toasts;
        expect(toasts.some(t => t.title === 'Toast 1')).toBe(false);
        expect(toasts.some(t => t.title === 'Toast 2')).toBe(true);
      });

      it('should handle non-existent toast id gracefully', () => {
        const { addToast, removeToast } = useAppStore.getState();

        act(() => {
          addToast({ type: 'success', title: 'Test' });
        });

        const beforeCount = useAppStore.getState().toasts.length;

        act(() => {
          removeToast('non-existent-id');
        });

        expect(useAppStore.getState().toasts.length).toBe(beforeCount);
      });
    });
  });

  describe('Recent Projects', () => {
    describe('addRecentProject', () => {
      it('should add project to recent projects', () => {
        const project: RecentProject = {
          path: '/path/to/project',
          name: 'My Project',
          lastOpened: '2024-01-15T10:00:00.000Z',
        };
        const { addRecentProject } = useAppStore.getState();

        act(() => {
          addRecentProject(project);
        });

        const recent = useAppStore.getState().recentProjects;
        expect(recent.some(p => p.path === '/path/to/project')).toBe(true);
      });

      it('should move duplicate project to front', () => {
        const project1: RecentProject = {
          path: '/path/to/project',
          name: 'My Project',
          lastOpened: '2024-01-15T10:00:00.000Z',
        };
        const project2: RecentProject = {
          path: '/path/to/other',
          name: 'Other Project',
          lastOpened: '2024-01-15T11:00:00.000Z',
        };
        const { addRecentProject } = useAppStore.getState();

        act(() => {
          addRecentProject(project1);
          addRecentProject(project2);
        });

        const updatedProject: RecentProject = {
          path: '/path/to/project',
          name: 'My Project Updated',
          lastOpened: '2024-01-15T12:00:00.000Z',
        };

        act(() => {
          addRecentProject(updatedProject);
        });

        const recent = useAppStore.getState().recentProjects;
        expect(recent[0].path).toBe('/path/to/project');
        expect(recent[0].name).toBe('My Project Updated');
        expect(recent.filter(p => p.path === '/path/to/project')).toHaveLength(1);
      });

      it('should limit recent projects to 10', () => {
        const { addRecentProject } = useAppStore.getState();

        for (let i = 0; i < 15; i++) {
          act(() => {
            addRecentProject({
              path: `/path/to/project${i}`,
              name: `Project ${i}`,
              lastOpened: `2024-01-15T${String(i).padStart(2, '0')}:00:00.000Z`,
            });
          });
        }

        const recent = useAppStore.getState().recentProjects;
        expect(recent.length).toBeLessThanOrEqual(10);
        // Most recent should be first
        expect(recent[0].path).toBe('/path/to/project14');
      });
    });

    describe('removeRecentProject', () => {
      it('should remove project by path', () => {
        const project: RecentProject = {
          path: '/path/to/project',
          name: 'My Project',
          lastOpened: '2024-01-15T10:00:00.000Z',
        };
        const { addRecentProject, removeRecentProject } = useAppStore.getState();

        act(() => {
          addRecentProject(project);
        });

        act(() => {
          removeRecentProject('/path/to/project');
        });

        expect(useAppStore.getState().recentProjects.some(p => p.path === '/path/to/project')).toBe(
          false
        );
      });

      it('should only remove specified project', () => {
        const { addRecentProject, removeRecentProject } = useAppStore.getState();

        act(() => {
          addRecentProject({ path: '/path/1', name: 'Project 1', lastOpened: '' });
          addRecentProject({ path: '/path/2', name: 'Project 2', lastOpened: '' });
        });

        act(() => {
          removeRecentProject('/path/1');
        });

        const recent = useAppStore.getState().recentProjects;
        expect(recent.some(p => p.path === '/path/1')).toBe(false);
        expect(recent.some(p => p.path === '/path/2')).toBe(true);
      });
    });
  });

  describe('UI State', () => {
    describe('toggleSidebar', () => {
      it('should toggle sidebar collapsed state', () => {
        const { toggleSidebar } = useAppStore.getState();

        const initialState = useAppStore.getState().sidebarCollapsed;

        act(() => {
          toggleSidebar();
        });

        expect(useAppStore.getState().sidebarCollapsed).toBe(!initialState);

        act(() => {
          toggleSidebar();
        });

        expect(useAppStore.getState().sidebarCollapsed).toBe(initialState);
      });
    });
  });

  describe('Settings', () => {
    describe('updateSettings', () => {
      it('should update individual settings', () => {
        const { updateSettings } = useAppStore.getState();

        act(() => {
          updateSettings({ autoSync: false });
        });

        expect(useAppStore.getState().settings.autoSync).toBe(false);
      });

      it('should update multiple settings', () => {
        const { updateSettings } = useAppStore.getState();

        act(() => {
          updateSettings({ autoSync: false, animationsEnabled: false });
        });

        const settings = useAppStore.getState().settings;
        expect(settings.autoSync).toBe(false);
        expect(settings.animationsEnabled).toBe(false);
      });
    });
  });

  describe('Selectors', () => {
    it('selectCurrentProject should return current project', () => {
      const { setProject } = useAppStore.getState();

      act(() => {
        setProject('/test/path');
      });

      expect(useAppStore.getState().currentProject).toBe('/test/path');
    });

    it('selectDetectedTools should return detected tools', () => {
      const tools: DetectedTool[] = [
        {
          id: 'cursor',
          name: 'Cursor',
          configPath: '/.cursorrules',
          detected: true,
          hasRules: true,
          hasMcp: false,
          hasSettings: false,
        },
      ];
      const { setDetectedTools } = useAppStore.getState();

      act(() => {
        setDetectedTools(tools);
      });

      expect(useAppStore.getState().detectedTools).toEqual(tools);
    });

    it('selectSyncStatus should return sync status', () => {
      const { setSyncStatus } = useAppStore.getState();

      act(() => {
        setSyncStatus('syncing');
      });

      expect(useAppStore.getState().syncStatus).toBe('syncing');
    });
  });
});
