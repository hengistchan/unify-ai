/**
 * GUI Application Store
 * Zustand-based state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// Type Definitions
// ============================================

export interface DetectedTool {
  id: string;
  name: string;
  detected: boolean;
  configPath?: string;
  hasRules: boolean;
  hasMcp: boolean;
  hasSettings: boolean;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: string;
}

export interface AppSettings {
  autoSync: boolean;
  backupEnabled: boolean;
  animationsEnabled: boolean;
}

// ============================================
// Store Interface
// ============================================

interface AppState {
  // Project
  currentProject: string | null;
  setProject: (path: string) => void;
  clearProject: () => void;

  // Tools
  detectedTools: DetectedTool[];
  setDetectedTools: (tools: DetectedTool[]) => void;

  // Sync
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  lastSyncTime: string | null;
  setSyncStatus: (status: 'idle' | 'syncing' | 'error' | 'success') => void;
  setLastSyncTime: (time: string) => void;

  // UI
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Recent projects
  recentProjects: RecentProject[];
  addRecentProject: (project: RecentProject) => void;
  removeRecentProject: (path: string) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

// ============================================
// Helper Functions
// ============================================

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// Store Creation
// ============================================

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Project
      currentProject: null,
      setProject: (path) => set({ currentProject: path }),
      clearProject: () => set({ currentProject: null, detectedTools: [] }),

      // Tools
      detectedTools: [],
      setDetectedTools: (tools) => set({ detectedTools: tools }),

      // Sync
      syncStatus: 'idle',
      lastSyncTime: null,
      setSyncStatus: (status) => set({ syncStatus: status }),
      setLastSyncTime: (time) => set({ lastSyncTime: time }),

      // UI
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Notifications
      toasts: [],
      addToast: (toast) => {
        const id = generateId();
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));

        // Auto-remove toast after duration (default 5 seconds)
        const duration = toast.duration ?? 5000;
        if (duration > 0) {
          setTimeout(() => {
            set((state) => ({
              toasts: state.toasts.filter((t) => t.id !== id),
            }));
          }, duration);
        }
      },
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      // Recent projects
      recentProjects: [],
      addRecentProject: (project) =>
        set((state) => {
          const filtered = state.recentProjects.filter((p) => p.path !== project.path);
          return {
            recentProjects: [project, ...filtered].slice(0, 10), // Keep last 10
          };
        }),
      removeRecentProject: (path) =>
        set((state) => ({
          recentProjects: state.recentProjects.filter((p) => p.path !== path),
        })),

      // Settings
      settings: {
        autoSync: true,
        backupEnabled: true,
        animationsEnabled: true,
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
    }),
    {
      name: 'unify-ai-storage',
      partialize: (state) => ({
        recentProjects: state.recentProjects,
        settings: state.settings,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

// ============================================
// Selectors
// ============================================

export const selectCurrentProject = (state: AppState) => state.currentProject;
export const selectDetectedTools = (state: AppState) => state.detectedTools;
export const selectSyncStatus = (state: AppState) => state.syncStatus;
export const selectToasts = (state: AppState) => state.toasts;
export const selectRecentProjects = (state: AppState) => state.recentProjects;
export const selectSettings = (state: AppState) => state.settings;
