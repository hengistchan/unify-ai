# Unify-AI Adapter 架构设计

## 概述

Adapter 架构用于统一管理 8+ 种 AI Agent 工具的配置转换，支持双向转换（import 和 export）。

## 架构层次

```
unify-ai/
├── src/
│   ├── core/                    # 核心层
│   │   ├── types.ts             # 统一类型定义
│   │   └── index.ts
│   │
│   ├── adapters/                # 适配器层
│   │   ├── base/                # 基础抽象
│   │   │   ├── BaseAdapter.ts   # 抽象基类
│   │   │   ├── IAdapter.ts      # 接口定义
│   │   │   ├── Capability.ts    # 能力声明工具
│   │   │   └── index.ts
│   │   │
│   │   ├── cursor/              # Cursor 适配器 (已实现)
│   │   ├── claude-code/         # Claude Code 适配器 (已实现)
│   │   ├── codex/               # OpenAI Codex 适配器 (待实现)
│   │   ├── copilot/             # GitHub Copilot 适配器 (待实现)
│   │   ├── windsurf/            # Windsurf 适配器 (待实现)
│   │   ├── cline/               # Cline 适配器 (待实现)
│   │   ├── aider/               # Aider 适配器 (待实现)
│   │   ├── continue/            # Continue.dev 适配器 (待实现)
│   │   │
│   │   └── registry.ts          # 适配器注册表
│   │
│   ├── discovery/               # 文件发现层
│   │   ├── FileDiscovery.ts     # 文件发现器
│   │   ├── patterns.ts          # 各工具的文件模式常量
│   │   └── index.ts
│   │
│   ├── converter/               # 转换层
│   │   ├── Importer.ts          # 导入转换器
│   │   ├── Exporter.ts          # 导出转换器
│   │   ├── ConflictResolver.ts  # 冲突解决器
│   │   └── index.ts
│   │
│   └── index.ts                 # 公共 API
```

## 各工具配置格式对比

| 工具 | 配置文件 | 格式 | 支持的功能 |
|------|----------|------|------------|
| Cursor | `.cursor/rules/*.md` | Markdown + frontmatter | Rules, MCP |
| Claude Code | `CLAUDE.md`, `settings.json`, `.mcp.json` | Markdown/JSON | Rules, MCP, Settings, Commands |
| OpenAI Codex | `.codex/config.toml`, `AGENTS.md` | TOML/Markdown | Rules, MCP, Settings |
| GitHub Copilot | `.github/copilot-instructions.md` | Markdown | Rules only |
| Windsurf | `.windsurfrules` | Markdown | Rules, MCP |
| Cline | `.clinerules/`, `globalState.json` | JSON | Rules, MCP |
| Aider | `.aider.conf.yml` | YAML | Rules, Settings |
| Continue.dev | `config.yaml` | YAML | Rules, MCP, Settings, Prompts |

---

## 核心类型定义

### 能力枚举

```typescript
enum ConfigCapability {
  RULES = 'rules',              // 自定义规则/指令
  MCP_SERVERS = 'mcp_servers',  // MCP 服务器配置
  SETTINGS = 'settings',        // 工具设置
  COMMANDS = 'commands',        // 自定义命令
  PROMPTS = 'prompts',          // 提示词模板
  CONTEXT = 'context',          // 上下文文件引用
  ENV_VARS = 'env_vars',        // 环境变量
  IGNORE_PATTERNS = 'ignore',   // 忽略模式
}

enum CapabilityLevel {
  FULL = 'full',       // 完全支持
  PARTIAL = 'partial', // 部分支持
  READ_ONLY = 'read_only',   // 只能 import
  NONE = 'none',       // 不支持
}
```

### 统一配置模型

```typescript
interface UnifiedConfig {
  version: string;
  sourceTool?: ToolId;
  lastModified?: string;

  // 核心配置
  rules: RuleConfig[];
  mcp?: MCPConfig;
  settings?: ToolSettings;

  // 扩展配置
  commands?: CommandConfig[];
  prompts?: PromptTemplate[];
  contextFiles?: string[];
  envVars?: Record<string, string>;
  ignorePatterns?: string[];

  // 原始数据
  raw?: Record<string, unknown>;
}

interface RuleConfig {
  id: string;
  name?: string;
  description?: string;
  content: string;
  globs?: string[];
  alwaysApply?: boolean;
  priority?: number;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
  autoApprove?: string[];
  metadata?: Record<string, unknown>;
}
```

---

## IAdapter 接口定义

```typescript
interface IAdapter {
  // 元信息
  readonly toolMeta: ToolMeta;
  readonly version: string;
  getInfo(): AdapterInfo;

  // 能力声明
  getCapabilities(): CapabilityDeclaration[];
  hasCapability(capability: ConfigCapability): boolean;
  getCapabilityLevel(capability: ConfigCapability): CapabilityLevel | undefined;

  // 文件发现
  getFilePatterns(): FilePattern[];
  discoverFiles(projectRoot: string): Promise<FileInfo[]>;
  detect(projectRoot: string): Promise<boolean>;

  // 解析 (Import)
  parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult>;
  parseFile(filePath: string, options?: ConvertOptions): Promise<ParseResult>;
  parseContent(content: string, filePath: string, options?: ConvertOptions): Promise<ParseResult>;

  // 生成 (Export)
  generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult>;
  generateTo(config: UnifiedConfig, targetDir: string, options?: ConvertOptions): Promise<GenerateResult>;

  // 验证
  validate(config: UnifiedConfig): Promise<ValidationResult>;

  // 生命周期
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
}
```

---

## BaseAdapter 抽象类

BaseAdapter 提供了 IAdapter 接口的通用实现：

```typescript
abstract class BaseAdapter implements IAdapter {
  // 子类必须实现
  abstract readonly toolMeta: ToolMeta;
  abstract readonly version: string;
  abstract getCapabilities(): CapabilityDeclaration[];
  abstract getFilePatterns(): FilePattern[];
  abstract parse(projectRoot: string, options?: ConvertOptions): Promise<ParseResult>;
  abstract generate(config: UnifiedConfig, options?: ConvertOptions): Promise<GenerateResult>;

  // 通用实现
  getInfo(): AdapterInfo;
  hasCapability(capability: ConfigCapability): boolean;
  getCapabilityLevel(capability: ConfigCapability): CapabilityLevel | undefined;
  discoverFiles(projectRoot: string): Promise<FileInfo[]>;
  detect(projectRoot: string): Promise<boolean>;
  parseFile(filePath: string, options?: ConvertOptions): Promise<ParseResult>;
  generateTo(config: UnifiedConfig, targetDir: string, options?: ConvertOptions): Promise<GenerateResult>;
  validate(config: UnifiedConfig): Promise<ValidationResult>;

  // 辅助方法
  protected createSuccessResult(data: UnifiedConfig, metadata?): ParseResult;
  protected createErrorResult(errors: ParseError[]): ParseResult;
  protected mergeResults(...results: ParseResult[]): ParseResult;
  protected deepMerge<T>(target: T, source: T): T;
  protected generateId(): string;
}
```

---

## 能力声明机制

每个适配器通过 `getCapabilities()` 声明其支持的功能：

```typescript
// 使用预定义的能力声明
class CursorAdapter extends BaseAdapter {
  getCapabilities(): CapabilityDeclaration[] {
    return [
      { capability: ConfigCapability.RULES, level: CapabilityLevel.FULL },
      { capability: ConfigCapability.MCP_SERVERS, level: CapabilityLevel.PARTIAL,
        notes: 'Cursor supports MCP but format differs from standard' },
      { capability: ConfigCapability.SETTINGS, level: CapabilityLevel.PARTIAL,
        notes: 'Via .cursor/settings' },
    ];
  }
}

// 使用工具函数简化声明
import { ToolCapabilities } from './base/Capability';

class ClaudeCodeAdapter extends BaseAdapter {
  getCapabilities(): CapabilityDeclaration[] {
    return ToolCapabilities.claudeCode();
  }
}
```

---

## 文件发现策略

```typescript
// 自动检测项目使用的工具
const detectedTools = await fileDiscovery.detectTools(projectRoot);

// 发现所有配置文件
const result = await fileDiscovery.discover(projectRoot, {
  capabilities: [ConfigCapability.RULES, ConfigCapability.MCP_SERVERS],
  exclude: ['node_modules/**', 'dist/**'],
});

// 发现特定能力的文件
const ruleFiles = await fileDiscovery.discoverByCapability(
  projectRoot,
  ConfigCapability.RULES
);
```

---

## 转换器使用

### 导入配置

```typescript
import { importer } from 'unify-ai';

// 自动检测并导入
const result = await importer.import('/path/to/project');
if (result.success) {
  console.log('Imported config:', result.config);
}

// 从特定工具导入
const claudeResult = await importer.importFrom(
  '/path/to/project',
  ToolId.CLAUDE_CODE
);

// 合并多个工具的配置
const mergedResult = await importer.import('/path/to/project', {
  mergeMultiple: true,
});
```

### 导出配置

```typescript
import { exporter } from 'unify-ai';

// 导出到指定工具格式
const result = await exporter.export(config, projectRoot, {
  targetTool: ToolId.CURSOR,
  createBackup: true,
  dryRun: false,
});

// 预览导出结果（不写入文件）
const preview = await exporter.preview(config, ToolId.COPILOT);

// 导出到多个工具
const results = await exporter.exportMultiple(config, projectRoot, [
  ToolId.CURSOR,
  ToolId.CLAUDE_CODE,
  ToolId.COPILOT,
]);
```

---

## 冲突解决

```typescript
import { createConflictResolver, ConflictStrategy } from 'unify-ai';

// 创建冲突解决器
const resolver = createConflictResolver('merge'); // 'skip' | 'overwrite' | 'merge' | 'ask'

// 自定义解决策略
const customResolver = createConflictResolver('ask', (conflict) => {
  if (conflict.type === ConflictType.RULE_CONTENT_DIFF) {
    // 总是使用较长的内容
    const existing = conflict.data.existing as RuleConfig;
    const incoming = conflict.data.incoming as RuleConfig;
    return {
      action: incoming.content.length > existing.content.length ? 'use_incoming' : 'keep_existing',
    };
  }
  return { action: 'merge' };
});
```

---

## 实现状态

| 适配器 | 状态 | 备注 |
|--------|------|------|
| Cursor | 已完成 | 支持 rules, mcp, settings |
| Claude Code | 已完成 | 支持 rules, mcp, settings, commands |
| OpenAI Codex | 待实现 | 需要 TOML 解析 |
| GitHub Copilot | 待实现 | 仅支持 rules |
| Windsurf | 待实现 | 需要 .windsurfrules 解析 |
| Cline | 待实现 | 需要 JSON 解析 |
| Aider | 待实现 | 需要 YAML 解析 |
| Continue.dev | 待实现 | 需要 YAML 解析 |

---

## 后续任务

1. **Phase 1** (已完成)
   - [x] 核心类型定义 (types.ts)
   - [x] IAdapter 接口定义
   - [x] BaseAdapter 抽象类
   - [x] 能力声明机制

2. **Phase 2** (已完成)
   - [x] Cursor 适配器
   - [x] Claude Code 适配器
   - [x] 适配器注册表

3. **Phase 3** (进行中)
   - [ ] OpenAI Codex 适配器
   - [ ] GitHub Copilot 适配器
   - [ ] Windsurf 适配器
   - [ ] Cline 适配器
   - [ ] Aider 适配器
   - [ ] Continue.dev 适配器

4. **Phase 4** (已完成)
   - [x] 文件发现服务
   - [x] Importer 转换器
   - [x] Exporter 转换器
   - [x] 冲突解决器

5. **Phase 5** (待开始)
   - [ ] 单元测试
   - [ ] CLI 工具
   - [ ] 文档
