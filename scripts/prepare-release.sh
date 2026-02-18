#!/bin/bash
# prepare-release.sh - Prepare a new release with automatic CHANGELOG generation

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VERSION=$1
RELEASE_TYPE=$2

# Print colored message
print_msg() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Check if version is provided
if [ -z "$VERSION" ]; then
    print_msg $RED "❌ Error: Version not specified"
    echo ""
    echo "Usage: ./scripts/prepare-release.sh <version> [type]"
    echo ""
    echo "Arguments:"
    echo "  version    Version number (e.g., 0.0.2, 0.1.0, 1.0.0)"
    echo "  type       Release type: major, minor, patch (default: auto-detect)"
    echo ""
    echo "Examples:"
    echo "  ./scripts/prepare-release.sh 0.0.2"
    echo "  ./scripts/prepare-release.sh 0.1.0 minor"
    echo "  ./scripts/prepare-release.sh 1.0.0 major"
    exit 1
fi

# Validate version format
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
    print_msg $RED "❌ Invalid version format: $VERSION"
    echo "Expected format: X.Y.Z or X.Y.Z-prerelease"
    exit 1
fi

print_msg $BLUE "🚀 Preparing release v$VERSION"
echo ""

# Step 1: Check working directory
print_msg $BLUE "📋 Step 1: Checking working directory..."
if ! git diff-index --quiet HEAD --; then
    print_msg $RED "❌ Error: Working directory has uncommitted changes"
    echo ""
    echo "Please commit or stash your changes first:"
    echo "  git status"
    echo "  git add ."
    echo "  git commit -m 'your message'"
    exit 1
fi
print_msg $GREEN "✅ Working directory is clean"
echo ""

# Step 2: Check if we're on main branch
print_msg $BLUE "📋 Step 2: Checking current branch..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_msg $YELLOW "⚠️  Warning: Not on main branch (current: $CURRENT_BRANCH)"
    echo "Releases should typically be created from main branch."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
print_msg $GREEN "✅ Branch check passed"
echo ""

# Step 3: Pull latest changes
print_msg $BLUE "📋 Step 3: Pulling latest changes..."
git pull origin $CURRENT_BRANCH
print_msg $GREEN "✅ Latest changes pulled"
echo ""

# Step 4: Run tests
print_msg $BLUE "📋 Step 4: Running tests..."
echo "  Core tests..."
pnpm test:core

echo "  CLI tests..."
pnpm test:cli

echo "  GUI tests..."
pnpm test:gui

print_msg $GREEN "✅ All tests passed"
echo ""

# Step 5: Build packages
print_msg $BLUE "📋 Step 5: Building packages..."
pnpm build
print_msg $GREEN "✅ Build complete"
echo ""

# Step 6: Update version numbers
print_msg $BLUE "📋 Step 6: Updating version to $VERSION..."
./scripts/update-version.sh $VERSION
print_msg $GREEN "✅ Version updated"
echo ""

# Step 7: Update CHANGELOG
print_msg $BLUE "📋 Step 7: Updating CHANGELOG..."

# Extract previous version
PREV_VERSION=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/v//')
if [ -z "$PREV_VERSION" ]; then
    PREV_VERSION="0.0.0"
fi

print_msg $YELLOW "Previous version: $PREV_VERSION"
print_msg $YELLOW "New version: $VERSION"

# Generate changelog from git commits
CHANGELOG_ENTRY="## [$VERSION] - $(date +%Y-%m-%d)\n\n"

# Get commits since last tag
if [ "$PREV_VERSION" != "0.0.0" ]; then
    COMMITS=$(git log v$PREV_VERSION..HEAD --pretty=format:"- %s" --no-merges)
else
    COMMITS=$(git log --pretty=format:"- %s" --no-merges | head -20)
fi

if [ -n "$COMMITS" ]; then
    # Categorize commits
    FEATURES=$(echo "$COMMITS" | grep -i "feat" || true)
    FIXES=$(echo "$COMMITS" | grep -i "fix" || true)
    DOCS=$(echo "$COMMITS" | grep -i "docs\|doc" || true)
    REFACTOR=$(echo "$COMMITS" | grep -i "refactor" || true)
    CHORE=$(echo "$COMMITS" | grep -i "chore" || true)
    OTHER=$(echo "$COMMITS" | grep -vi "feat\|fix\|docs\|doc\|refactor\|chore" || true)

    if [ -n "$FEATURES" ]; then
        CHANGELOG_ENTRY+="### Features\n$FEATURES\n\n"
    fi

    if [ -n "$FIXES" ]; then
        CHANGELOG_ENTRY+="### Bug Fixes\n$FIXES\n\n"
    fi

    if [ -n "$DOCS" ]; then
        CHANGELOG_ENTRY+="### Documentation\n$DOCS\n\n"
    fi

    if [ -n "$REFACTOR" ]; then
        CHANGELOG_ENTRY+="### Code Refactoring\n$REFACTOR\n\n"
    fi

    if [ -n "$CHORE" ]; then
        CHANGELOG_ENTRY+="### Maintenance\n$CHORE\n\n"
    fi

    if [ -n "$OTHER" ]; then
        CHANGELOG_ENTRY+="### Other Changes\n$OTHER\n\n"
    fi
else
    CHANGELOG_ENTRY+="### Changes\n- Version bump to $VERSION\n\n"
fi

# Prepend to CHANGELOG.md
if [ -f CHANGELOG.md ]; then
    # Find the line number of the first version header
    INSERT_LINE=$(grep -n "^## \[" CHANGELOG.md | head -1 | cut -d: -f1)
    if [ -n "$INSERT_LINE" ]; then
        # Insert new entry before the first version header
        echo -e "$CHANGELOG_ENTRY" | cat - CHANGELOG.md > temp.md
        mv temp.md CHANGELOG.md
    else
        # If no version header found, just prepend
        echo -e "$CHANGELOG_ENTRY" | cat - CHANGELOG.md > temp.md
        mv temp.md CHANGELOG.md
    fi
else
    echo -e "# Changelog\n\n$CHANGELOG_ENTRY" > CHANGELOG.md
fi

print_msg $GREEN "✅ CHANGELOG updated"
echo ""

# Step 8: Show diff
print_msg $BLUE "📋 Step 8: Changes summary..."
echo ""
git diff --stat
echo ""

# Step 9: Ask for confirmation
print_msg $YELLOW "⚠️  Ready to commit release v$VERSION"
echo ""
echo "Changes made:"
echo "  - Updated version numbers in all package.json files"
echo "  - Updated CHANGELOG.md"
echo ""
echo "Next steps after commit:"
echo "  1. Push to GitHub: git push origin $CURRENT_BRANCH"
echo "  2. Create and push tag: git tag v$VERSION && git push origin v$VERSION"
echo "  3. GitHub Actions will automatically:"
echo "     - Run tests"
echo "     - Publish to npm"
echo "     - Build GUI applications"
echo "     - Create GitHub Release"
echo ""
read -p "Commit changes? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_msg $YELLOW "⚠️  Release preparation cancelled"
    echo ""
    echo "To rollback changes:"
    echo "  git checkout ."
    exit 0
fi

# Step 10: Commit changes
print_msg $BLUE "📋 Step 10: Committing changes..."
git add package.json packages/*/package.json CHANGELOG.md
git commit -m "chore: prepare release v$VERSION

- Update version to $VERSION
- Update CHANGELOG.md"
print_msg $GREEN "✅ Changes committed"
echo ""

print_msg $GREEN "✅ Release v$VERSION prepared successfully!"
echo ""
print_msg $YELLOW "Next steps:"
echo "  1. Review the changes: git show"
echo "  2. Push to GitHub: git push origin $CURRENT_BRANCH"
echo "  3. Create and push tag:"
echo "     git tag v$VERSION"
echo "     git push origin v$VERSION"
echo ""
print_msg $BLUE "GitHub Actions will automatically:"
echo "  ✓ Run all tests"
echo "  ✓ Publish @unify-ai/core to npm"
echo "  ✓ Publish @unify-ai/cli to npm"
echo "  ✓ Build GUI for macOS, Windows, Linux"
echo "  ✓ Create GitHub Release with binaries"
echo ""
