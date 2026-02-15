# unify-ai

<div align="center">

[![npm version](https://img.shields.io/npm/v/unify-ai.svg)](https://www.npmjs.com/package/unify-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/node/v/unify-ai)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178c6.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10+-f69220.svg)](https://pnpm.io/)

Unified configuration management for AI coding assistants.

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
- 🖥️ **GUI Application**: Desktop application for visual management (coming soon)

## Quick Start

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build
```

### CLI Usage

```bash
# Detect AI tools in a project
unify-ai detect /path/to/project

# Import configuration from a tool
unify-ai import cursor /path/to/project

# Export unified config to a tool
unify-ai export cursor /path/to/project

# Show differences between tools
unify-ai diff cursor /path/to/project

# Sync configurations
unify-ai sync /path/to/project

# Watch for changes
unify-ai watch /path/to/project
```

### Library Usage

```typescript
import { adapterRegistry, Importer, Exporter } from '@unify-ai/core';

// Initialize adapters
await adapterRegistry.initialize();

// Import from a specific tool
const importer = new Importer();
const result = await importer.importFrom('cursor', '/path/to/project');

// Export to a specific tool
const exporter = new Exporter();
await exporter.exportTo('claude-code', config, '/path/to/project');
```

## Architecture

This is a pnpm monorepo with three packages:

- 📦 `@unify-ai/core` - Core library with adapters and converters
- 💻 `@unify-ai/cli` - Command-line interface
- 🖥️ `@unify-ai/gui` - Electron + React GUI (coming soon)

The core library uses an **adapter pattern** where each AI tool has its own adapter implementing the `IAdapter` interface.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev          # Core library
pnpm cli          # CLI tool
pnpm gui          # GUI application
```

## JSON Schemas

Configuration schemas are available in the `schemas/` directory:

- `unified.schema.json` - Main unified configuration schema
- `rules.schema.json` - Rules/instructions schema
- `mcp.schema.json` - MCP server configuration schema
- `permission.schema.json` - Permission controls schema
- `model.schema.json` - Model configuration schema

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
