# Unify-AI Test Plan

**Version**: 1.0.0
**Date**: 2026-02-17
**Author**: Claude

---

## 1. Overview

This document outlines the comprehensive testing strategy for unify-ai, covering:

- Unit tests for core library
- Integration tests for CLI commands
- Component tests for GUI
- End-to-end user flow tests

---

## 2. Test Categories

### 2.1 Unit Tests (Priority: High)

#### 2.1.1 Core Library - Adapters

| Test Suite        | File                                                       | Tests                                                                                       |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| BaseAdapter       | `__tests__/adapters/base/BaseAdapter.test.ts`              | hasCapability, getCapabilityLevel, discoverFiles, detect, validate, mergeResults, deepMerge |
| AdapterRegistry   | `__tests__/adapters/registry.test.ts`                      | register, unregister, get, getAll, findByCapability, detectForProject                       |
| ClaudeCodeAdapter | `__tests__/adapters/claude-code/ClaudeCodeAdapter.test.ts` | parse CLAUDE.md, parse .mcp.json, generate, @reference resolution                           |
| CursorAdapter     | `__tests__/adapters/cursor/CursorAdapter.test.ts`          | parse .cursorrules, parse .cursor/rules/\*.md, YAML frontmatter                             |
| CopilotAdapter    | `__tests__/adapters/copilot/CopilotAdapter.test.ts`        | parse .github/copilot-instructions.md                                                       |
| WindsurfAdapter   | `__tests__/adapters/windsurf/WindsurfAdapter.test.ts`      | parse .windsurfrules, parse .windsurf/mcp.json                                              |
| CodexAdapter      | `__tests__/adapters/codex/CodexAdapter.test.ts`            | parse CODEX.md, parse codex.toml                                                            |
| ClineAdapter      | `__tests__/adapters/cline/ClineAdapter.test.ts`            | parse .clinerules, parse .cline/mcp.json                                                    |
| AiderAdapter      | `__tests__/adapters/aider/AiderAdapter.test.ts`            | parse .aider.conf.yml                                                                       |
| ContinueAdapter   | `__tests__/adapters/continue/ContinueAdapter.test.ts`      | parse continue.json, parse .continue/config.json                                            |

#### 2.1.2 Core Library - Converters

| Test Suite         | File                                             | Tests                                                                              |
| ------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Importer           | `__tests__/converter/Importer.test.ts`           | import, importFrom, importFile, mergeConfigs, mergeSettings                        |
| Exporter           | `__tests__/converter/Exporter.test.ts`           | export, exportMultiple, preview, createBackup, checkCapabilities                   |
| ConflictResolver   | `__tests__/converter/ConflictResolver.test.ts`   | resolveRuleConflicts, resolveMCPConflicts, resolveConfigConflicts, all strategies  |
| DiffEngine         | `__tests__/converter/DiffEngine.test.ts`         | deepDiff, diffArrays, computeAllDiffs, computeDiffForTool, compareUnified, isEqual |
| ChangeTracker      | `__tests__/converter/ChangeTracker.test.ts`      | recordChange, getHistory, detectSource, getRecentChanges, markResolved             |
| FingerprintManager | `__tests__/converter/FingerprintManager.test.ts` | generate, update, verify, isModified, save, load                                   |

#### 2.1.3 Core Library - Core

| Test Suite      | File                                   | Tests                                                                                     |
| --------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| ConfigManager   | `__tests__/core/ConfigManager.test.ts` | load, save, validate, backup, restore, listBackups, exists, createDefaultConfig           |
| ConfigValidator | `__tests__/core/validator.test.ts`     | validate, validateRules, validateMcp, validateSettings, validateCommands, validatePrompts |

#### 2.1.4 Core Library - Discovery

| Test Suite    | File                                        | Tests                                                             |
| ------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| FileDiscovery | `__tests__/discovery/FileDiscovery.test.ts` | discover, discoverByCapability, detectTools, checkFile, scanPaths |

---

### 2.2 CLI Integration Tests (Priority: High)

| Test Suite     | File                                    | Tests                                                   |
| -------------- | --------------------------------------- | ------------------------------------------------------- |
| init command   | `__tests__/cli/commands/init.test.ts`   | Create unified.json, interactive mode, import from tool |
| detect command | `__tests__/cli/commands/detect.test.ts` | Detect all tools, verbose output, JSON output           |
| import command | `__tests__/cli/commands/import.test.ts` | Import single tool, import multiple, merge strategy     |
| export command | `__tests__/cli/commands/export.test.ts` | Export to single tool, export multiple, backup option   |
| sync command   | `__tests__/cli/commands/sync.test.ts`   | One-way sync, two-way sync, conflict handling           |
| diff command   | `__tests__/cli/commands/diff.test.ts`   | Diff output formats, color output, exit codes           |
| status command | `__tests__/cli/commands/status.test.ts` | Status output, pending changes display                  |
| watch command  | `__tests__/cli/commands/watch.test.ts`  | File watching, auto-sync, debouncing, signal handling   |

---

### 2.3 GUI Tests (Priority: Medium)

#### 2.3.1 Store Tests

| Test Suite | File                                    | Tests                                                                                                                         |
| ---------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| appStore   | `__tests__/gui/stores/appStore.test.ts` | setProject, clearProject, setDetectedTools, previewSync, executeSync, loadToolConfig, toast system, recent projects, settings |

#### 2.3.2 Component Tests

| Test Suite        | File                                                  | Tests                                                      |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| Button            | `__tests__/gui/components/common/Button.test.tsx`     | Render, variants, sizes, disabled state, loading state     |
| Card              | `__tests__/gui/components/common/Card.test.tsx`       | Render, header, body, footer, hoverable                    |
| Badge             | `__tests__/gui/components/common/Badge.test.tsx`      | Render, variants                                           |
| Modal             | `__tests__/gui/components/common/Modal.test.tsx`      | Open/close, title, footer, size                            |
| Toast             | `__tests__/gui/components/common/Toast.test.tsx`      | Render, types, auto-dismiss                                |
| SyncPreviewDialog | `__tests__/gui/components/SyncPreviewDialog.test.tsx` | Open/close, loading state, preview display, confirm/cancel |

#### 2.3.3 Page Tests

| Test Suite | File                                      | Tests                                                         |
| ---------- | ----------------------------------------- | ------------------------------------------------------------- |
| Home       | `__tests__/gui/pages/Home.test.tsx`       | Render, open project, recent projects, current project status |
| Project    | `__tests__/gui/pages/Project.test.tsx`    | Render, tool list, sync preview, sync execution               |
| ToolDetail | `__tests__/gui/pages/ToolDetail.test.tsx` | Render, config loading, rules/MCP/settings display            |
| Settings   | `__tests__/gui/pages/Settings.test.tsx`   | Render, settings toggle, persistence                          |

---

### 2.4 E2E Tests (Priority: Medium)

| Test Suite | File                            | Tests                                                     |
| ---------- | ------------------------------- | --------------------------------------------------------- |
| CLI E2E    | `__tests__/e2e/cli.e2e.test.ts` | Full workflow: init → detect → import → sync → export     |
| GUI E2E    | `__tests__/e2e/gui.e2e.test.ts` | Open project → detect tools → preview sync → execute sync |

---

## 3. Test Data

### 3.1 Fixtures Directory Structure

```
packages/core/src/__tests__/fixtures/
├── configs/
│   ├── valid-unified.json
│   ├── minimal-unified.json
│   ├── complex-unified.json
│   └── invalid-unified.json
├── tools/
│   ├── claude-code/
│   │   ├── CLAUDE.md
│   │   └── .mcp.json
│   ├── cursor/
│   │   ├── .cursorrules
│   │   └── .cursor/rules/
│   │       ├── general.md
│   │       └── react.md
│   ├── copilot/
│   │   └── .github/copilot-instructions.md
│   ├── windsurf/
│   │   ├── .windsurfrules
│   │   └── .windsurf/mcp.json
│   ├── codex/
│   │   ├── CODEX.md
│   │   └── codex.toml
│   ├── cline/
│   │   ├── .clinerules
│   │   └── .cline/mcp.json
│   ├── aider/
│   │   └── .aider.conf.yml
│   └── continue/
│       └── continue.json
└── projects/
    ├── empty-project/
    ├── multi-tool-project/
    └── conflict-project/
```

---

## 4. Edge Cases

### 4.1 Configuration Edge Cases

- [ ] Empty configuration (no rules, no MCP, no settings)
- [ ] Very large configuration (1000+ rules)
- [ ] Circular references in @import directives
- [ ] Invalid UTF-8 encoding
- [ ] Binary files in config directories
- [ ] Symlink handling
- [ ] Permission denied errors
- [ ] Concurrent file access

### 4.2 Sync Edge Cases

- [ ] Both sides modified same field
- [ ] One side deleted, other modified
- [ ] New items on both sides with same ID
- [ ] Capability mismatch (tool doesn't support feature)

### 4.3 Platform Edge Cases

- [ ] Windows path separators (simulated)
- [ ] Case-sensitive filesystem handling
- [ ] Long file paths
- [ ] Hidden files handling

### 4.4 Format Edge Cases

- [ ] Invalid JSON/YAML/TOML syntax
- [ ] Missing required fields
- [ ] Unknown fields (forward compatibility)
- [ ] Unicode in content
- [ ] Markdown with special characters

---

## 5. Test Implementation Plan

### Phase 1: Core Unit Tests (Week 1)

1. Set up test infrastructure (Jest/Vitest)
2. Create test fixtures
3. Implement adapter tests (all 8 adapters)
4. Implement converter tests
5. Implement core tests (ConfigManager, validator)
6. Implement discovery tests

### Phase 2: CLI Tests (Week 1-2)

1. Set up CLI test helpers
2. Implement command tests with mocked fs
3. Add integration tests with temp directories

### Phase 3: GUI Tests (Week 2)

1. Set up React Testing Library
2. Implement store tests
3. Implement component tests
4. Add Electron mock for IPC

### Phase 4: E2E Tests (Week 2)

1. Set up E2E test environment
2. Implement CLI E2E workflow
3. Implement GUI E2E workflow (Playwright optional)

---

## 6. Coverage Goals

| Package        | Target Coverage       |
| -------------- | --------------------- |
| @unify-ai/core | 80%                   |
| @unify-ai/cli  | 70%                   |
| @unify-ai/gui  | 60% (components only) |

---

## 7. Test Commands

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm test -w @unify-ai/core
pnpm test -w @unify-ai/cli
pnpm test -w @unify-ai/gui

# Run tests with coverage
pnpm test --coverage

# Run specific test file
pnpm test path/to/testfile.ts

# Run tests in watch mode
pnpm test --watch
```

---

## 8. CI/CD Integration

Tests should run on:

- Every push to main/develop branches
- Every pull request
- Before npm publish

Coverage reports should be uploaded to coverage tracking service.

---

_Test Plan Version: 1.0.0_
_Last Updated: 2026-02-17_
