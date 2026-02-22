---
description: Commit
---

Create a git commit with proper commit message.

## Instructions

1. **Check git status** to see all changes:

   ```bash
   git status
   ```

2. **Review the diff** to understand what changed:

   ```bash
   git diff
   ```

3. **Stage files** appropriately:

   ```bash
   git add <files>
   ```

   - Only stage meaningful changes
   - Avoid staging unrelated files

4. **Write commit message** following conventional commits format:

   ```
   <type>(<scope>): <subject>

   <body>

   <footer>
   ```

   ### Type

   Use one of:
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation
   - `refactor`: Code refactoring
   - `test`: Testing
   - `chore`: Maintenance

   ### Scope

   Use meaningful scope:
   - `core`: Core library changes
   - `cli`: CLI tool changes
   - `gui`: GUI application changes
   - `adapter`: Adapter changes
   - `converter`: Converter module changes
   - `docs`: Documentation changes

   ### Subject
   - Use imperative mood: "add" not "added" or "adds"
   - No period at end
   - Max 50 characters
   - Start with lowercase

   ### Body
   - Explain **what** and **why**, not how
   - Wrap at 72 characters
   - Include specific methods/classes when relevant
   - List key changes with file/method names

5. **Create commit**:

   ```bash
   git commit -m "$(cat <<'EOF'
   <type>(<scope>): <subject>

   <body>

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

6. **Push to remote**:
   ```bash
   git push origin main
   ```

## Examples

### Feature commit

```
feat(core): add config backup and restore functionality

Implement backup/restore in ConfigManager:
- backup(): create timestamped JSON backups
- restore(): restore from backup ID
- listBackups(): enumerate available backups

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Refactor commit

```
refactor(adapter): simplify CursorAdapter parse method

- Extract rule parsing to separate method
- Add error handling for malformed configs
- Improve type safety with explicit interfaces

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Restrictions

- **Never** use phase numbers like "Phase 1", "Phase 2" in commit messages
- **Avoid** vague messages like "update", "fix", "change"
- **Avoid** generic scope like "project" or "misc"