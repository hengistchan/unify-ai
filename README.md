# unify-ai

<div align="center">

[![npm version](https://img.shields.io/npm/v/unify-ai.svg)](https://www.npmjs.com/package/unify-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/node/v/unify-ai)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178c6.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10+-f69220.svg)](https://pnpm.io/)

Unified configuration management for AI coding assistants.

[English](./README.md) | [中文](./README.zh-CN.md)

</div>

## Overview

unify-ai is a tool that unifies configuration management across multiple AI coding assistants. It supports importing, exporting, synchronizing, and detecting conflicts between configurations from various AI tools.

## Supported Tools

| Tool | Rules | MCP | Settings | Config Format |
|------|-------|-----|----------|---------------|
| Cursor | ✅ Full | ⚠️ Partial | ⚠️ Partial | Markdown + JSON |
| Claude Code | ✅ Full | ✅ Full | ✅ Full | Markdown + JSON |
| Codex | ✅ Full | ✅ Full | ✅ Full | TOML + Markdown |
| Copilot | ✅ Full | ❌ None | ❌ None | Markdown |
| Windsurf | ✅ Full | ⚠️ Partial | ⚠️ Partial | Text |
| Cline | ✅ Full | ✅ Full | ⚠️ Partial | Markdown + JSON |
| Aider | ✅ Full | ❌ None | ✅ Full | YAML |
| Continue | ✅ Full | ⚠️ Partial | ✅ Full | YAML |

## Features

- 🔄 **Import/Export**: Convert configurations between different AI tools
- 🔀 **Bidirectional Sync**: Keep configurations synchronized across tools
- 📊 **Diff Detection**: Detect differences between configurations
- ⚔️ **Conflict Resolution**: Handle configuration conflicts intelligently
- 💻 **CLI Interface**: Command-line tool for easy automation
- 🖥️ **GUI Application**: Desktop application with Electron + React

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/unify-ai.git
cd unify-ai

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## Quick Start

### CLI Usage

```bash
# Initialize unified.json in a project
pnpm cli init /path/to/project

# Detect AI tools in a project
pnpm cli detect /path/to/project

# Import configuration from a tool
pnpm cli import cursor /path/to/project

# Export unified config to a tool
pnpm cli export cursor /path/to/project

# Show differences between tools
pnpm cli diff cursor /path/to/project

# Sync configurations
pnpm cli sync /path/to/project

# Watch for changes (auto-sync)
pnpm cli watch /path/to/project

# Check sync status
pnpm cli status /path/to/project
```

### GUI Usage

```bash
# Launch the GUI application
pnpm gui
```

The GUI provides:
- 📁 Project management with folder selection
- 🔍 Auto-detection of AI tools
- 👁️ Sync preview before applying changes
- ⚙️ Settings management
- 📋 Recent projects tracking

### Library Usage

```typescript
import { adapterRegistry, Importer, Exporter, DiffEngine } from '@unify-ai/core';

// Initialize adapters
await adapterRegistry.initialize();

// Import from a specific tool
const importer = new Importer();
const result = await importer.importFrom('cursor', '/path/to/project');

// Export to a specific tool
const exporter = new Exporter();
await exporter.exportTo('claude-code', config, '/path/to/project');

// Compute differences
const diffEngine = new DiffEngine();
const diffs = await diffEngine.computeAllDiffs(unifiedConfig, '/path/to/project');
```

## Architecture

This is a pnpm monorepo with three packages:

- 📦 `@unify-ai/core` - Core library with adapters and converters
- 💻 `@unify-ai/cli` - Command-line interface
- 🖥️ `@unify-ai/gui` - Electron + React GUI application

The core library uses an **adapter pattern** where each AI tool has its own adapter implementing the `IAdapter` interface.

### Key Components

| Component | Description |
|-----------|-------------|
| **Adapters** | Parse and generate tool-specific config formats |
| **Importer** | Import configs from tools to unified format |
| **Exporter** | Export unified config to tool formats |
| **DiffEngine** | Detect differences between configs |
| **ConflictResolver** | Handle sync conflicts |
| **ChangeTracker** | Track configuration changes |
| **ConfigManager** | Load, save, validate configs |

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test                    # Core tests
pnpm test -w @unify-ai/cli   # CLI tests
pnpm test -w @unify-ai/gui   # GUI tests

# Development mode
pnpm dev          # Core library watch mode
pnpm cli          # Run CLI in dev mode
pnpm gui          # Launch GUI in dev mode
```

## Test Coverage

| Package | Tests | Status |
|---------|-------|--------|
| @unify-ai/core | 167 | ✅ |
| @unify-ai/cli | 47 | ✅ |
| @unify-ai/gui | 85 | ✅ |

## JSON Schemas

Configuration schemas are available in the `schemas/` directory:

- `unified.schema.json` - Main unified configuration schema
- `rules.schema.json` - Rules/instructions schema
- `mcp.schema.json` - MCP server configuration schema
- `permission.schema.json` - Permission controls schema
- `model.schema.json` - Model configuration schema

## CLI Commands Reference

| Command | Description |
|---------|-------------|
| `init [path]` | Create unified.json configuration file |
| `detect [path]` | Detect AI tools in a project |
| `import <tool> [path]` | Import configuration from a specific tool |
| `export <tool> [path]` | Export unified config to a specific tool |
| `sync [path]` | Synchronize configurations between tools |
| `diff <tool> [path]` | Show differences between unified and tool config |
| `status [path]` | Show current sync status |
| `watch [path]` | Watch for file changes and auto-sync |

### CLI Options

```
Options:
  -c, --config <path>     Path to unified.json
  -f, --format <format>   Output format: table, json (default: "table")
  --dry-run               Preview changes without writing
  --verbose               Show detailed output
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
