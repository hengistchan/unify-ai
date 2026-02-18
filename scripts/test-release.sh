#!/bin/bash
# test-release.sh - Test the release process without publishing

set -e

VERSION="0.0.1-test"

echo "🧪 Testing release process..."
echo ""

# Step 1: Run all tests
echo "📋 Step 1: Running all tests..."
pnpm test
pnpm test -w @unify-ai/cli
pnpm test -w @unify-ai/gui
echo "✅ All tests passed!"
echo ""

# Step 2: Build all packages
echo "🔨 Step 2: Building all packages..."
pnpm build
echo "✅ Build complete!"
echo ""

# Step 3: Test CLI globally
echo "🔗 Step 3: Testing CLI global installation..."
cd packages/cli
pnpm link --global
cd ../..

echo "Testing commands..."
unify-ai --help
unify-ai --version

# Create test project
TEST_DIR=$(mktemp -d)
echo "Test directory: $TEST_DIR"

unify-ai init "$TEST_DIR"
unify-ai detect "$TEST_DIR"
unify-ai status "$TEST_DIR"

# Cleanup
rm -rf "$TEST_DIR"
pnpm unlink --global @unify-ai/cli

echo "✅ CLI test complete!"
echo ""

# Step 4: Test GUI build (without packaging)
echo "🖥️  Step 4: Testing GUI build..."
cd packages/gui
pnpm build
cd ../..
echo "✅ GUI build test complete!"
echo ""

echo "✅ All release tests passed!"
echo ""
echo "Ready for actual release with: ./scripts/release.sh 0.0.1"
