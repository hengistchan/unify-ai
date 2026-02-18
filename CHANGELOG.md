# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-02-17

### Added

#### Core Library (@unify-ai/core)
- Initial release of core library
- 8 AI tool adapters:
  - Cursor adapter (full rules, partial MCP/settings)
  - Claude Code adapter (full rules, MCP, settings)
  - Codex adapter (full rules, MCP, settings)
  - Copilot adapter (full rules)
  - Windsurf adapter (full rules, partial MCP/settings)
  - Cline adapter (full rules, MCP, partial settings)
  - Aider adapter (full rules, settings)
  - Continue adapter (full rules, partial MCP, full settings)
- Import/Export converters for all tools
- Diff detection engine
- Conflict resolution system
- Change tracking infrastructure
- File discovery system
- Adapter registry with auto-detection
- JSON Schema validation
- 185 unit tests

#### CLI Tool (@unify-ai/cli)
- `init` command - Initialize unified.json configuration
- `detect` command - Detect AI tools in a project
- `import` command - Import configuration from AI tools
- `export` command - Export unified config to AI tools
- `sync` command - Bidirectional synchronization
- `diff` command - Show configuration differences
- `status` command - View sync status
- `watch` command - Auto-sync on file changes
- Support for JSON and table output formats
- Dry-run mode for previewing changes
- Verbose logging option
- 47 unit tests

#### GUI Application (@unify-ai/gui)
- Electron + React desktop application
- Project management interface
- Auto-detection of AI tools
- Sync preview dialog
- Settings management
- Recent projects tracking
- 85 unit tests

#### Documentation
- README with installation and usage instructions
- Contributing guide
- Architecture documentation (CLAUDE.md)
- JSON schemas for unified configuration
- Code of conduct

#### Infrastructure
- pnpm monorepo setup
- TypeScript configuration
- Vitest test framework
- ESLint configuration

### Test Coverage
- **Total Tests**: 317
  - Core: 185 tests
  - CLI: 47 tests
  - GUI: 85 tests
- **Pass Rate**: 100%

### Known Limitations
- CLI `sync` command advanced merge strategies (tool-wins, timestamp comparison) are partially implemented
- GUI is in beta - some features may change in future releases
- No cloud sync support yet
- No team configuration sharing

### Security
- API keys stored in environment variables or encrypted storage
- No sensitive data in unified.json
- Secure file permissions

## [Unreleased]

### Planned Features (v0.1.0)
- Complete sync merge strategies implementation
- Configuration templates system
- Team configuration sharing
- Cloud sync support
- VS Code extension

### Planned Features (v0.2.0)
- Web interface
- Plugin system
- Custom adapter support
- API for third-party integrations

---

## Version History

- **0.0.1** (2026-02-17) - Initial release
