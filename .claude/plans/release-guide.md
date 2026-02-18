# 🚀 Release Guide

This guide explains how to release new versions of **unify-ai**.

## Prerequisites

Before releasing, ensure you have:

1. **npm account** with publish permissions for `@unify-ai` packages
2. **GitHub repository** with admin access
3. **Required tools**:
   - `jq` (for JSON manipulation): `brew install jq` (macOS) or `apt install jq` (Linux)
   - `pnpm`: `npm install -g pnpm`

4. **Configured secrets** in GitHub repository:
   - `NPM_TOKEN`: npm access token for publishing
   - `GITHUB_TOKEN`: automatically provided by GitHub Actions

## Release Types

### 1. Patch Release (Bug Fixes)
- Version: `0.0.X` → `0.0.Y`
- For: Bug fixes, documentation updates, minor improvements
- Example: `0.0.1` → `0.0.2`

### 2. Minor Release (New Features)
- Version: `0.X.0` → `0.Y.0`
- For: New features, backward-compatible changes
- Example: `0.0.1` → `0.1.0`

### 3. Major Release (Breaking Changes)
- Version: `X.0.0` → `Y.0.0`
- For: Breaking changes, major rewrites
- Example: `0.1.0` → `1.0.0`

## Automated Release Process (Recommended)

### Step 1: Prepare Release

Run the automated preparation script:

```bash
./scripts/prepare-release.sh <version>
```

This script will:
- ✅ Check working directory is clean
- ✅ Pull latest changes
- ✅ Run all tests (core, CLI, GUI)
- ✅ Build all packages
- ✅ Update version numbers
- ✅ Generate CHANGELOG from git commits
- ✅ Create release commit

**Example:**
```bash
# Patch release
./scripts/prepare-release.sh 0.0.2

# Minor release
./scripts/prepare-release.sh 0.1.0

# Major release
./scripts/prepare-release.sh 1.0.0
```

### Step 2: Review Changes

Review the generated changes:

```bash
# View the commit
git show

# View CHANGELOG changes
git diff HEAD~1 CHANGELOG.md
```

### Step 3: Push and Tag

Push the changes and create a git tag:

```bash
# Push commit to GitHub
git push origin main

# Create tag
git tag v0.0.2

# Push tag to GitHub (triggers release)
git push origin v0.0.2
```

### Step 4: Monitor Release

GitHub Actions will automatically:

1. **Validate** the release tag and version
2. **Run tests** across all packages
3. **Publish** to npm:
   - `@unify-ai/core`
   - `@unify-ai/cli`
4. **Build GUI** for:
   - macOS (DMG)
   - Windows (EXE)
   - Linux (AppImage, DEB, RPM)
5. **Create GitHub Release** with:
   - Release notes from CHANGELOG.md
   - Downloadable GUI binaries

Monitor progress at:
```
https://github.com/YOUR_USERNAME/unify-ai/actions
```

## Manual Release Process

If you need more control, use manual release:

### Step 1: Update Version

```bash
./scripts/update-version.sh <version>
```

### Step 2: Update CHANGELOG

Manually edit `CHANGELOG.md` with changes for this version.

### Step 3: Test Locally

```bash
# Run tests
./scripts/test-release.sh
```

### Step 4: Commit and Tag

```bash
git add .
git commit -m "chore: release v<version>"
git tag v<version>
git push origin main --tags
```

## Pre-release Versions

For beta/alpha releases:

```bash
# Prepare pre-release
./scripts/prepare-release.sh 0.1.0-beta.1

# Push tag
git push origin main
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

Pre-release behavior:
- ✅ Tests run
- ✅ GUI builds
- ❌ **Not published to npm**
- ✅ GitHub Release marked as pre-release

## Rollback Procedure

If a release fails or has critical bugs:

### Automatic Rollback

If the GitHub Actions workflow fails, it will automatically:
- Deprecate npm packages
- Create a GitHub issue

### Manual Rollback

```bash
./scripts/rollback-release.sh <version>
```

This will:
- Deprecate npm packages
- Delete git tag (local and remote)
- Optionally revert version bump commit

**Example:**
```bash
./scripts/rollback-release.sh 0.0.2
```

## Release Checklist

### Before Release
- [ ] All tests pass locally
- [ ] CHANGELOG.md updated (or will be auto-generated)
- [ ] Version number decided (patch/minor/major)
- [ ] Working directory clean (no uncommitted changes)

### During Release
- [ ] Run `./scripts/prepare-release.sh <version>`
- [ ] Review generated changes
- [ ] Push commit to GitHub
- [ ] Create and push tag
- [ ] Monitor GitHub Actions workflow

### After Release
- [ ] Verify npm packages are published
- [ ] Download and test GUI binaries
- [ ] Verify GitHub Release is created
- [ ] Announce release (optional)

## Troubleshooting

### "Working directory has uncommitted changes"

**Solution:** Commit or stash your changes first:
```bash
git status
git add .
git commit -m "your changes"
```

### "Version already exists as git tag"

**Solution:** Choose a different version number or delete the tag:
```bash
git tag -d v0.0.2
git push origin :refs/tags/v0.0.2
```

### GitHub Actions Failed

**Check:**
1. GitHub Actions logs for error details
2. npm token is valid: `npm whoami`
3. Package.json version matches tag version

**Recovery:**
1. Fix the issue
2. Rollback if needed: `./scripts/rollback-release.sh <version>`
3. Prepare new release with patch version

### npm Publish Failed

**Check:**
1. npm token has publish permissions
2. Package name is not taken
3. Version doesn't already exist on npm

**Recovery:**
```bash
# Manual publish
cd packages/core
npm publish --access public

cd ../cli
npm publish --access public
```

## Version Bump Examples

### Patch Release (0.0.1 → 0.0.2)
```bash
# Fix a bug
git add .
git commit -m "fix: resolve sync issue"
./scripts/prepare-release.sh 0.0.2
git push origin main
git tag v0.0.2
git push origin v0.0.2
```

### Minor Release (0.0.1 → 0.1.0)
```bash
# Add new feature
git add .
git commit -m "feat: add cloud sync support"
./scripts/prepare-release.sh 0.1.0
git push origin main
git tag v0.1.0
git push origin v0.1.0
```

### Major Release (0.1.0 → 1.0.0)
```bash
# Breaking changes
git add .
git commit -m "feat!: redesign API with breaking changes"
./scripts/prepare-release.sh 1.0.0
git push origin main
git tag v1.0.0
git push origin v1.0.0
```

## CI/CD Workflows

### Continuous Integration (`.github/workflows/ci.yml`)
- **Triggers:** Push to main/develop, PRs
- **Actions:** Test, lint, build
- **Status:** ![CI Status](https://github.com/YOUR_USERNAME/unify-ai/workflows/CI/badge.svg)

### Release (`.github/workflows/release.yml`)
- **Triggers:** Push tag `v*.*.*`
- **Actions:** Validate, test, publish npm, build GUI, create GitHub release
- **Status:** ![Release Status](https://github.com/YOUR_USERNAME/unify-ai/workflows/Release/badge.svg)

## Additional Resources

- [CHANGELOG.md](/CHANGELOG.md) - Version history
- [CONTRIBUTING.md](/CONTRIBUTING.md) - Contribution guide
- [GitHub Actions](https://github.com/YOUR_USERNAME/unify-ai/actions) - CI/CD workflows

## Questions?

If you encounter any issues during the release process:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review GitHub Actions logs
3. Create an issue on GitHub
