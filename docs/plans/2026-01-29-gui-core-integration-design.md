# GUI Core Integration Design

**Date**: 2026-01-29 (大年初一)
**Author**: Claude
**Status**: Draft

## Overview

Integrate `@unify-ai/core` into the GUI application to make detection/import/export/sync fully functional.

## Current State

### What's Done
- Electron + React + Vite setup complete
- Tailwind CSS configured with dark theme
- Electron Builder configured
- Basic IPC channels defined
- UI components: Sidebar, Toolbar, Button, Card, Modal, Toast
- Pages: HomePage, Project, ToolDetail, Settings
- Zustand store with project/sync state

### What's Missing
- IPC handlers use custom logic instead of @unify-ai/core
- syncConfig is a placeholder (returns mock success)
- No Sync Preview Dialog
- Duplicate page files (Home.tsx vs HomePage.tsx)
- StatusBar component exists but unused

## Architecture

```
Renderer Process                    Main Process
┌─────────────────────┐            ┌─────────────────────┐
│ React Components    │            │ IPC Handlers        │
│ ├─ HomePage         │            │ ├─ detectTools      │
│ ├─ Project          │   IPC      │ ├─ importConfig     │
│ ├─ ToolDetail       │ ◄────────► │ ├─ exportConfig     │
│ └─ SyncPreviewDialog│            │ ├─ previewSync      │
│         │           │            │ └─ getToolConfig    │
│  electronAPI        │            │         │           │
└─────────────────────┘            │  @unify-ai/core     │
                                   └─────────────────────┘
```

## Implementation Plan

### Task 1: IPC Handlers Refactor (Agent 1)

**Files to modify:**
- `packages/gui/electron/ipc/tool-detection.ts` - Replace with @unify-ai/core
- `packages/gui/electron/ipc/sync.ts` - Replace with @unify-ai/core
- `packages/gui/electron/ipc/channels.ts` - Add new channels
- `packages/gui/electron/ipc/index.ts` - Register new handlers

**New channels:**
```typescript
PREVIEW_SYNC      // Preview sync changes (dry-run)
GET_TOOL_CONFIG   // Get detailed config for a single tool
```

**Implementation:**
```typescript
// tool-detection.ts
import { fileDiscovery, adapterRegistry } from '@unify-ai/core';

export async function detectTools(folderPath: string): Promise<DetectedTool[]> {
  const adapters = await fileDiscovery.detectTools(folderPath);
  return adapters.map(adapter => ({
    id: adapter.toolMeta.id,
    name: adapter.toolMeta.name,
    configPath: '', // determined by discovery
    detected: true,
    hasRules: adapter.hasCapability('rules'),
    hasMcp: adapter.hasCapability('mcp_servers'),
    hasSettings: adapter.hasCapability('settings'),
  }));
}
```

### Task 2: Sync Preview Dialog (Agent 2)

**New files:**
- `packages/gui/src/components/SyncPreviewDialog.tsx`

**Features:**
- Show diff summary (files to create/update/delete)
- List affected tools
- Show conflicts if any
- Confirm/Cancel buttons

**Props:**
```typescript
interface SyncPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  preview: SyncPreview | null;
  loading: boolean;
}

interface SyncPreview {
  sourceTool: string;
  targetTools: string[];
  changes: FileChange[];
  conflicts: Conflict[];
}

interface FileChange {
  path: string;
  action: 'create' | 'update' | 'delete';
  linesAdded: number;
  linesRemoved: number;
}
```

### Task 3: Store & Hooks Update (Agent 3)

**Files to modify:**
- `packages/gui/src/stores/appStore.ts`

**New state:**
```typescript
interface AppState {
  // Existing
  currentProject: Project | null;
  detectedTools: DetectedTool[];
  // New
  unifiedConfig: UnifiedConfig | null;
  syncPreview: SyncPreview | null;
  syncLoading: boolean;
  // Actions
  previewSync: (sourceTool: string, targetTools: string[]) => Promise<void>;
  executeSync: () => Promise<void>;
  loadToolConfig: (toolId: string) => Promise<void>;
}
```

### Task 4: UI Pages Update (Agent 4)

**Files to modify:**
- `packages/gui/src/pages/Project.tsx` - Connect to real data
- `packages/gui/src/pages/ToolDetail.tsx` - Load real config
- `packages/gui/src/pages/HomePage.tsx` - Fix sync button

**Changes:**
- Remove mock data
- Add loading states
- Connect to store actions
- Integrate SyncPreviewDialog

### Task 5: Code Cleanup & Verification (Agent 5)

**Files to remove:**
- `packages/gui/src/pages/Home.tsx` (duplicate)
- `packages/gui/src/pages/SettingsPage.tsx` (duplicate)
- `packages/gui/src/pages/ToolsPage.tsx` (unused)
- `packages/gui/src/components/layout/MainLayout.tsx` (unused)

**Tasks:**
1. Remove duplicate/unused files
2. Ensure all imports are correct
3. Run `pnpm build` in packages/gui
4. Run `pnpm dev:gui` to verify app starts
5. Test basic flow: open folder → detect tools → view details

## Verification Checklist

- [ ] `pnpm build` passes in root
- [ ] `pnpm dev:gui` starts without errors
- [ ] Can open a project folder
- [ ] Detected tools show real data (not mock)
- [ ] ToolDetail shows actual configuration
- [ ] Sync preview dialog opens and shows diff
- [ ] Sync executes and writes files

## Dependencies Between Tasks

```
Task 1 (IPC) ─────────────────────────────────┐
                                              │
Task 3 (Store) ───────────────────────────────┤
                                              ├──► Task 4 (UI Pages)
Task 2 (SyncPreviewDialog) ───────────────────┤
                                              │
Task 5 (Cleanup) ─────────────────────────────┘
```

Tasks 1, 2, 3, 5 can run in parallel. Task 4 depends on 1, 2, 3 being complete.

## Notes

- All IPC handlers must handle errors gracefully
- UI should show loading states during async operations
- Sync preview should support dry-run mode
- Keep existing dark theme styling consistent
