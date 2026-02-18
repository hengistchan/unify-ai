# GitHub Actions Setup Guide

This guide explains how to set up GitHub Actions for automated releases.

## Required Secrets

### 1. NPM_TOKEN

**Purpose:** Publish packages to npm

**How to get it:**

1. Log in to [npmjs.com](https://www.npmjs.com/)
2. Go to your profile → Access Tokens
3. Click "Generate New Token" → "Classic Token"
4. Select "Automation" type
5. Copy the token

**Add to GitHub:**

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click "Add secret"

### 2. GITHUB_TOKEN

**Purpose:** Create releases, upload assets

**Note:** This token is automatically provided by GitHub Actions. No configuration needed!

### 3. CODECOV_TOKEN (Optional)

**Purpose:** Upload test coverage reports

**How to get it:**

1. Sign up at [codecov.io](https://about.codecov.io/)
2. Add your repository
3. Copy the upload token

**Add to GitHub:**

Follow the same steps as NPM_TOKEN, name it `CODECOV_TOKEN`.

## Verify Setup

After adding secrets, verify the setup:

### 1. Test CI Workflow

Make a small change and push to main:

```bash
git commit --allow-empty -m "test: trigger CI"
git push origin main
```

Check the Actions tab in GitHub. You should see the CI workflow running.

### 2. Test Release Workflow

Create a test release:

```bash
./scripts/prepare-release.sh 0.0.2-beta.1
git push origin main
git tag v0.0.2-beta.1
git push origin v0.0.2-beta.1
```

This will:

- Run tests ✅
- Build GUI ✅
- **NOT publish to npm** (pre-release)
- Create pre-release on GitHub ✅

## Workflow Permissions

### CI Workflow (`ci.yml`)

Required permissions:

- `contents: read` - Checkout repository
- `pull-requests: write` - Comment on PRs (optional)

### Release Workflow (`release.yml`)

Required permissions:

- `contents: write` - Create releases, push tags
- `packages: write` - Publish to GitHub Packages (optional)

These permissions are configured in the workflow files.

## Troubleshooting

### "npm ERR! need auth"

**Cause:** NPM_TOKEN not configured or invalid

**Solution:**

1. Verify NPM_TOKEN is set in GitHub Secrets
2. Verify token has "Automation" permissions
3. Verify token is for the correct npm account

### "Permission denied (publickey)"

**Cause:** SSH key not configured

**Solution:** GitHub Actions uses HTTPS by default, this shouldn't happen. Check workflow file.

### "Resource not accessible by integration"

**Cause:** Insufficient permissions

**Solution:**

1. Go to Settings → Actions → General
2. Scroll to "Workflow permissions"
3. Select "Read and write permissions"
4. Save

### Coverage upload fails

**Cause:** CODECOV_TOKEN not configured

**Solution:**

- Either add CODECOV_TOKEN secret
- Or remove codecov step from workflow (coverage still runs, just not uploaded)

## Security Best Practices

### Token Permissions

- ✅ Use "Automation" tokens for npm
- ✅ Use minimal required permissions
- ✅ Rotate tokens regularly
- ❌ Don't use personal access tokens
- ❌ Don't commit tokens to repository

### Branch Protection

Recommended settings for `main` branch:

1. Go to Settings → Branches
2. Add rule for `main`:
   - ✅ Require pull request reviews
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - ✅ Include administrators

Required status checks:

- `test` (from CI workflow)
- `lint` (from CI workflow)

## Monitoring

### Workflow Notifications

Set up notifications for workflow failures:

1. Go to Settings → Notifications
2. Configure email/Slack notifications for:
   - Failed workflows
   - Successful releases

### Monitoring Dashboard

Use GitHub's insights:

- Actions → Usage: Monitor workflow runs
- Actions → Caching: Monitor cache usage
- Insights → Pulse: Overview of activity

## Cost Management

### GitHub Actions Minutes

Free tier includes:

- 2,000 minutes/month (free)
- 3,000 minutes/month (Team)
- 50,000 minutes/month (Enterprise)

**Tips to reduce usage:**

- Use caching for pnpm
- Only run tests on relevant changes
- Use matrix builds selectively

### npm Bandwidth

Free tier includes:

- Unlimited bandwidth for public packages

## Next Steps

After setting up secrets:

1. ✅ Verify CI workflow works
2. ✅ Test pre-release workflow
3. ✅ Review [Release Guide](/.claude/plans/release-guide.md)
4. ✅ Configure branch protection
5. ✅ Set up notifications

## Support

For issues:

1. Check GitHub Actions logs
2. Review this guide
3. Check GitHub Actions documentation
4. Create an issue in the repository
