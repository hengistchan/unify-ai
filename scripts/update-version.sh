#!/bin/bash
# update-version.sh - Update version across all packages

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/update-version.sh <version>"
  echo "Example: ./scripts/update-version.sh 0.1.0"
  exit 1
fi

echo "📦 Updating version to $VERSION..."

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required but not installed."
    echo "Install with: brew install jq (macOS) or apt install jq (Linux)"
    exit 1
fi

# Update root package.json
echo "  Updating root package.json..."
jq ".version = \"$VERSION\"" package.json > tmp.json && mv tmp.json package.json

# Update packages
echo "  Updating packages/core/package.json..."
jq ".version = \"$VERSION\"" packages/core/package.json > tmp.json && mv tmp.json packages/core/package.json

echo "  Updating packages/cli/package.json..."
jq ".version = \"$VERSION\"" packages/cli/package.json > tmp.json && mv tmp.json packages/cli/package.json

echo "  Updating packages/gui/package.json..."
jq ".version = \"$VERSION\"" packages/gui/package.json > tmp.json && mv tmp.json packages/gui/package.json

echo ""
echo "✅ Updated all packages to version $VERSION"
echo ""
echo "Next steps:"
echo "  1. git add ."
echo "  2. git commit -m \"chore: bump version to $VERSION\""
echo "  3. git tag v$VERSION"
echo "  4. git push origin main --tags"
