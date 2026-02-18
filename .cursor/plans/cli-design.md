# @unify-ai/cli 设计文档

## 概述

`@unify-ai/cli` 是 unify-ai 项目的命令行工具，基于 `@unify-ai/core` 提供的能力，为开发者提供友好的配置管理体验。

## 设计原则

1. **直观易用**: 命令语义清晰，参数命名一致
2. **渐进式引导**: 新手可通过交互式模式完成操作，高级用户可直接使用命令参数
3. **丰富的反馈**: 清晰的状态提示、进度显示和错误信息
4. **灵活的输出**: 支持表格、JSON、静默等多种输出格式
5. **安全可靠**: 默认备份，支持 dry-run 预览

---

## 1. 全局配置

### 1.1 配置文件

支持以下配置文件格式（按优先级排序）：

1. `.unifyrc`
2. `.unifyrc.json`
3. `.unifyrc.yaml` / `.unifyrc.yml`
4. `unify.config.json`
5. `package.json` 中的 `unify` 字段

### 1.2 配置文件结构

```json
{
  "$schema": "https://unify-ai.dev/schemas/config.json",
  "version": "1.0",

  "源配置": {
    "configPath": "./unified.json",
    "schemaPath": "./schemas/unified.schema.json"
  },

  "目标工具": {
    "targets": ["claude-code", "cursor", "windsurf"],
    "defaultTarget": "claude-code"
  },

  "同步设置": {
    "sync": {
      "mode": "two-way-interactive",
      "autoSync": false,
      "watchDebounce": 1000,
      "conflictStrategy": "ask"
    }
  },

  "导入导出": {
    "import": {
      "mergeMultiple": true,
      "strict": false
    },
    "export": {
      "backup": true,
      "backupDir": "./.unify/backup",
      "overwrite": true
    }
  },

  "钩子": {
    "hooks": {
      "preInit": "./scripts/pre-init.sh",
      "postInit": "./scripts/post-init.sh",
      "preSync": "./scripts/pre-sync.sh",
      "postSync": "./scripts/post-sync.sh",
      "preImport": "./scripts/pre-import.sh",
      "postImport": "./scripts/post-import.sh",
      "preExport": "./scripts/pre-export.sh",
      "postExport": "./scripts/post-export.sh",
      "onConflict": "./scripts/handle-conflict.js",
      "onError": "./scripts/handle-error.js"
    }
  },

  "输出设置": {
    "output": {
      "format": "table",
      "color": true,
      "verbose": false,
      "quiet": false
    }
  },

  "忽略规则": {
    "ignore": {
      "patterns": ["**/node_modules/**", "**/.git/**"],
      "tools": []
    }
  }
}
```

### 1.3 TypeScript 类型定义

```typescript
interface UnifyCliConfig {
  // 配置版本
  version?: string;

  // 源配置
  configPath?: string;
  schemaPath?: string;

  // 目标工具
  targets?: ToolId[];
  defaultTarget?: ToolId;

  // 同步设置
  sync?: {
    mode?: SyncMode;
    autoSync?: boolean;
    watchDebounce?: number;
    conflictStrategy?: ConflictStrategy;
  };

  // 导入设置
  import?: {
    mergeMultiple?: boolean;
    strict?: boolean;
    includeCapabilities?: ConfigCapability[];
    excludeCapabilities?: ConfigCapability[];
  };

  // 导出设置
  export?: {
    backup?: boolean;
    backupDir?: string;
    overwrite?: boolean;
    dryRun?: boolean;
  };

  // 钩子
  hooks?: {
    preInit?: string | HookFunction;
    postInit?: string | HookFunction;
    preSync?: string | HookFunction;
    postSync?: string | HookFunction;
    preImport?: string | HookFunction;
    postImport?: string | HookFunction;
    preExport?: string | HookFunction;
    postExport?: string | HookFunction;
    onConflict?: string | HookFunction;
    onError?: string | HookFunction;
  };

  // 输出设置
  output?: {
    format?: OutputFormat;
    color?: boolean;
    verbose?: boolean;
    quiet?: boolean;
  };

  // 忽略规则
  ignore?: {
    patterns?: string[];
    tools?: ToolId[];
  };
}

type HookFunction = (context: HookContext) => Promise<void> | void;

interface HookContext {
  command: string;
  options: Record<string, unknown>;
  config?: UnifiedConfig;
  result?: unknown;
  error?: Error;
}

type OutputFormat = 'table' | 'json' | 'yaml' | 'silent';
type SyncMode = 'one-way-export' | 'one-way-import' | 'two-way-auto' | 'two-way-interactive';
type ConflictStrategy = 'unified-wins' | 'tool-wins' | 'latest' | 'merge' | 'ask';
```

---

## 2. 全局选项

### 2.1 选项定义

```
unify [command] [options]

全局选项:
  -c, --config <path>      指定配置文件路径
  -t, --target <tools...>  指定目标工具 (逗号分隔)
  -f, --format <format>    输出格式: table, json, yaml, silent (默认: table)
  --no-color               禁用彩色输出
  -v, --verbose            显示详细输出
  -q, --quiet              静默模式，只输出错误
  -d, --dry-run            预览模式，不实际执行
  --no-backup              禁用自动备份
  --version                显示版本号
  -h, --help               显示帮助信息
```

### 2.2 环境变量

| 环境变量            | 说明         | 默认值           |
| ------------------- | ------------ | ---------------- |
| `UNIFY_CONFIG_PATH` | 配置文件路径 | `./unified.json` |
| `UNIFY_FORMAT`      | 输出格式     | `table`          |
| `UNIFY_NO_COLOR`    | 禁用颜色     | `false`          |
| `UNIFY_VERBOSE`     | 详细模式     | `false`          |
| `UNIFY_QUIET`       | 静默模式     | `false`          |
| `UNIFY_DEBUG`       | 调试模式     | `false`          |

---

## 3. 命令详解

### 3.1 init - 初始化配置

创建新的统一配置文件。

#### 命令格式

```bash
unify init [options]
```

#### 选项

| 选项                | 别名 | 类型    | 默认值  | 说明                   |
| ------------------- | ---- | ------- | ------- | ---------------------- |
| `--from <tool>`     | `-f` | string  | -       | 从指定工具导入初始配置 |
| `--interactive`     | `-i` | boolean | false   | 交互式引导模式         |
| `--template <name>` | `-t` | string  | default | 使用模板创建           |
| `--force`           |      | boolean | false   | 强制覆盖现有配置       |
| `--skip-hooks`      |      | boolean | false   | 跳过钩子执行           |

#### 交互式流程

```
$ unify init -i

? Where do you want to create the config? (./unified.json)
? Which AI tools are you using? (Press space to select)
  ◉ Claude Code
  ◉ Cursor
  ◯ GitHub Copilot
  ◯ Windsurf
  ◯ Cline
  ◯ Aider

? Do you want to import existing configurations? (Y/n)

Detecting existing configurations...
  Found: .claude/settings.json (Claude Code)
  Found: .cursorrules (Cursor)

? Select configurations to import: (Press space to select)
  ◉ .claude/settings.json
  ◉ .cursorrules
  ◯ .github/copilot-instructions.md

? How do you want to handle conflicts? (Use arrow keys)
  ❯ Ask me for each conflict
    Prefer unified config
    Prefer tool config
    Merge when possible

? Configure MCP servers? (y/N)

Creating unified.json...
  ✓ Imported 3 rules from Claude Code
  ✓ Imported 2 rules from Cursor
  ✓ Merged MCP servers (5 total)

  Created: unified.json
  Created: .unifyrc

Next steps:
  1. Review unified.json
  2. Run 'unify sync' to synchronize
  3. Run 'unify status' to check status
```

#### 示例

```bash
# 交互式创建
unify init -i

# 从 Claude Code 配置导入
unify init --from claude-code

# 从 Cursor 配置导入并强制覆盖
unify init --from cursor --force

# 使用最小化模板
unify init --template minimal

# 使用完整模板
unify init --template full

# 在指定路径创建
unify init --config ./configs/ai/unified.json
```

#### 输出格式

**表格格式 (默认)**

```
  Initializing unified configuration...

  Source       Rules    MCP Servers    Settings
  ─────────────────────────────────────────────
  Claude Code  3        2              Yes
  Cursor       2        -              -

  Created Files:
    ✓ unified.json (1.2 KB)
    ✓ .unifyrc (0.5 KB)

  Total: 5 rules, 2 MCP servers
```

**JSON 格式**

```json
{
  "success": true,
  "files": [
    { "path": "unified.json", "size": 1234, "created": true },
    { "path": ".unifyrc", "size": 512, "created": true }
  ],
  "stats": {
    "rules": 5,
    "mcpServers": 2,
    "settings": true
  },
  "sources": ["claude-code", "cursor"]
}
```

#### 错误处理

| 错误码              | 说明               | 解决方案            |
| ------------------- | ------------------ | ------------------- |
| `CONFIG_EXISTS`     | 配置文件已存在     | 使用 `--force` 覆盖 |
| `TOOL_NOT_FOUND`    | 指定的工具未检测到 | 检查工具是否已安装  |
| `PARSE_ERROR`       | 配置解析失败       | 检查配置文件格式    |
| `PERMISSION_DENIED` | 无写入权限         | 检查文件/目录权限   |

---

### 3.2 sync - 同步配置

在统一配置和工具配置之间双向同步。

#### 命令格式

```bash
unify sync [options]
unify sync <tools...> [options]
```

#### 选项

| 选项                    | 别名 | 类型    | 默认值              | 说明                           |
| ----------------------- | ---- | ------- | ------------------- | ------------------------------ |
| `--mode <mode>`         | `-m` | string  | two-way-interactive | 同步模式                       |
| `--direction <dir>`     |      | string  | -                   | 同步方向: export, import, both |
| `--strategy <strategy>` | `-s` | string  | -                   | 冲突解决策略                   |
| `--watch`               | `-w` | boolean | false               | 监听模式                       |
| `--debounce <ms>`       |      | number  | 1000                | 防抖延迟 (watch 模式)          |
| `--backup`              | `-b` | boolean | true                | 创建备份                       |
| `--skip-hooks`          |      | boolean | false               | 跳过钩子执行                   |

#### 同步模式

| 模式                  | 说明                               |
| --------------------- | ---------------------------------- |
| `one-way-export`      | 单向导出: unified -> 工具配置      |
| `one-way-import`      | 单向导入: 工具配置 -> unified      |
| `two-way-auto`        | 双向自动: 自动合并，冲突时保留两者 |
| `two-way-interactive` | 双向交互: 冲突时询问用户 (默认)    |

#### 冲突解决策略

| 策略           | 说明            |
| -------------- | --------------- |
| `unified-wins` | 统一配置优先    |
| `tool-wins`    | 工具配置优先    |
| `latest`       | 最新修改优先    |
| `merge`        | 尝试合并        |
| `ask`          | 询问用户 (默认) |

#### 交互式流程

```
$ unify sync

Scanning configurations...
  ✓ unified.json (v1.0, modified 2 hours ago)
  ✓ .claude/settings.json (modified 1 hour ago)
  ✓ .cursorrules (modified 3 hours ago)

Computing differences...

  Claude Code (.claude/settings.json)
  ─────────────────────────────────────────────────────
    MCP Servers:
      + filesystem (added in tool config)
      ~ memory (modified)
          unified: { "args": ["--limit", "100"] }
          tool:    { "args": ["--limit", "200"] }

  Cursor (.cursorrules)
  ─────────────────────────────────────────────────────
    Rules:
      + "Always use TypeScript strict mode"

  Summary: 2 additions, 1 modification

? How do you want to resolve conflicts?
  ❯ Keep tool changes (import to unified)
    Keep unified config (export to tool)
    Review each conflict

? Import "filesystem" MCP server to unified config? (Y/n)

? MCP server "memory" has different args:
    unified: --limit 100
    tool:    --limit 200
  Which version to keep?
  ❯ Tool version (--limit 200)
    Unified version (--limit 100)
    Custom value

? Import "Always use TypeScript strict mode" rule from Cursor? (Y/n)

Syncing...
  ✓ Updated unified.json
  ✓ Exported to .claude/settings.json
  ✓ No changes to .cursorrules

  Backup created: .unify/backup/2024-01-15T10-30-00/

Done! 3 changes synced.
```

#### 示例

```bash
# 交互式双向同步
unify sync

# 导出到所有工具
unify sync --mode one-way-export

# 导入所有工具配置
unify sync --mode one-way-import

# 只同步特定工具
unify sync claude-code cursor

# 自动模式，冲突时工具优先
unify sync --mode two-way-auto --strategy tool-wins

# 预览变更
unify sync --dry-run

# 监听模式
unify sync --watch

# 监听模式，5秒防抖
unify sync --watch --debounce 5000

# 不创建备份
unify sync --no-backup

# JSON 输出
unify sync --format json
```

#### 输出格式

**表格格式**

```
  Sync Results
  ────────────────────────────────────────────────────────

  Tool          Direction    Status      Changes
  ────────────────────────────────────────────────────────
  Claude Code   Export       Success     +2 rules, ~1 mcp
  Cursor        Export       Success     +1 rule
  Windsurf      Skip         N/A         No changes

  Summary:
    Exported: 3 changes
    Imported: 1 change
    Conflicts: 0
    Duration: 1.2s

  Backup: .unify/backup/2024-01-15T10-30-00/
```

**JSON 格式**

```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "mode": "two-way-interactive",
  "results": [
    {
      "tool": "claude-code",
      "direction": "export",
      "status": "success",
      "changes": {
        "added": { "rules": 2 },
        "modified": { "mcpServers": 1 }
      }
    },
    {
      "tool": "cursor",
      "direction": "export",
      "status": "success",
      "changes": {
        "added": { "rules": 1 }
      }
    }
  ],
  "summary": {
    "exported": 3,
    "imported": 1,
    "conflicts": 0,
    "duration": 1200
  },
  "backup": ".unify/backup/2024-01-15T10-30-00/"
}
```

#### 错误处理

| 错误码          | 说明             | 解决方案                     |
| --------------- | ---------------- | ---------------------------- |
| `NO_CONFIG`     | 未找到统一配置   | 先运行 `unify init`          |
| `SYNC_CONFLICT` | 存在未解决的冲突 | 使用 `--strategy` 或交互模式 |
| `WRITE_ERROR`   | 写入失败         | 检查权限和磁盘空间           |
| `HOOK_FAILED`   | 钩子执行失败     | 检查钩子脚本                 |

---

### 3.3 import - 从工具导入

从工具配置导入到统一配置。

#### 命令格式

```bash
unify import [tools...] [options]
```

#### 选项

| 选项                       | 别名 | 类型     | 默认值 | 说明           |
| -------------------------- | ---- | -------- | ------ | -------------- |
| `--merge`                  | `-m` | boolean  | false  | 合并到现有配置 |
| `--strategy <strategy>`    | `-s` | string   | ask    | 冲突策略       |
| `--capabilities <caps...>` |      | string[] | all    | 导入的能力类型 |
| `--strict`                 |      | boolean  | false  | 严格模式       |
| `--skip-hooks`             |      | boolean  | false  | 跳过钩子       |

#### 交互式流程

```
$ unify import cursor

Reading Cursor configuration...
  Found: .cursorrules
  Found: .cursor/mcp.json

Parsing configurations...

  Import Preview:
  ─────────────────────────────────────────────────────

  Rules (3):
    1. "Use functional components" (globs: *.tsx)
    2. "Prefer named exports"
    3. "Use Tailwind CSS"

  MCP Servers (2):
    ✓ github (command: npx @anthropic/github-mcp)
    ✓ filesystem (command: npx @anthropic/filesystem-mcp)

  Settings:
    ✓ Default model: claude-3.5-sonnet

? What do you want to import?
  ◉ Rules (3)
  ◉ MCP Servers (2)
  ◯ Settings (tool-specific)

  Detected conflict: Rule "Use Tailwind CSS" already exists
  ? How to resolve?
    ❯ Replace existing rule
      Keep both rules
      Skip this rule

  Importing to unified.json...
    ✓ Imported 3 rules
    ✓ Imported 2 MCP servers
    ⚠ Skipped 1 duplicate rule

  Done! 5 items imported.
```

#### 示例

```bash
# 从所有检测到的工具导入
unify import

# 从特定工具导入
unify import claude-code cursor

# 合并模式
unify import cursor --merge

# 只导入规则
unify import cursor --capabilities rules

# 只导入规则和 MCP
unify import cursor --capabilities rules mcp_servers

# 严格模式，任何错误都中断
unify import cursor --strict

# 冲突时使用工具配置
unify import cursor --strategy tool-wins

# 预览导入
unify import cursor --dry-run
```

---

### 3.4 export - 导出到工具

从统一配置导出到工具配置。

#### 命令格式

```bash
unify export [tools...] [options]
```

#### 选项

| 选项                       | 别名 | 类型     | 默认值        | 说明           |
| -------------------------- | ---- | -------- | ------------- | -------------- |
| `--backup`                 | `-b` | boolean  | true          | 备份现有配置   |
| `--backup-dir <path>`      |      | string   | .unify/backup | 备份目录       |
| `--overwrite`              | `-o` | boolean  | true          | 覆盖现有文件   |
| `--capabilities <caps...>` |      | string[] | all           | 导出的能力类型 |
| `--skip-hooks`             |      | boolean  | false         | 跳过钩子       |

#### 交互式流程

```
$ unify export claude-code cursor --dry-run

Reading unified.json...
  Version: 1.0
  Rules: 5
  MCP Servers: 3

Generating tool configurations...

  Export Preview:
  ─────────────────────────────────────────────────────

  Claude Code (.claude/):
    Files to create:
      ✓ settings.json (permissions + settings)
      ✓ settings.local.json (local overrides)
      ✓ mcp.json (3 servers)

    Content preview:
      • Rules: 5 (all supported)
      • MCP: 3/3 servers
      • Settings: default model, permissions

    Warnings:
      ⚠ "custom-commands" not supported by Claude Code

  Cursor (./):
    Files to create:
      ✓ .cursorrules (5 rules)
      ✓ .cursor/mcp.json (3 servers)

    Content preview:
      • Rules: 5 (all supported)
      • MCP: 3/3 servers

? Proceed with export? (Y/n)

  Exporting...
    ✓ Created .claude/settings.json
    ✓ Created .claude/settings.local.json
    ✓ Created .claude/mcp.json
    ✓ Created .cursorrules
    ✓ Created .cursor/mcp.json

  Backups saved to .unify/backup/2024-01-15T10-30-00/

  Done! Exported to 2 tools.
```

#### 示例

```bash
# 导出到所有配置的工具
unify export

# 导出到特定工具
unify export claude-code cursor windsurf

# 预览导出
unify export --dry-run

# 不创建备份
unify export --no-backup

# 只导出规则
unify export cursor --capabilities rules

# 指定备份目录
unify export --backup-dir ./backups

# 不覆盖现有文件
unify export --no-overwrite

# 详细输出
unify export -v
```

---

### 3.5 diff - 查看差异

比较统一配置与工具配置之间的差异。

#### 命令格式

```bash
unify diff [tool] [options]
```

#### 选项

| 选项                | 别名 | 类型    | 默认值 | 说明         |
| ------------------- | ---- | ------- | ------ | ------------ |
| `--format <format>` | `-f` | string  | table  | 输出格式     |
| `--color`           |      | boolean | true   | 彩色输出     |
| `--context <lines>` | `-C` | number  | 3      | 上下文行数   |
| `--show-unchanged`  |      | boolean | false  | 显示未变更项 |

#### 输出格式

**表格格式 (默认)**

```
$ unify diff claude-code

  Comparing unified.json with .claude/settings.json
  ══════════════════════════════════════════════════════════

  MCP Servers
  ─────────────────────────────────────────────────────────
  Name        Status      Unified              Tool
  ─────────────────────────────────────────────────────────
  filesystem  MODIFIED    limit: 100           limit: 200
  github      ADDED       -                    ✓
  memory      DELETED     ✓                    -
  slack       SAME        ✓                    ✓

  Rules
  ─────────────────────────────────────────────────────────
  ID          Status      Description
  ─────────────────────────────────────────────────────────
  rule-1      SAME        Use TypeScript
  rule-2      MODIFIED    Use strict mode (globs changed)
  rule-3      ADDED       - (only in tool)

  Settings
  ─────────────────────────────────────────────────────────
  Path                    Unified         Tool
  ─────────────────────────────────────────────────────────
  defaultModel            sonnet-3.5      sonnet-4
  permissions.allow[0]    Bash(*)         Bash(npm:*)

  Summary
  ─────────────────────────────────────────────────────────
  Added:     2 items (1 server, 1 rule)
  Modified:  3 items
  Deleted:   1 item (memory server)

  Potential conflicts: 2
  Run 'unify sync' to resolve.
```

**Unified Diff 格式**

```
$ unify diff --format unified

--- unified.json
+++ .claude/settings.json
@@ -15,7 +15,7 @@
     "mcpServers": {
         "filesystem": {
             "command": "npx @anthropic/filesystem-mcp",
-            "args": ["--limit", "100"]
+            "args": ["--limit", "200"]
         },
+        "github": {
+            "command": "npx @anthropic/github-mcp"
+        },
         "memory": {
-            "command": "npx @anthropic/memory-mcp"
         }
```

**JSON 格式**

```json
{
  "tool": "claude-code",
  "configPath": ".claude/settings.json",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "diffs": [
    {
      "path": "mcpServers.filesystem.args",
      "type": "modified",
      "unified": ["--limit", "100"],
      "tool": ["--limit", "200"]
    },
    {
      "path": "mcpServers.github",
      "type": "added",
      "unified": null,
      "tool": {
        "command": "npx @anthropic/github-mcp"
      }
    },
    {
      "path": "mcpServers.memory",
      "type": "deleted",
      "unified": {
        "command": "npx @anthropic/memory-mcp"
      },
      "tool": null
    }
  ],
  "summary": {
    "added": 2,
    "modified": 3,
    "deleted": 1,
    "conflicts": 2
  }
}
```

#### 示例

```bash
# 比较所有工具
unify diff

# 比较特定工具
unify diff claude-code

# JSON 输出
unify diff --format json

# Unified diff 格式
unify diff --format unified

# 显示更多上下文
unify diff --context 5

# 显示未变更项
unify diff --show-unchanged
```

---

### 3.6 watch - 监听变化

监听配置文件变化并自动同步。

#### 命令格式

```bash
unify watch [options]
```

#### 选项

| 选项                     | 别名 | 类型     | 默认值       | 说明         |
| ------------------------ | ---- | -------- | ------------ | ------------ |
| `--debounce <ms>`        | `-d` | number   | 1000         | 防抖延迟     |
| `--mode <mode>`          | `-m` | string   | two-way-auto | 同步模式     |
| `--strategy <strategy>`  | `-s` | string   | latest       | 冲突策略     |
| `--poll`                 |      | boolean  | false        | 使用轮询模式 |
| `--ignore <patterns...>` |      | string[] | -            | 忽略的模式   |

#### 交互式输出

```
$ unify watch

Starting file watcher...
  Watching: unified.json
  Watching: .claude/settings.json
  Watching: .cursorrules
  Watching: .cursor/mcp.json

  Mode: two-way-auto
  Strategy: latest
  Debounce: 1000ms

Ready! Press Ctrl+C to stop.

────────────────────────────────────────────────────────
[10:30:15] Changed: .claude/settings.json
           Detecting changes...
           → Importing MCP server "github" to unified
           ✓ Synced 1 change (took 50ms)

[10:31:22] Changed: unified.json
           → Exporting to all tools
           ✓ Exported 2 rules to .cursorrules
           ✓ No changes to .claude/settings.json
           ✓ Synced 2 changes (took 120ms)

[10:32:45] Changed: .cursorrules
           Detecting changes...
           ⚠ Conflict detected: Rule "use-typescript"
           → Using strategy: latest (tool wins)
           ✓ Synced 1 change (took 80ms)
────────────────────────────────────────────────────────
```

#### 示例

```bash
# 默认监听
unify watch

# 自定义防抖
unify watch --debounce 2000

# 导出模式（只监听 unified.json 变化）
unify watch --mode one-way-export

# 使用轮询（适用于网络文件系统）
unify watch --poll

# 忽略特定文件
unify watch --ignore "**/test/**" "**/*.bak"

# 静默模式
unify watch --quiet
```

---

### 3.7 status - 查看状态

显示当前配置和同步状态。

#### 命令格式

```bash
unify status [options]
```

#### 选项

| 选项         | 别名 | 类型    | 默认值 | 说明      |
| ------------ | ---- | ------- | ------ | --------- |
| `--detailed` | `-d` | boolean | false  | 详细信息  |
| `--json`     |      | boolean | false  | JSON 输出 |

#### 输出格式

**默认格式**

```
$ unify status

  Unify-AI Status
  ══════════════════════════════════════════════════════════

  Config: unified.json (v1.0)
  Last Sync: 2 hours ago
  Status: ✓ Synced

  Tools
  ─────────────────────────────────────────────────────────
  Tool          Status      Last Modified    Changes
  ─────────────────────────────────────────────────────────
  Claude Code   ✓ Synced    2 hours ago      0
  Cursor        ⚠ Modified  30 minutes ago   2
  Windsurf      ✓ Synced    2 hours ago      0
  Copilot       - Not configured

  Pending Conflicts: 0

  Run 'unify diff' to see changes
  Run 'unify sync' to synchronize
```

**详细格式**

```
$ unify status --detailed

  Unify-AI Status (Detailed)
  ══════════════════════════════════════════════════════════

  Configuration
  ─────────────────────────────────────────────────────────
  Path:         /project/unified.json
  Version:      1.0
  Schema:       https://unify-ai.dev/schemas/v1.json
  Size:         2.4 KB
  Modified:     2024-01-15 10:30:00
  Checksum:     abc123...

  Contents
  ─────────────────────────────────────────────────────────
  Rules:        5
  MCP Servers:  3
  Commands:     2
  Prompts:      1
  Settings:     ✓ Configured

  Tool Configurations
  ─────────────────────────────────────────────────────────

  Claude Code
    Config Path:  .claude/settings.json
    Status:       ✓ Synced
    Last Sync:    2024-01-15 10:30:00
    Capabilities: rules, mcp_servers, settings, commands
    Checksum:     def456...
    Changes:      0 pending

  Cursor
    Config Path:  .cursorrules, .cursor/mcp.json
    Status:       ⚠ Modified
    Last Sync:    2024-01-15 10:00:00
    Modified:     2024-01-15 10:30:00
    Checksum:     ghi789... (expected: xyz999...)
    Changes:      2 pending
      - Rule "use-strict-mode" modified
      - MCP server "filesystem" added

  Windsurf
    Config Path:  .windsurf/rules.md
    Status:       ✓ Synced
    Last Sync:    2024-01-15 10:30:00
    Capabilities: rules, settings (partial)
    Checksum:     jkl012...

  Pending Operations
  ─────────────────────────────────────────────────────────
  • 2 changes need sync (Cursor)
  • 0 conflicts to resolve

  Backup
  ─────────────────────────────────────────────────────────
  Directory:    .unify/backup/
  Last Backup:  2024-01-15 10:30:00
  Total:        5 backups, 12 KB
```

**JSON 格式**

```json
{
  "config": {
    "path": "unified.json",
    "version": "1.0",
    "exists": true,
    "lastModified": "2024-01-15T10:30:00.000Z",
    "checksum": "abc123"
  },
  "tools": [
    {
      "id": "claude-code",
      "name": "Claude Code",
      "status": "synced",
      "configPath": ".claude/settings.json",
      "lastSync": "2024-01-15T10:30:00.000Z",
      "pendingChanges": 0
    },
    {
      "id": "cursor",
      "name": "Cursor",
      "status": "modified",
      "configPath": ".cursorrules",
      "lastSync": "2024-01-15T10:00:00.000Z",
      "pendingChanges": 2
    }
  ],
  "pendingConflicts": 0,
  "backup": {
    "directory": ".unify/backup/",
    "lastBackup": "2024-01-15T10:30:00.000Z",
    "count": 5
  }
}
```

#### 示例

```bash
# 查看状态
unify status

# 详细状态
unify status --detailed

# JSON 输出
unify status --json

# 快速检查（只显示同步状态）
unify status --quiet
```

---

### 3.8 config - 管理配置

管理 CLI 配置和设置。

#### 命令格式

```bash
unify config <action> [key] [value] [options]
```

#### 子命令

| 命令                       | 说明               |
| -------------------------- | ------------------ |
| `config list`              | 列出所有配置       |
| `config get <key>`         | 获取配置值         |
| `config set <key> <value>` | 设置配置值         |
| `config delete <key>`      | 删除配置           |
| `config path`              | 显示配置文件路径   |
| `config edit`              | 在编辑器中打开配置 |
| `config validate`          | 验证配置           |

#### 示例

```bash
# 列出所有配置
unify config list

# 获取单个配置
unify config get sync.mode

# 设置配置
unify config set sync.mode two-way-auto
unify config set targets claude-code cursor windsurf

# 删除配置
unify config delete sync.autoSync

# 显示配置文件路径
unify config path
# Output: /project/.unifyrc

# 在编辑器中打开
unify config edit

# 验证配置
unify config validate

# 重置为默认
unify config reset

# 重置特定配置
unify config reset sync
```

#### 交互式配置

```bash
$ unify config edit

? Which setting do you want to change?
  ❯ sync
    import
    export
    hooks
    output

? sync settings:
  ❯ mode: two-way-interactive
    autoSync: false
    watchDebounce: 1000
    conflictStrategy: ask

? Change sync mode:
  ❯ two-way-interactive
    two-way-auto
    one-way-export
    one-way-import

Updated: sync.mode = "two-way-auto"
```

---

## 4. 钩子机制

### 4.1 支持的钩子

| 钩子         | 触发时机          | 用途               |
| ------------ | ----------------- | ------------------ |
| `preInit`    | init 命令执行前   | 验证环境、准备数据 |
| `postInit`   | init 命令执行后   | 初始化后续任务     |
| `preSync`    | sync 命令执行前   | 备份检查、锁定验证 |
| `postSync`   | sync 命令执行后   | 通知、日志记录     |
| `preImport`  | import 命令执行前 | 数据验证           |
| `postImport` | import 命令执行后 | 清理、通知         |
| `preExport`  | export 命令执行前 | 备份验证           |
| `postExport` | export 命令执行后 | 部署、通知         |
| `onConflict` | 冲突检测时        | 自定义冲突处理     |
| `onError`    | 错误发生时        | 错误报告、回滚     |

### 4.2 钩子上下文

```typescript
interface HookContext {
  // 命令信息
  command: string;
  options: Record<string, unknown>;

  // 配置
  config?: UnifiedConfig;
  cliConfig?: UnifyCliConfig;

  // 执行结果
  result?: unknown;

  // 错误信息
  error?: Error;

  // 工具方法
  utils: {
    log: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    exec: (command: string) => Promise<string>;
    prompt: (message: string) => Promise<string>;
    confirm: (message: string) => Promise<boolean>;
  };

  // 中断执行
  abort: (reason?: string) => void;
}
```

### 4.3 钩子示例

**Shell 脚本钩子 (.unify/hooks/pre-sync.sh)**

```bash
#!/bin/bash
# 确保没有未提交的更改

if ! git diff-index --quiet HEAD --; then
  echo "Error: Uncommitted changes detected"
  echo "Please commit or stash your changes before syncing"
  exit 1
fi

echo "Pre-sync check passed"
```

**JavaScript 钩子 (.unify/hooks/on-conflict.mjs)**

```javascript
#!/usr/bin/env node

export default async function onConflict(context) {
  const { conflict, utils } = context;
  const { log, prompt, confirm } = utils;

  log(`Conflict detected at ${conflict.path}`);
  log(`Unified: ${JSON.stringify(conflict.unified.value)}`);
  log(`Tool: ${JSON.stringify(conflict.tool.value)}`);

  // 自定义冲突解决逻辑
  if (conflict.path.includes('mcpServers')) {
    const useTool = await confirm('Use tool version for MCP server?');
    return useTool ? 'tool-wins' : 'unified-wins';
  }

  // 默认策略
  return 'latest';
}
```

**TypeScript 钩子配置**

```typescript
// .unify/hooks.ts
import type { HookFunction } from '@unify-ai/cli';

export const preSync: HookFunction = async context => {
  const { utils, abort } = context;

  // 检查是否有锁定的配置
  const locks = await checkLocks();
  if (locks.length > 0) {
    utils.warn(`Found ${locks.length} locked configurations`);
    const proceed = await utils.confirm('Proceed anyway?');
    if (!proceed) {
      abort('User cancelled');
    }
  }
};

export const postSync: HookFunction = async context => {
  const { result, utils } = context;

  // 发送通知
  if (result.changes > 0) {
    await sendNotification(`Synced ${result.changes} changes`);
  }

  // 记录日志
  utils.log(`Sync completed at ${new Date().toISOString()}`);
};
```

---

## 5. 输出格式详解

### 5.1 表格格式

默认的人类可读格式，使用颜色和对齐。

```
  Command Results
  ══════════════════════════════════════════════════════════

  Column 1      Column 2      Column 3
  ─────────────────────────────────────────────────────────
  Row 1         Value         ✓ Status
  Row 2         Value         ✗ Error

  Summary: 2 items processed
```

### 5.2 JSON 格式

结构化输出，便于程序处理。

```json
{
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "command": "sync",
  "options": {},
  "result": { ... },
  "stats": { ... },
  "errors": [],
  "warnings": []
}
```

### 5.3 YAML 格式

适合配置文件和日志。

```yaml
success: true
timestamp: '2024-01-15T10:30:00.000Z'
command: sync
result:
  changes: 3
  conflicts: 0
```

### 5.4 静默格式

只输出错误，适合 CI/CD。

```
# 成功时无输出
# 只有错误时输出
Error: Configuration file not found
```

---

## 6. 错误处理

### 6.1 错误类型

| 类型              | 说明         | 退出码 |
| ----------------- | ------------ | ------ |
| `ConfigError`     | 配置相关错误 | 10     |
| `ValidationError` | 验证失败     | 11     |
| `SyncError`       | 同步错误     | 20     |
| `ConflictError`   | 冲突错误     | 21     |
| `ImportError`     | 导入错误     | 30     |
| `ExportError`     | 导出错误     | 31     |
| `HookError`       | 钩子执行错误 | 40     |
| `PermissionError` | 权限错误     | 50     |
| `NetworkError`    | 网络错误     | 51     |
| `UnknownError`    | 未知错误     | 1      |

### 6.2 错误输出格式

**表格格式**

```
  Error: Failed to sync configurations
  ══════════════════════════════════════════════════════════

  Code: SYNC_CONFLICT
  Message: 2 conflicts detected during sync

  Conflicts:
    1. mcpServers.filesystem.args
       unified: ["--limit", "100"]
       tool: ["--limit", "200"]

    2. rules[2].content
       unified: "Use strict TypeScript"
       tool: "Use TypeScript with strict mode"

  Suggestions:
    • Run 'unify sync --strategy ask' to resolve interactively
    • Run 'unify diff' to see all differences

  For more help, visit: https://unify-ai.dev/docs/errors/sync-conflict
```

**JSON 格式**

```json
{
  "success": false,
  "error": {
    "code": "SYNC_CONFLICT",
    "message": "2 conflicts detected during sync",
    "type": "SyncError",
    "details": {
      "conflicts": [
        {
          "path": "mcpServers.filessystem.args",
          "unified": ["--limit", "100"],
          "tool": ["--limit", "200"]
        }
      ]
    },
    "suggestions": [
      "Run 'unify sync --strategy ask' to resolve interactively",
      "Run 'unify diff' to see all differences"
    ],
    "helpUrl": "https://unify-ai.dev/docs/errors/sync-conflict"
  },
  "exitCode": 21
}
```

---

## 7. 进度显示

### 7.1 进度条

用于长时间操作。

```
  Syncing configurations...

  Claude Code    ████████████████████ 100%
  Cursor         ████████████████████ 100%
  Windsurf       ████████████░░░░░░░░  60%

  Processing rules... (3/5)
```

### 7.2 Spinner

用于不确定时长的操作。

```
  ⠋ Detecting tool configurations...
  ⠙ Reading .claude/settings.json...
  ⠹ Parsing Cursor rules...
  ✓ Found 3 tool configurations
```

### 7.3 步骤指示

用于多步骤操作。

```
  Initializing configuration...

  [1/4] Scanning for existing configurations... ✓
  [2/4] Importing from detected tools... ✓
  [3/4] Merging configurations... ✓
  [4/4] Writing unified.json... ✓

  Done! Configuration initialized successfully.
```

---

## 8. 完整使用示例

### 8.1 新项目初始化

```bash
# 1. 创建项目目录
mkdir my-project && cd my-project

# 2. 初始化 git
git init

# 3. 初始化 unify-ai
unify init -i

# 4. 查看状态
unify status

# 5. 编辑配置
vim unified.json

# 6. 导出到工具
unify export

# 7. 启用监听
unify watch
```

### 8.2 从现有项目迁移

```bash
# 1. 检测现有配置
unify status

# 2. 从现有工具导入
unify init --from claude-code

# 3. 查看差异
unify diff

# 4. 同步
unify sync

# 5. 验证
unify status --detailed
```

### 8.3 多工具协作

```bash
# 1. 配置目标工具
unify config set targets claude-code cursor windsurf

# 2. 编辑统一配置
vim unified.json

# 3. 预览导出
unify export --dry-run

# 4. 导出到所有工具
unify export

# 5. 查看各工具状态
unify status
```

### 8.4 CI/CD 集成

```yaml
# .github/workflows/sync-config.yml
name: Sync AI Config

on:
  push:
    paths:
      - 'unified.json'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install unify-ai
        run: npm install -g @unify-ai/cli

      - name: Validate config
        run: unify config validate

      - name: Export to tools
        run: unify export --format json --no-backup
        env:
          UNIFY_NO_COLOR: 'true'

      - name: Commit changes
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'
          git add -A
          git diff --quiet && git diff --staged --quiet || git commit -m 'chore: sync AI config'
          git push
```

---

## 9. 依赖设计

### 9.1 包依赖

```json
{
  "dependencies": {
    "@unify-ai/core": "workspace:*",
    "commander": "^12.0.0",
    "@inquirer/prompts": "^5.0.0",
    "chalk": "^5.3.0",
    "cli-table3": "^0.6.0",
    "ora": "^8.0.0",
    "conf": "^13.0.0",
    "chokidar": "^3.6.0",
    "yaml": "^2.3.0",
    "json5": "^2.2.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.9.0"
  }
}
```

### 9.2 项目结构

```
packages/cli/
├── src/
│   ├── index.ts              # 入口
│   ├── cli.ts                # CLI 主类
│   │
│   ├── commands/             # 命令实现
│   │   ├── index.ts
│   │   ├── init.ts
│   │   ├── sync.ts
│   │   ├── import.ts
│   │   ├── export.ts
│   │   ├── diff.ts
│   │   ├── watch.ts
│   │   ├── status.ts
│   │   └── config.ts
│   │
│   ├── prompts/              # 交互式提示
│   │   ├── index.ts
│   │   ├── init.ts
│   │   ├── sync.ts
│   │   └── common.ts
│   │
│   ├── output/               # 输出格式化
│   │   ├── index.ts
│   │   ├── table.ts
│   │   ├── json.ts
│   │   ├── yaml.ts
│   │   └── silent.ts
│   │
│   ├── hooks/                # 钩子系统
│   │   ├── index.ts
│   │   ├── runner.ts
│   │   └── context.ts
│   │
│   ├── config/               # 配置管理
│   │   ├── index.ts
│   │   ├── loader.ts
│   │   ├── schema.ts
│   │   └── validator.ts
│   │
│   └── utils/                # 工具函数
│       ├── index.ts
│       ├── logger.ts
│       ├── spinner.ts
│       ├── progress.ts
│       └── error.ts
│
├── bin/
│   └── unify.js              # CLI 入口脚本
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## 10. 实现优先级

### Phase 1: 核心命令 (P0)

1. `init` - 初始化配置
2. `export` - 导出到工具
3. `import` - 从工具导入
4. `status` - 查看状态

### Phase 2: 同步功能 (P1)

5. `sync` - 双向同步
6. `diff` - 查看差异
7. `config` - 管理配置

### Phase 3: 高级功能 (P2)

8. `watch` - 监听变化
9. 钩子系统
10. 备份恢复

---

## 总结

本设计文档定义了 `@unify-ai/cli` 的完整用户体验：

1. **8 个核心命令**: init, sync, import, export, diff, watch, status, config
2. **丰富的交互**: 每个命令都支持交互式和命令行参数两种模式
3. **多种输出格式**: table, json, yaml, silent
4. **完善的钩子系统**: 10 个钩子点，支持脚本和 JavaScript
5. **友好的错误处理**: 详细的错误信息和建议
6. **进度反馈**: 进度条、spinner、步骤指示

这套 CLI 设计遵循现代 CLI 工具的最佳实践，为开发者提供直观、高效的配置管理体验。
