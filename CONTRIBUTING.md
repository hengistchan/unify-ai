# Contributing to unify-ai

Thank you for your interest in contributing to unify-ai!

## Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Build the project: `pnpm build`

## Code Style

- Use TypeScript with strict mode
- Write comments in English
- Follow existing code patterns (adapter pattern for new tools)

## Adding a New Adapter

To add support for a new AI tool:

1. Create a new directory under `packages/core/src/adapters/<tool-name>/`
2. Implement the `IAdapter` interface in `BaseAdapter`
3. Register the adapter in `packages/core/src/adapters/registry.ts`
4. Add tool configuration patterns in `packages/core/src/discovery/patterns.ts`

## Submitting Changes

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Add tests if applicable
4. Commit with clear messages
5. Push to your fork
6. Submit a Pull Request

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
