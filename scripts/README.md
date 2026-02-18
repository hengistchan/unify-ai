# Release Scripts

This directory contains automated scripts for managing releases.

## Scripts Overview

### `prepare-release.sh` (Recommended)
**Fully automated release preparation**

This is the main script for preparing a new release. It handles everything from testing to version bumping to CHANGELOG generation.

**Usage:**
```bash
./scripts/prepare-release.sh <version> [type]
```

**What it does:**
1. ✅ Checks working directory is clean
2. ✅ Verifies current branch (warns if not on main)
3. ✅ Pulls latest changes
4. ✅ Runs all tests (core, CLI, GUI)
5. ✅ Builds all packages
6. ✅ Updates version numbers
7. ✅ Auto-generates CHANGELOG from git commits
8. ✅ Commits changes
9. ✅ Provides next steps

**Example:**
```bash
./scripts/prepare-release.sh 0.0.2
```

---

### `update-version.sh`
**Update version numbers only**

Updates version numbers in all package.json files. Used by `prepare-release.sh` internally.

**Usage:**
```bash
./scripts/update-version.sh <version>
```

**What it does:**
1. ✅ Validates version format
2. ✅ Checks for existing git tags
3. ✅ Updates root package.json
4. ✅ Updates packages/*/package.json

**Example:**
```bash
./scripts/update-version.sh 0.0.2
```

---

### `test-release.sh`
**Test the release process**

Runs a dry-run of the release process without actually publishing. Good for verifying everything works before a real release.

**Usage:**
```bash
./scripts/test-release.sh
```

**What it does:**
1. ✅ Runs all tests
2. ✅ Builds all packages
3. ✅ Tests CLI global installation
4. ✅ Tests CLI commands
5. ✅ Tests GUI build

---

### `release.sh`
**Manual release script**

Manually triggers the release process. **Not recommended** - use GitHub Actions instead by pushing a tag.

**Usage:**
```bash
./scripts/release.sh <version>
```

**What it does:**
1. ✅ Runs tests
2. ✅ Builds packages
3. ✅ Updates version
4. ✅ Publishes to npm
5. ✅ Builds GUI
6. ✅ Pushes to GitHub

**Example:**
```bash
./scripts/release.sh 0.0.2
```

⚠️ **Note:** Prefer using GitHub Actions for automated releases. See [Release Guide](/.claude/plans/release-guide.md).

---

### `rollback-release.sh`
**Rollback a failed release**

Deprecates npm packages and deletes git tags for a failed release.

**Usage:**
```bash
./scripts/rollback-release.sh <version>
```

**What it does:**
1. ✅ Deprecates npm packages
2. ✅ Deletes local and remote git tags
3. ✅ Optionally reverts version bump commit

**Example:**
```bash
./scripts/rollback-release.sh 0.0.2
```

---

## Typical Release Workflow

### Option 1: Automated (Recommended)

```bash
# 1. Prepare release (automated)
./scripts/prepare-release.sh 0.0.2

# 2. Review changes
git show

# 3. Push to GitHub
git push origin main

# 4. Create and push tag (triggers GitHub Actions)
git tag v0.0.2
git push origin v0.0.2

# 5. Monitor GitHub Actions
# https://github.com/YOUR_USERNAME/unify-ai/actions
```

### Option 2: Manual

```bash
# 1. Test locally
./scripts/test-release.sh

# 2. Update version
./scripts/update-version.sh 0.0.2

# 3. Update CHANGELOG manually
# Edit CHANGELOG.md

# 4. Commit and tag
git add .
git commit -m "chore: release v0.0.2"
git tag v0.0.2
git push origin main --tags

# 5. Manual release (if needed)
./scripts/release.sh 0.0.2
```

### Option 3: Rollback

```bash
# If something goes wrong
./scripts/rollback-release.sh 0.0.2
```

---

## Prerequisites

Before using these scripts, ensure you have:

1. **jq** installed (for JSON manipulation):
   ```bash
   # macOS
   brew install jq

   # Linux (Debian/Ubuntu)
   sudo apt install jq

   # Linux (RHEL/CentOS)
   sudo yum install jq
   ```

2. **pnpm** installed:
   ```bash
   npm install -g pnpm
   ```

3. **npm account** with publish permissions for `@unify-ai` packages

4. **GitHub repository** admin access

---

## Additional Resources

- [Release Guide](/.claude/plans/release-guide.md) - Complete release documentation
- [CHANGELOG.md](/CHANGELOG.md) - Version history
- [GitHub Actions](/.github/workflows/) - CI/CD workflows

---

## Troubleshooting

### "jq is required but not installed"

Install jq:
```bash
brew install jq  # macOS
```

### "Working directory has uncommitted changes"

Commit your changes first:
```bash
git add .
git commit -m "your changes"
```

### "Version already exists as git tag"

Choose a different version or delete the tag:
```bash
git tag -d v0.0.2
git push origin :refs/tags/v0.0.2
```

---

## Support

For issues or questions:
1. Check the [Release Guide](/.claude/plans/release-guide.md)
2. Review GitHub Actions logs
3. Create an issue on GitHub
