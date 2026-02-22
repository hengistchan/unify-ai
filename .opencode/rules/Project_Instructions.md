# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**unify-ai** is a unified configuration management tool for AI coding assistants (Cursor, Claude Code, Copilot, Windsurf, Codex, Cline, Aider, Continue). It provides bidirectional synchronization, diff detection, and conflict resolution across multiple AI tool configurations.

## Architecture

This is a pnpm monorepo with three packages:

- `@unify-ai/core` - Core library with adapters and converters
- `@unify-ai/cli` - Command-line interface (in development)
- `@unify-ai/gui` - Electron + React GUI (in development)

The core library uses an **adapter pattern** where each AI tool has its own adapter implementing the `IAdapter` interface. Adapters handle parsing (import) and generating (export) tool-specific configuration formats.

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Development
pnpm dev          # Core library in watch mode
pnpm cli          # Run CLI in development mode
pnpm gui          # Run GUI in development mode

# Run single test file
pnpm test path/to/testfile.ts
```

## Supported AI Tools

| Tool        | Config Format   | Rules           | MCP     | Settings |
| ----------- | --------------- | --------------- | ------- | -------- | ------- |
| Cursor      | Markdown + JSON | Full            | Partial | Partial  |
| Claude Code | Markdown + JSON | Full            | Full    | Full     |
| Codex       | TOML + Markdown | Full            | Full    | Full     |
| Copilot     | Markdown        | Full            | None    | None     |
| Windsurf    | Text            |                 | Partial |
| Full        | Partial Cline   | Markdown + JSON | Full    | Full     | Partial |
| Aider       | YAML            | Full            | None    | Full     |
| Continue    | YAML            | Full            | Partial | Full     |

## Key Files

- `packages/core/src/core/types.ts` - Core type definitions
- `packages/core/src/adapters/base/IAdapter.ts` - Adapter interface
- `packages/core/src/adapters/registry.ts` - Adapter registry
- `packages/core/src/converter/` - Import/export converters
- `schemas/unified.schema.json` - Main JSON schema

## Development Notes

- Uses ES2022, TypeScript strict mode
- All comments in English
- Follow adapter pattern: each tool in its own directory under `packages/core/src/adapters/`
- Configuration files use various formats (JSON, YAML, TOML, Markdown) depending on the tool