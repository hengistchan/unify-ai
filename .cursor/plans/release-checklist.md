# Release Checklist

Use this checklist for every release.

## Pre-Release

### Code Quality
- [ ] All tests passing (core, cli, gui)
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Code reviewed

### Documentation
- [ ] README.md updated
- [ ] CHANGELOG.md updated with release notes
- [ ] CLAUDE.md updated if architecture changed
- [ ] Inline code comments clear

### Version Management
- [ ] Version updated in root package.json
- [ ] Version updated in packages/core/package.json
- [ ] Version updated in packages/cli/package.json
- [ ] Version updated in packages/gui/package.json
- [ ] Git tag created

## Testing

### Automated Tests
- [ ] Core tests: `pnpm test` (185 tests)
- [ ] CLI tests: `pnpm test -w @unify-ai/cli` (47 tests)
- [ ] GUI tests: `pnpm test -w @unify-ai/gui` (85 tests)
- [ ] Total: 317 tests passing

### Manual Testing

#### CLI
- [ ] Global install: `pnpm link --global`
- [ ] Help command: `unify-ai --help`
- [ ] Init command: `unify-ai init /tmp/test`
- [ ] Detect command: `unify-ai detect /tmp/test`
- [ ] Import command: `unify-ai import cursor /tmp/test`
- [ ] Export command: `unify-ai export cursor /tmp/test`
- [ ] Status command: `unify-ai status /tmp/test`
- [ ] Uninstall: `pnpm unlink --global @unify-ai/cli`

#### GUI
- [ ] Dev mode: `pnpm gui`
- [ ] Window opens correctly
- [ ] Can select project folder
- [ ] Can detect tools
- [ ] Can view sync preview
- [ ] Can perform sync

#### Core
- [ ] Import from real tool configs
- [ ] Export to real tool configs
- [ ] Diff detection works
- [ ] Conflict resolution works

## Build

### Core
- [ ] Build: `pnpm build`
- [ ] No build errors
- [ ] Output in packages/core/dist/

### CLI
- [ ] Build: `cd packages/cli && pnpm build`
- [ ] Binary created: packages/cli/bin/unify-ai.js
- [ ] Binary executable

### GUI
- [ ] Build: `cd packages/gui && pnpm build`
- [ ] No build errors
- [ ] Electron build: `pnpm electron:build`
- [ ] macOS dmg created
- [ ] Windows exe created (if building on Windows)
- [ ] Linux AppImage created (if building on Linux)

## NPM Publishing

### Core Package
- [ ] Login: `npm login`
- [ ] Publish: `cd packages/core && pnpm publish --access public`
- [ ] Verify: https://www.npmjs.com/package/@unify-ai/core
- [ ] Install test: `npm install -g @unify-ai/core`

### CLI Package
- [ ] Publish: `cd packages/cli && pnpm publish --access public`
- [ ] Verify: https://www.npmjs.com/package/@unify-ai/cli
- [ ] Install test: `npm install -g @unify-ai/cli`
- [ ] Run test: `unify-ai --version`

## Git & GitHub

### Git Operations
- [ ] Commit version update: `git commit -m "chore: release vX.Y.Z"`
- [ ] Create tag: `git tag vX.Y.Z`
- [ ] Push commit: `git push origin main`
- [ ] Push tag: `git push origin vX.Y.Z`

### GitHub Release
- [ ] Go to: https://github.com/yourusername/unify-ai/releases/new
- [ ] Select tag: vX.Y.Z
- [ ] Release title: `vX.Y.Z`
- [ ] Copy release notes from CHANGELOG.md
- [ ] Upload binaries:
  - [ ] macOS: `unify-ai-X.Y.Z.dmg`
  - [ ] Windows: `unify-ai-X.Y.Z.exe`
  - [ ] Linux: `unify-ai-X.Y.Z.AppImage`
- [ ] Publish release

## Post-Release

### Verification
- [ ] npm packages accessible
- [ ] GitHub release visible
- [ ] Download links work
- [ ] Install from npm works
- [ ] GUI downloads work

### Communication
- [ ] Tweet announcement
- [ ] Reddit post (r/javascript, r/typescript, r/programming)
- [ ] Hacker News submission
- [ ] Discord/Slack communities
- [ ] Update website (if applicable)

### Monitoring
- [ ] Watch GitHub issues for bug reports
- [ ] Monitor npm download stats
- [ ] Check social media mentions
- [ ] Respond to user questions

## Rollback Plan

If critical issues found:

1. Deprecate npm packages:
   ```bash
   npm deprecate @unify-ai/core@X.Y.Z "Critical bug, please upgrade to X.Y.Z+1"
   npm deprecate @unify-ai/cli@X.Y.Z "Critical bug, please upgrade to X.Y.Z+1"
   ```

2. Delete GitHub release

3. Delete git tag:
   ```bash
   git tag -d vX.Y.Z
   git push origin :refs/tags/vX.Y.Z
   ```

4. Create hotfix branch:
   ```bash
   git checkout -b hotfix/X.Y.Z+1
   ```

5. Fix issues, test, and release X.Y.Z+1

## Notes

- Always test on clean machine/environment
- Keep backup of previous version
- Document any manual steps required
- Update this checklist with lessons learned
