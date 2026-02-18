#!/bin/bash
# rollback-release.sh - Rollback a failed release

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
    print_msg $RED "Usage: ./scripts/rollback-release.sh <version>"
    echo "Example: ./scripts/rollback-release.sh 0.0.2"
    exit 1
fi

# Remove 'v' prefix if present
VERSION=${VERSION#v}

print_msg $RED "⚠️  Rolling back release v$VERSION"
echo ""

# Ask for confirmation
read -p "This will deprecate npm packages and delete git tag. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_msg $YELLOW "Rollback cancelled"
    exit 0
fi

# Step 1: Deprecate npm packages
print_msg $BLUE "📋 Step 1: Deprecating npm packages..."

echo "  Deprecating @unify-ai/core@$VERSION..."
npm deprecate @unify-ai/core@$VERSION "Release rolled back, please use latest stable version" || true

echo "  Deprecating @unify-ai/cli@$VERSION..."
npm deprecate @unify-ai/cli@$VERSION "Release rolled back, please use latest stable version" || true

print_msg $GREEN "✅ npm packages deprecated"
echo ""

# Step 2: Delete git tag
print_msg $BLUE "📋 Step 2: Deleting git tag..."

if git tag | grep -q "^v$VERSION$"; then
    echo "  Deleting local tag..."
    git tag -d v$VERSION || true

    echo "  Deleting remote tag..."
    git push origin :refs/tags/v$VERSION || true

    print_msg $GREEN "✅ Git tag deleted"
else
    print_msg $YELLOW "⚠️  Tag v$VERSION not found locally"
fi

echo ""

# Step 3: Revert commit (optional)
print_msg $BLUE "📋 Step 3: Revert commit (optional)..."
echo ""
read -p "Revert the version bump commit? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Find the commit that bumped the version
    COMMIT_HASH=$(git log --oneline --grep="prepare release v$VERSION" -n 1 | cut -d' ' -f1)

    if [ -n "$COMMIT_HASH" ]; then
        echo "  Reverting commit $COMMIT_HASH..."
        git revert $COMMIT_HASH --no-edit || true
        print_msg $GREEN "✅ Commit reverted"
    else
        print_msg $YELLOW "⚠️  Could not find version bump commit"
    fi
else
    print_msg $YELLOW "Skipping commit revert"
fi

echo ""
print_msg $GREEN "✅ Rollback complete for v$VERSION"
echo ""
print_msg $YELLOW "Next steps:"
echo "  1. Fix the issues that caused the release to fail"
echo "  2. Test thoroughly"
echo "  3. Prepare a new release with a patch version bump"
echo ""
echo "Example:"
echo "  ./scripts/prepare-release.sh $VERSION"
