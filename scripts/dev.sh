#!/bin/bash
# dev.sh - Run development watch mode for core package

# Get the repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Starting development watch mode for @unify-ai/core..."
cd "$REPO_ROOT/packages/core"
pnpm run dev
