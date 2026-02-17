# Contributing to unify-ai

Thank you for your interest in contributing to unify-ai! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10+

### Installation

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/unify-ai.git`
3. Install dependencies: `pnpm install`
4. Build the project: `pnpm build`

### Project Structure

```
unify-ai/
├── packages/
│   ├── core/           # Core library (@unify-ai/core)
│   ├── cli/            # CLI tool (@unify-ai/cli)
│   └── gui/            # Electron GUI (@unify-ai/gui)
├── schemas/            # JSON schemas
├── .claude/            # Claude Code configuration
│   └── plans/          # Implementation plans
└── scripts/            # Utility scripts
```

## Code Style

- Use TypeScript with strict mode
- Write comments in English
- Follow existing code patterns (adapter pattern for new tools)
- Keep functions small and focused
- Add tests for new functionality

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new adapter for XYZ tool
fix: resolve import issue in Claude adapter
docs: update README with installation instructions
test: add tests for DiffEngine
refactor: simplify conflict resolution logic
chore: update dependencies
```

## Testing

We use Vitest for testing. Please ensure all tests pass before submitting PRs.

```bash
# Run all core tests
pnpm test

# Run CLI tests
pnpm test -w @unify-ai/cli

# Run GUI tests
pnpm test -w @unify-ai/gui

# Run with coverage
pnpm test --coverage
```

## Adding a New Adapter

To add support for a new AI tool:

1. Create a new directory under `packages/core/src/adapters/<tool-name>/`
2. Implement the `IAdapter` interface
3. Add comprehensive tests in `src/__tests__/adapters/<tool-name>.test.ts`
4. Register the adapter in `packages/core/src/adapters/registry.ts`
5. Add tool configuration patterns in `packages/core/src/discovery/patterns.ts`
6. Update README.md with tool support status
7. Add test fixtures for the tool

### Adapter Implementation Checklist

- [ ] Create adapter class implementing `IAdapter`
- [ ] Implement `detect()` method
- [ ] Implement `import()` method
- [ ] Implement `export()` method
- [ ] Add capability flags
- [ ] Write unit tests (aim for >90% coverage)
- [ ] Add test fixtures
- [ ] Update documentation

## Submitting Changes

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes following code style guidelines
3. Add/update tests as needed
4. Ensure all tests pass: `pnpm test`
5. Commit with clear messages following conventional commits
6. Push to your fork: `git push origin feature/my-feature`
7. Submit a Pull Request with:
   - Clear description of changes
   - Link to related issues
   - Test results
   - Screenshots (if applicable)

## Development Commands

```bash
# Development mode
pnpm dev          # Core library watch mode
pnpm cli          # Run CLI in dev mode
pnpm gui          # Launch GUI in dev mode

# Testing
pnpm test                    # Core tests
pnpm test -w @unify-ai/cli   # CLI tests
pnpm test -w @unify-ai/gui   # GUI tests

# Building
pnpm build         # Build all packages
```

## Release Process

Maintainers follow these steps:

1. Update CHANGELOG.md with release notes
2. Run tests: `./scripts/test-release.sh`
3. Update version: `./scripts/update-version.sh [version]`
4. Commit: `git commit -m "chore: release v[version]"`
5. Tag: `git tag v[version]`
6. Release: `./scripts/release.sh [version]`
7. Create GitHub release with GUI binaries

## Reporting Issues

### Bug Reports

Include:
- Clear title and description
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Node version, tool versions)
- Log output if applicable

### Feature Requests

Include:
- Clear use case
- Benefits to users
- Possible implementation approach
- Willingness to submit PR

## Getting Help

- Open an issue for questions
- Check existing documentation in `.claude/plans/`
- Review closed issues for similar problems

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
