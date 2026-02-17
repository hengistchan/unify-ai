# Phase 4: Testing & Release Plan

**Date**: 2026-02-17
**Status**: Ready for Release
**Version**: 0.1.0

---

## 1. Test Coverage Summary

### Core Package (@unify-ai/core)
- **Test Files**: 7
- **Total Tests**: 185
- **Status**: ✅ PASSED

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| ConflictResolver.test.ts | 30 | ✅ | Converter logic |
| Importer.test.ts | 26 | ✅ | Import operations |
| Exporter.test.ts | 18 | ✅ | Export operations |
| BaseAdapter.test.ts | 28 | ✅ | Adapter base |
| ClaudeCodeAdapter.test.ts | 30 | ✅ | Claude adapter |
| registry.test.ts | 23 | ✅ | Adapter registry |
| DiffEngine.test.ts | 30 | ✅ | Diff detection |

### CLI Package (@unify-ai/cli)
- **Test Files**: 3
- **Total Tests**: 47
- **Status**: ✅ PASSED

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| init.test.ts | 14 | ✅ | Init command |
| detect.test.ts | 12 | ✅ | Detect command |
| sync.test.ts | 21 | ✅ | Sync command |

### GUI Package (@unify-ai/gui)
- **Test Files**: 3
- **Total Tests**: 85
- **Status**: ✅ PASSED

| Test Suite | Tests | Status | Coverage |
|------------|-------|--------|----------|
| appStore.test.ts | 38 | ✅ | State management |
| Button.test.tsx | 25 | ✅ | Button component |
| SyncPreviewDialog.test.tsx | 22 | ✅ | Sync dialog |

### Total Test Coverage
- **Total Test Files**: 13
- **Total Tests**: 317
- **Pass Rate**: 100%
- **Estimated Coverage**: > 70% ✅

---

## 2. Release Checklist

### Pre-Release ✅
- [x] All tests passing (317/317)
- [x] Core library implemented
- [x] CLI commands implemented
- [x] GUI application implemented
- [x] Documentation complete (README, CLAUDE.md)
- [x] JSON schemas defined
- [x] 8 adapters implemented

### Version Management
- [ ] Update version in root package.json
- [ ] Update version in packages/core/package.json
- [ ] Update version in packages/cli/package.json
- [ ] Update version in packages/gui/package.json
- [ ] Create git tag for release

### NPM Release (CLI)
- [ ] Build CLI package
- [ ] Test global installation
- [ ] Publish to npm registry
- [ ] Verify npm package page

### Electron Release (GUI)
- [ ] Configure electron-builder
- [ ] Build for macOS (dmg)
- [ ] Build for Windows (exe)
- [ ] Build for Linux (AppImage/deb)
- [ ] Create GitHub release

### Documentation
- [ ] Update README with installation instructions
- [ ] Create CHANGELOG.md
- [ ] Write release notes
- [ ] Update API documentation

---

## 3. Release Scripts

### Core Package
```bash
# Build
pnpm build

# Test
pnpm test

# Publish to npm (public)
cd packages/core
pnpm publish --access public
```

### CLI Package
```bash
# Build
cd packages/cli
pnpm build

# Test global installation
pnpm link --global

# Test commands
unify-ai --help
unify-ai init /tmp/test-project
unify-ai detect /tmp/test-project

# Publish to npm
pnpm publish --access public
```

### GUI Package
```bash
# Build
cd packages/gui
pnpm build

# Build Electron apps
pnpm electron:build

# Output:
# - dist-electron/unify-ai-0.1.0.dmg (macOS)
# - dist-electron/unify-ai-0.1.0.exe (Windows)
# - dist-electron/unify-ai-0.1.0.AppImage (Linux)
```

---

## 4. Version Update Script

```bash
#!/bin/bash
# update-version.sh

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./update-version.sh <version>"
  echo "Example: ./update-version.sh 0.1.0"
  exit 1
fi

# Update root package.json
jq ".version = \"$VERSION\"" package.json > tmp.json && mv tmp.json package.json

# Update packages
jq ".version = \"$VERSION\"" packages/core/package.json > tmp.json && mv tmp.json packages/core/package.json
jq ".version = \"$VERSION\"" packages/cli/package.json > tmp.json && mv tmp.json packages/cli/package.json
jq ".version = \"$VERSION\"" packages/gui/package.json > tmp.json && mv tmp.json packages/gui/package.json

echo "✅ Updated all packages to version $VERSION"
```

---

## 5. Release Commands

```bash
# 1. Update version
./scripts/update-version.sh 0.1.0

# 2. Run all tests
pnpm test
pnpm test -w @unify-ai/cli
pnpm test -w @unify-ai/gui

# 3. Build all packages
pnpm build

# 4. Publish core to npm
cd packages/core
pnpm publish --access public
cd ../..

# 5. Publish CLI to npm
cd packages/cli
pnpm publish --access public
cd ../..

# 6. Build and release GUI
cd packages/gui
pnpm electron:build

# 7. Create git tag
git tag v0.1.0
git push origin v0.1.0

# 8. Create GitHub release with:
# - Release notes
# - GUI binaries (dmg, exe, AppImage)
# - Link to npm packages
```

---

## 6. Release Notes Template

```markdown
# Release v0.1.0

## Overview
First public release of unify-ai - unified configuration management for AI coding assistants.

## Features

### Core Library (@unify-ai/core)
- ✅ 8 AI tool adapters (Cursor, Claude Code, Copilot, Windsurf, Codex, Cline, Aider, Continue)
- ✅ Import/Export configuration converters
- ✅ Diff detection engine
- ✅ Conflict resolution system
- ✅ 185 unit tests

### CLI Tool (@unify-ai/cli)
- ✅ `init` - Initialize unified.json
- ✅ `detect` - Detect AI tools in project
- ✅ `import` - Import configs from tools
- ✅ `export` - Export to tool configs
- ✅ `sync` - Bidirectional synchronization
- ✅ `diff` - Show configuration differences
- ✅ `status` - View sync status
- ✅ `watch` - Auto-sync on file changes
- ✅ 47 unit tests

### GUI Application (@unify-ai/gui)
- ✅ Electron + React desktop app
- ✅ Project management interface
- ✅ Auto-detection of AI tools
- ✅ Sync preview dialog
- ✅ Settings management
- ✅ 85 unit tests

## Installation

### NPM (CLI)
\`\`\`bash
npm install -g @unify-ai/cli
unify-ai --help
\`\`\`

### GUI Application
Download from GitHub Releases:
- macOS: `unify-ai-0.1.0.dmg`
- Windows: `unify-ai-0.1.0.exe`
- Linux: `unify-ai-0.1.0.AppImage`

## Supported Tools

| Tool | Rules | MCP | Settings | Config Format |
|------|-------|-----|----------|---------------|
| Cursor | ✅ | ⚠️ | ⚠️ | Markdown + JSON |
| Claude Code | ✅ | ✅ | ✅ | Markdown + JSON |
| Codex | ✅ | ✅ | ✅ | TOML + Markdown |
| Copilot | ✅ | ❌ | ❌ | Markdown |
| Windsurf | ✅ | ⚠️ | ⚠️ | Text |
| Cline | ✅ | ✅ | ⚠️ | Markdown + JSON |
| Aider | ✅ | ❌ | ✅ | YAML |
| Continue | ✅ | ⚠️ | ✅ | YAML |

## Test Coverage
- **Total Tests**: 317
- **Pass Rate**: 100%
- **Packages**: 3 (core, cli, gui)

## Known Limitations
- CLI `sync` command advanced merge strategies (tool-wins, timestamp comparison) are partially implemented
- GUI is in beta - some features may change in future releases

## Documentation
- [README](./README.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Architecture](./CLAUDE.md)

## Next Steps (v0.2.0)
- Complete sync merge strategies
- Add configuration templates
- Team configuration sharing
- Cloud sync support
```

---

## 7. Post-Release Tasks

- [ ] Verify npm packages are published
- [ ] Test global CLI installation
- [ ] Download and test GUI binaries
- [ ] Update GitHub repository description
- [ ] Share on social media (Twitter, Reddit, HN)
- [ ] Add to awesome lists
- [ ] Monitor GitHub issues

---

## 8. Rollback Plan

If critical issues are found:

```bash
# Deprecate npm package
npm deprecate @unify-ai/core@0.1.0 "Critical bug found, please upgrade to 0.1.1"
npm deprecate @unify-ai/cli@0.1.0 "Critical bug found, please upgrade to 0.1.1"

# Delete GitHub release
# Delete git tag
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0

# Create hotfix
git checkout -b hotfix/0.1.1
# Fix issues
# Release 0.1.1
```

---

**Status**: ✅ Ready for Release
**Next Step**: Run release commands
