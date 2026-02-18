#!/bin/bash
# release.sh - Full release script for unify-ai

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.0.1"
  exit 1
fi

echo "🚀 Starting release process for v$VERSION"
echo ""

# Step 1: Run all tests
echo "📋 Step 1: Running all tests..."
echo "  Core tests..."
pnpm test

echo "  CLI tests..."
cd packages/cli
pnpm test
cd ../..

echo "  GUI tests..."
cd packages/gui
pnpm test
cd ../..

echo "✅ All tests passed!"
echo ""

# Step 2: Build all packages
echo "🔨 Step 2: Building all packages..."
pnpm build
echo "✅ Build complete!"
echo ""

# Step 3: Update version
echo "📦 Step 3: Updating version to $VERSION..."
./scripts/update-version.sh $VERSION
echo ""

# Step 4: Commit version update
echo "💾 Step 4: Committing version update..."
git add package.json packages/*/package.json CHANGELOG.md
git commit -m "chore: release v$VERSION"
echo ""

# Step 5: Create git tag
echo "🏷️  Step 5: Creating git tag v$VERSION..."
git tag "v$VERSION"
echo ""

# Step 6: Publish to npm
echo "📚 Step 6: Publishing to npm..."
echo "  Publishing @unify-ai/core..."
cd packages/core
pnpm publish --access public
cd ../..

echo "  Publishing @unify-ai/cli..."
cd packages/cli
pnpm publish --access public
cd ../..

echo "✅ Published to npm!"
echo ""

# Step 7: Build GUI
echo "🖥️  Step 7: Building GUI application..."
cd packages/gui
pnpm electron:build
cd ../..
echo "✅ GUI build complete!"
echo ""

# Step 8: Push to GitHub
echo "🌐 Step 8: Pushing to GitHub..."
git push origin main --tags
echo ""

echo "✅ Release v$VERSION complete!"
echo ""
echo "Next steps:"
echo "  1. Create GitHub release at: https://github.com/yourusername/unify-ai/releases/new"
echo "  2. Upload GUI binaries from packages/gui/dist-electron/"
echo "  3. Copy release notes from CHANGELOG.md"
echo "  4. Announce on social media"
echo ""
echo "GUI binaries location:"
echo "  - macOS: packages/gui/dist-electron/unify-ai-$VERSION.dmg"
echo "  - Windows: packages/gui/dist-electron/unify-ai-$VERSION.exe"
echo "  - Linux: packages/gui/dist-electron/unify-ai-$VERSION.AppImage"
