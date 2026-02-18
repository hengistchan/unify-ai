#!/bin/bash
# update-version.sh - Update version across all packages

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VERSION=$1

# Print colored message
print_msg() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

if [ -z "$VERSION" ]; then
    print_msg $RED "Usage: ./scripts/update-version.sh <version>"
    echo "Example: ./scripts/update-version.sh 0.0.2"
    exit 1
fi

# Validate version format
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
    print_msg $RED "❌ Invalid version format: $VERSION"
    echo "Expected format: X.Y.Z or X.Y.Z-prerelease"
    exit 1
fi

print_msg $BLUE "📦 Updating version to $VERSION..."

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_msg $RED "❌ Error: jq is required but not installed."
    echo "Install with: brew install jq (macOS) or apt install jq (Linux)"
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_msg $YELLOW "Current version: $CURRENT_VERSION"
print_msg $YELLOW "New version: $VERSION"
echo ""

# Check if version is the same
if [ "$CURRENT_VERSION" = "$VERSION" ]; then
    print_msg $YELLOW "⚠️  Version is already $VERSION, nothing to update"
    exit 0
fi

# Check if version already exists as git tag
if git tag | grep -q "^v$VERSION$"; then
    print_msg $RED "❌ Error: Version $VERSION already exists as git tag"
    echo "Existing tags:"
    git tag | grep "^v$VERSION" || true
    exit 1
fi

# Update root package.json
print_msg $BLUE "Updating root package.json..."
jq ".version = \"$VERSION\"" package.json > tmp.json && mv tmp.json package.json

# Update packages
print_msg $BLUE "Updating packages/core/package.json..."
jq ".version = \"$VERSION\"" packages/core/package.json > tmp.json && mv tmp.json packages/core/package.json

print_msg $BLUE "Updating packages/cli/package.json..."
jq ".version = \"$VERSION\"" packages/cli/package.json > tmp.json && mv tmp.json packages/cli/package.json

print_msg $BLUE "Updating packages/gui/package.json..."
jq ".version = \"$VERSION\"" packages/gui/package.json > tmp.json && mv tmp.json packages/gui/package.json

echo ""
print_msg $GREEN "✅ Updated all packages to version $VERSION"
echo ""
print_msg $YELLOW "Next steps:"
echo "  1. Update CHANGELOG.md with changes for v$VERSION"
echo "  2. git add ."
echo "  3. git commit -m \"chore: bump version to $VERSION\""
echo "  4. git tag v$VERSION"
echo "  5. git push origin main --tags"
echo ""
print_msg $BLUE "Or use the automated script:"
echo "  ./scripts/prepare-release.sh $VERSION"

