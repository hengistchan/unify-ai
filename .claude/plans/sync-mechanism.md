# Unify-AI 双向转换与同步机制设计

## 1. 概述

### 1.1 核心目标

设计一套完整的双向转换和同步机制，实现：
- **Single Source of Truth**: unified.json 作为唯一可信源
- **多工具支持**: 同步生成到 Claude Code, Cursor, Copilot, Windsurf, Aider 等
- **双向同步**: 支持从工具配置导入回主配置
- **冲突处理**: 智能检测和处理配置冲突
- **变更追踪**: 追踪用户手动修改，区分系统生成和用户修改

### 1.2 核心场景

| 场景 | 方向 | 描述 |
|------|------|------|
| Export | unified.json → 工具配置 | 生成各工具的配置文件 |
| Import | 工具配置 → unified.json | 导入工具配置修改到主配置 |
| Diff | 双向比较 | 检测主配置与生成配置的差异 |
| Merge | 工具配置 → unified.json | 智能合并修改，处理冲突 |
| Watch | 实时监听 | 文件变化时自动同步 |

---

## 2. 状态机设计

### 2.1 同步状态机

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│  IDLE   │───▶│  SCAN   │───▶│  DIFF   │───▶│ RESOLVE │────┘
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │
     │              │              │              │
     │              ▼              ▼              ▼
     │         ┌─────────┐   ┌─────────┐   ┌─────────┐
     │         │  ERROR  │   │ CONFLICT│   │  SYNC   │
     │         └─────────┘   └─────────┘   └─────────┘
     │              │              │              │
     └──────────────┴──────────────┴──────────────┘
```

### 2.2 状态定义

```typescript
enum SyncState {
  IDLE = 'idle',           // 空闲状态
  SCANNING = 'scanning',   // 扫描配置文件
  DIFFING = 'diffing',     // 计算差异
  RESOLVING = 'resolving', // 解决冲突
  SYNCING = 'syncing',     // 执行同步
  ERROR = 'error',         // 错误状态
  CONFLICT = 'conflict',   // 需要用户解决冲突
}

interface SyncStateMachine {
  currentState: SyncState;
  context: SyncContext;
  transitions: Map<SyncState, SyncState[]>;
  enter(state: SyncState): void;
  exit(state: SyncState): void;
  transition(to: SyncState): boolean;
}
```

### 2.3 同步流程

```typescript
interface SyncFlow {
  // 完整同步流程
  async fullSync(options: SyncOptions): Promise<SyncResult> {
    // 1. 扫描阶段
    await this.enter(SyncState.SCANNING);
    const sources = await this.scanAllSources();

    // 2. 差异计算阶段
    await this.enter(SyncState.DIFFING);
    const diffs = await this.computeDiffs(sources);

    // 3. 冲突检测
    const conflicts = this.detectConflicts(diffs);

    // 4. 冲突解决阶段
    if (conflicts.length > 0) {
      await this.enter(SyncState.RESOLVING);
      const resolution = await this.resolveConflicts(conflicts, options);
      if (!resolution.resolved) {
        await this.enter(SyncState.CONFLICT);
        return { status: 'conflict', conflicts };
      }
    }

    // 5. 执行同步
    await this.enter(SyncState.SYNCING);
    await this.executeSync(diffs, options);

    // 6. 完成返回空闲
    await this.enter(SyncState.IDLE);
    return { status: 'success', changes: diffs };
  }
}
```

---

## 3. 核心数据结构

### 3.1 主配置结构 (unified.json)

```typescript
// unified.json - 单一真相源
interface UnifiedConfig {
  // 元数据
  $schema: string;
  $version: string;
  $lastSync: string;
  $syncId: string;  // UUID，用于追踪同步

  // 全局设置
  global: GlobalSettings;

  // AI 提供商配置
  providers: ProviderConfig[];

  // MCP 服务器配置
  mcpServers: McpServerConfig[];

  // 工具特定配置（扩展点）
  tools: {
    claude?: ClaudeToolConfig;
    cursor?: CursorToolConfig;
    copilot?: CopilotToolConfig;
    windsurf?: WindsurfToolConfig;
    aider?: AiderToolConfig;
  };

  // 同步元数据（追踪变更）
  $sync: SyncMetadata;
}

interface GlobalSettings {
  defaultProvider: string;
  defaultModel: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  type: 'anthropic' | 'openai' | 'google' | 'custom';
  apiKey: string;  // 引用环境变量或加密存储
  baseUrl?: string;
  models: ModelConfig[];
}

interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  tools?: string[];  // 限制可用工具
}
```

### 3.2 同步元数据

```typescript
interface SyncMetadata {
  // 版本追踪
  version: number;
  lastModified: string;
  modifiedBy: 'user' | 'system' | 'import';

  // 文件指纹
  fingerprints: FileFingerprint[];

  // 变更历史
  history: ChangeRecord[];

  // 锁定状态（防止自动覆盖）
  locks: ConfigLock[];
}

interface FileFingerprint {
  path: string;           // 相对路径
  hash: string;           // 内容哈希 (SHA-256)
  lastGenerated: string;  // 上次生成时间
  generator: string;      // 生成器版本
  size: number;
}

interface ChangeRecord {
  timestamp: string;
  type: 'export' | 'import' | 'merge' | 'manual';
  source: string;         // 变更来源
  changes: PropertyChange[];
  resolved?: boolean;
}

interface PropertyChange {
  path: string;           // JSON Path
  oldValue: any;
  newValue: any;
  source: 'user' | 'system' | 'conflict';
}

interface ConfigLock {
  path: string;           // 锁定的配置路径
  reason: string;
  lockedAt: string;
  lockedBy: string;
}
```

### 3.3 工具配置映射

```typescript
// 工具配置映射器接口
interface ToolConfigMapper<T> {
  // 工具标识
  toolId: string;
  toolName: string;

  // 配置文件路径
  configPath: string;

  // 从 unified 导出
  exportFromUnified(unified: UnifiedConfig): Promise<T>;

  // 导入到 unified
  importToUnified(config: T, unified: UnifiedConfig): Promise<Partial<UnifiedConfig>>;

  // 验证配置
  validate(config: T): ValidationResult;

  // 获取默认配置
  getDefault(): T;
}

// Claude Code 配置
interface ClaudeToolConfig {
  permissions: {
    allow: string[];
    deny: string[];
  };
  mcpServers?: McpServerConfig[];
  defaultModel?: string;
}

// Cursor 配置
interface CursorToolConfig {
  models: {
    default: string;
    codebase: string;
  };
  rules: string[];
  mcp?: McpServerConfig[];
}

// 示例：Claude Code 映射器
class ClaudeCodeMapper implements ToolConfigMapper<ClaudeToolConfig> {
  toolId = 'claude';
  toolName = 'Claude Code';
  configPath = '.claude/settings.json';

  async exportFromUnified(unified: UnifiedConfig): Promise<ClaudeToolConfig> {
    return {
      permissions: {
        allow: this.mapPermissions(unified.global.permissions?.allow ?? []),
        deny: this.mapPermissions(unified.global.permissions?.deny ?? []),
      },
      mcpServers: unified.mcpServers
        .filter(s => s.enabled)
        .map(s => this.mapMcpServer(s)),
      defaultModel: unified.global.defaultModel,
    };
  }

  async importToUnified(
    config: ClaudeToolConfig,
    unified: UnifiedConfig
  ): Promise<Partial<UnifiedConfig>> {
    return {
      global: {
        ...unified.global,
        defaultModel: config.defaultModel,
        permissions: {
          allow: this.reversePermissions(config.permissions.allow),
          deny: this.reversePermissions(config.permissions.deny),
        },
      },
      mcpServers: this.mergeMcpServers(config.mcpServers, unified.mcpServers),
    };
  }
}
```

---

## 4. 差异检测机制

### 4.1 差异类型

```typescript
enum DiffType {
  ADDED = 'added',       // 新增
  REMOVED = 'removed',   // 删除
  MODIFIED = 'modified', // 修改
  MOVED = 'moved',       // 移动/重命名
}

interface DiffEntry {
  type: DiffType;
  path: string;          // JSON Path
  source: 'unified' | 'tool';
  unifiedValue?: any;
  toolValue?: any;
  timestamp: string;
  fingerprint?: string;
}

interface DiffResult {
  toolId: string;
  toolName: string;
  configPath: string;
  entries: DiffEntry[];
  hasConflicts: boolean;
  summary: DiffSummary;
}

interface DiffSummary {
  added: number;
  removed: number;
  modified: number;
  conflicts: number;
}
```

### 4.2 Diff 算法

```typescript
class DiffEngine {
  // 深度比较两个配置
  deepDiff(
    unified: any,
    generated: any,
    path: string = ''
  ): DiffEntry[] {
    const diffs: DiffEntry[] = [];

    // 获取所有键
    const allKeys = new Set([
      ...Object.keys(unified ?? {}),
      ...Object.keys(generated ?? {}),
    ]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const unifiedVal = unified?.[key];
      const generatedVal = generated?.[key];

      if (!(key in (unified ?? {}))) {
        // 新增
        diffs.push({
          type: DiffType.ADDED,
          path: currentPath,
          source: 'tool',
          toolValue: generatedVal,
          timestamp: new Date().toISOString(),
        });
      } else if (!(key in (generated ?? {}))) {
        // 删除
        diffs.push({
          type: DiffType.REMOVED,
          path: currentPath,
          source: 'unified',
          unifiedValue: unifiedVal,
          timestamp: new Date().toISOString(),
        });
      } else if (this.isObject(unifiedVal) && this.isObject(generatedVal)) {
        // 递归比较
        diffs.push(...this.deepDiff(unifiedVal, generatedVal, currentPath));
      } else if (!this.isEqual(unifiedVal, generatedVal)) {
        // 修改
        diffs.push({
          type: DiffType.MODIFIED,
          path: currentPath,
          source: 'both',
          unifiedValue,
          toolValue: generatedVal,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return diffs;
  }

  // 检测用户手动修改
  detectUserModifications(
    currentGenerated: any,
    lastGenerated: any,
    lastFingerprint: FileFingerprint
  ): DiffEntry[] {
    // 1. 验证文件是否被修改
    const currentHash = this.hashContent(currentGenerated);
    if (currentHash === lastFingerprint.hash) {
      return []; // 无修改
    }

    // 2. 比较与上次生成的内容
    return this.deepDiff(lastGenerated, currentGenerated);
  }

  // 哈希计算
  private hashContent(content: any): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(content, Object.keys(content).sort()))
      .digest('hex');
  }
}
```

---

## 5. 冲突检测与处理

### 5.1 冲突类型

```typescript
enum ConflictType {
  VALUE_MISMATCH = 'value_mismatch',     // 值不匹配
  DELETE_MODIFY = 'delete_modify',       // 一边删除一边修改
  ADD_ADD = 'add_add',                   // 两边都新增
  TYPE_MISMATCH = 'type_mismatch',       // 类型不匹配
  DEPENDENCY = 'dependency',             // 依赖冲突
}

interface Conflict {
  id: string;
  type: ConflictType;
  path: string;
  unified: {
    value: any;
    modifiedAt: string;
    modifiedBy: string;
  };
  tool: {
    toolId: string;
    toolName: string;
    value: any;
    modifiedAt: string;
  };
  severity: 'low' | 'medium' | 'high';
  autoResolvable: boolean;
  resolution?: ConflictResolution;
}

interface ConflictResolution {
  strategy: ResolutionStrategy;
  resolvedValue: any;
  reason: string;
}

enum ResolutionStrategy {
  UNIFIED_WINS = 'unified_wins',     // 主配置优先
  TOOL_WINS = 'tool_wins',           // 工具配置优先
  MERGE = 'merge',                   // 合并
  KEEP_BOTH = 'keep_both',           // 保留两者
  USER_DECIDE = 'user_deccide',      // 用户决定
  LATEST = 'latest',                 // 最新修改优先
}
```

### 5.2 冲突检测器

```typescript
class ConflictDetector {
  private strategies: Map<ConflictType, ResolutionStrategy[]>;

  constructor() {
    this.strategies = new Map([
      [ConflictType.VALUE_MISMATCH, [
        ResolutionStrategy.LATEST,
        ResolutionStrategy.UNIFIED_WINS,
        ResolutionStrategy.USER_DECIDE,
      ]],
      [ConflictType.DELETE_MODIFY, [
        ResolutionStrategy.TOOL_WINS,  // 保留用户修改
        ResolutionStrategy.USER_DECIDE,
      ]],
      [ConflictType.ADD_ADD, [
        ResolutionStrategy.MERGE,
        ResolutionStrategy.USER_DECIDE,
      ]],
      [ConflictType.TYPE_MISMATCH, [
        ResolutionStrategy.USER_DECIDE,
      ]],
    ]);
  }

  detect(
    diffs: DiffEntry[],
    metadata: SyncMetadata
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    for (const diff of diffs) {
      if (diff.type === DiffType.MODIFIED && diff.source === 'both') {
        // 检查是否是用户修改 vs 系统修改
        const isUserModified = this.isUserModification(diff.path, metadata);
        const isSystemModified = this.isSystemModification(diff.path, metadata);

        if (isUserModified && isSystemModified) {
          // 双边修改 = 冲突
          conflicts.push({
            id: this.generateId(),
            type: ConflictType.VALUE_MISMATCH,
            path: diff.path,
            unified: {
              value: diff.unifiedValue,
              modifiedAt: this.getLastModified(diff.path, 'unified', metadata),
              modifiedBy: 'system',
            },
            tool: {
              toolId: diff.toolId,
              toolName: diff.toolName,
              value: diff.toolValue,
              modifiedAt: diff.timestamp,
            },
            severity: this.assessSeverity(diff),
            autoResolvable: this.canAutoResolve(diff),
          });
        }
      }
    }

    return conflicts;
  }

  private assessSeverity(diff: DiffEntry): 'low' | 'medium' | 'high' {
    // 根据路径和差异类型评估严重程度
    const criticalPaths = ['providers', 'mcpServers', 'permissions'];

    for (const critical of criticalPaths) {
      if (diff.path.startsWith(critical)) {
        return 'high';
      }
    }

    return 'low';
  }

  private canAutoResolve(diff: DiffEntry): boolean {
    // 简单类型的差异可以自动解决
    const simpleTypes = ['string', 'number', 'boolean'];
    return simpleTypes.includes(typeof diff.unifiedValue) &&
           simpleTypes.includes(typeof diff.toolValue);
  }
}
```

### 5.3 冲突解决器

```typescript
class ConflictResolver {
  // 自动解决冲突
  async autoResolve(conflicts: Conflict[]): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      if (!conflict.autoResolvable) continue;

      const resolution = await this.applyDefaultStrategy(conflict);
      if (resolution) {
        resolutions.push(resolution);
        conflict.resolution = resolution;
      }
    }

    return resolutions;
  }

  private async applyDefaultStrategy(
    conflict: Conflict
  ): Promise<ConflictResolution | null> {
    switch (conflict.type) {
      case ConflictType.VALUE_MISMATCH:
        // 使用最新修改
        const unifiedTime = new Date(conflict.unified.modifiedAt).getTime();
        const toolTime = new Date(conflict.tool.modifiedAt).getTime();

        if (toolTime > unifiedTime) {
          return {
            strategy: ResolutionStrategy.LATEST,
            resolvedValue: conflict.tool.value,
            reason: 'Tool config is newer',
          };
        } else {
          return {
            strategy: ResolutionStrategy.LATEST,
            resolvedValue: conflict.unified.value,
            reason: 'Unified config is newer',
          };
        }

      case ConflictType.DELETE_MODIFY:
        // 保留修改
        return {
          strategy: ResolutionStrategy.TOOL_WINS,
          resolvedValue: conflict.tool.value,
          reason: 'Preserving user modification',
        };

      case ConflictType.ADD_ADD:
        // 尝试合并
        if (Array.isArray(conflict.unified.value) &&
            Array.isArray(conflict.tool.value)) {
          return {
            strategy: ResolutionStrategy.MERGE,
            resolvedValue: [...new Set([
              ...conflict.unified.value,
              ...conflict.tool.value,
            ])],
            reason: 'Merged arrays',
          };
        }
        return null;

      default:
        return null;
    }
  }

  // 交互式解决
  async interactiveResolve(
    conflicts: Conflict[],
    ui: UserInterface
  ): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      if (conflict.resolution) {
        resolutions.push(conflict.resolution);
        continue;
      }

      // 显示冲突详情
      const choice = await ui.promptConflictResolution(conflict, {
        options: [
          { label: 'Use unified', value: conflict.unified.value },
          { label: 'Use tool', value: conflict.tool.value },
          { label: 'Custom value', value: 'custom' },
          { label: 'Skip', value: null },
        ],
        showDiff: true,
      });

      if (choice !== null && choice !== 'custom') {
        resolutions.push({
          strategy: choice === conflict.unified.value
            ? ResolutionStrategy.UNIFIED_WINS
            : ResolutionStrategy.TOOL_WINS,
          resolvedValue: choice,
          reason: 'User decision',
        });
      } else if (choice === 'custom') {
        const customValue = await ui.promptInput(
          `Enter custom value for ${conflict.path}:`
        );
        resolutions.push({
          strategy: ResolutionStrategy.USER_DECIDE,
          resolvedValue: customValue,
          reason: 'User provided custom value',
        });
      }
    }

    return resolutions;
  }
}
```

---

## 6. 变更追踪机制

### 6.1 变更追踪器

```typescript
class ChangeTracker {
  private db: ChangeDatabase;

  constructor(dbPath: string) {
    this.db = new ChangeDatabase(dbPath);
  }

  // 记录变更
  async recordChange(change: ChangeEvent): Promise<void> {
    await this.db.insert({
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...change,
    });
  }

  // 获取文件变更历史
  async getHistory(
    path: string,
    options?: HistoryOptions
  ): Promise<ChangeRecord[]> {
    return this.db.query({
      path,
      limit: options?.limit ?? 100,
      since: options?.since,
    });
  }

  // 检测变更来源
  async detectSource(
    path: string,
    currentContent: any
  ): Promise<ChangeSource> {
    // 1. 获取上次记录的指纹
    const lastFingerprint = await this.db.getFingerprint(path);

    if (!lastFingerprint) {
      return { type: 'new', confidence: 1.0 };
    }

    // 2. 计算当前指纹
    const currentHash = this.hashContent(currentContent);

    if (currentHash === lastFingerprint.hash) {
      return { type: 'unchanged', confidence: 1.0 };
    }

    // 3. 检查是否匹配生成的指纹
    const expectedGenerated = await this.getExpectedGenerated(path);
    if (expectedGenerated) {
      const expectedHash = this.hashContent(expectedGenerated);
      if (currentHash === expectedHash) {
        return { type: 'system', confidence: 1.0 };
      }
    }

    // 4. 分析变更模式判断是用户修改还是系统修改
    const analysis = await this.analyzeChangePattern(
      path,
      lastFingerprint.content,
      currentContent
    );

    return {
      type: analysis.isUser ? 'user' : 'unknown',
      confidence: analysis.confidence,
    };
  }

  // 分析变更模式
  private async analyzeChangePattern(
    path: string,
    oldContent: any,
    newContent: any
  ): Promise<{ isUser: boolean; confidence: number }> {
    const indicators = {
      // 用户修改的指标
      user: 0,
      // 系统修改的指标
      system: 0,
    };

    // 检查格式变化（用户修改通常格式不一致）
    const oldFormatted = JSON.stringify(oldContent, null, 2);
    const newFormatted = JSON.stringify(newContent, null, 2);
    const newRaw = JSON.stringify(newContent);

    if (oldFormatted !== newFormatted && newFormatted === newRaw) {
      indicators.user += 0.3; // 格式变化可能是用户编辑
    }

    // 检查变更时间（工作时间更可能是用户修改）
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 18) {
      indicators.user += 0.2;
    }

    // 检查变更内容模式
    const diff = this.computeDiff(oldContent, newContent);
    for (const change of diff) {
      // 用户通常修改值，系统通常修改结构
      if (typeof change.newValue === 'string' &&
          !change.path.includes('$')) {
        indicators.user += 0.1;
      }
    }

    const totalIndicators = indicators.user + indicators.system;
    if (totalIndicators === 0) {
      return { isUser: false, confidence: 0.5 };
    }

    return {
      isUser: indicators.user > indicators.system,
      confidence: indicators.user / totalIndicators,
    };
  }
}

interface ChangeSource {
  type: 'user' | 'system' | 'new' | 'unchanged' | 'unknown';
  confidence: number;  // 0-1
}

interface ChangeEvent {
  type: 'export' | 'import' | 'modify' | 'delete';
  path: string;
  source: ChangeSource;
  diff?: DiffEntry[];
  toolId?: string;
}
```

### 6.2 指纹管理

```typescript
class FingerprintManager {
  private fingerprints: Map<string, FileFingerprint>;

  constructor() {
    this.fingerprints = new Map();
  }

  // 生成指纹
  generate(path: string, content: any): FileFingerprint {
    const hash = this.computeHash(content);
    const serialized = JSON.stringify(content);

    return {
      path,
      hash,
      lastGenerated: new Date().toISOString(),
      generator: VERSION,
      size: serialized.length,
    };
  }

  // 更新指纹
  update(path: string, content: any, isGenerated: boolean): void {
    const fingerprint = this.generate(path, content);
    if (isGenerated) {
      fingerprint.generator = VERSION;
    }
    this.fingerprints.set(path, fingerprint);
  }

  // 验证指纹
  verify(path: string, content: any): FingerprintVerification {
    const stored = this.fingerprints.get(path);
    if (!stored) {
      return { status: 'new', modified: true };
    }

    const currentHash = this.computeHash(content);
    const modified = currentHash !== stored.hash;

    return {
      status: modified ? 'modified' : 'unchanged',
      modified,
      lastGenerated: stored.lastGenerated,
      generatedBy: stored.generator,
    };
  }

  private computeHash(content: any): string {
    // 规范化 JSON 后计算哈希
    const normalized = JSON.stringify(content, Object.keys(content).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
}

interface FingerprintVerification {
  status: 'new' | 'modified' | 'unchanged';
  modified: boolean;
  lastGenerated?: string;
  generatedBy?: string;
}
```

---

## 7. 同步模式

### 7.1 同步模式定义

```typescript
enum SyncMode {
  // 单向：只从 unified 导出到工具
  ONE_WAY_EXPORT = 'one-way-export',

  // 单向：只从工具导入到 unified
  ONE_WAY_IMPORT = 'one-way-import',

  // 双向：自动合并
  TWO_WAY_AUTO = 'two-way-auto',

  // 双向：冲突时询问
  TWO_WAY_INTERACTIVE = 'two-way-interactive',

  // 手动：只报告差异，不执行
  MANUAL = 'manual',

  // 镜像：工具配置完全覆盖 unified
  MIRROR = 'mirror',
}

interface SyncOptions {
  mode: SyncMode;
  tools?: string[];           // 指定工具，空 = 全部
  dryRun: boolean;            // 只预览不执行
  force: boolean;             // 强制覆盖
  backup: boolean;            // 备份原文件
  conflictStrategy?: ResolutionStrategy;
  exclude?: string[];         // 排除的路径
}
```

### 7.2 同步执行器

```typescript
class SyncExecutor {
  private mappers: Map<string, ToolConfigMapper<any>>;
  private changeTracker: ChangeTracker;
  private fingerprintManager: FingerprintManager;
  private conflictDetector: ConflictDetector;
  private conflictResolver: ConflictResolver;

  constructor(deps: SyncExecutorDeps) {
    this.mappers = deps.mappers;
    this.changeTracker = deps.changeTracker;
    this.fingerprintManager = deps.fingerprintManager;
    this.conflictDetector = deps.conflictDetector;
    this.conflictResolver = deps.conflictResolver;
  }

  // 执行同步
  async sync(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = {
      status: 'success',
      timestamp: new Date().toISOString(),
      changes: [],
      conflicts: [],
    };

    // 1. 加载主配置
    const unified = await this.loadUnified();

    // 2. 确定要同步的工具
    const toolsToSync = options.tools ??
      Array.from(this.mappers.keys());

    // 3. 对每个工具执行同步
    for (const toolId of toolsToSync) {
      const mapper = this.mappers.get(toolId);
      if (!mapper) {
        result.warnings?.push(`Unknown tool: ${toolId}`);
        continue;
      }

      try {
        const toolResult = await this.syncTool(
          toolId,
          mapper,
          unified,
          options
        );
        result.changes.push(...toolResult.changes);
        result.conflicts.push(...toolResult.conflicts);
      } catch (error) {
        result.errors?.push({
          toolId,
          error: error.message,
        });
      }
    }

    // 4. 处理冲突
    if (result.conflicts.length > 0) {
      if (options.mode === SyncMode.TWO_WAY_INTERACTIVE) {
        await this.conflictResolver.interactiveResolve(
          result.conflicts,
          this.ui
        );
      } else if (options.conflictStrategy) {
        await this.conflictResolver.autoResolve(result.conflicts);
      }
    }

    // 5. 更新指纹
    await this.fingerprintManager.save();

    return result;
  }

  private async syncTool(
    toolId: string,
    mapper: ToolConfigMapper<any>,
    unified: UnifiedConfig,
    options: SyncOptions
  ): Promise<ToolSyncResult> {
    const result: ToolSyncResult = {
      toolId,
      changes: [],
      conflicts: [],
    };

    const configPath = mapper.configPath;
    const existingFingerprint = this.fingerprintManager.get(configPath);

    switch (options.mode) {
      case SyncMode.ONE_WAY_EXPORT:
        await this.exportToTool(mapper, unified, options);
        break;

      case SyncMode.ONE_WAY_IMPORT:
        await this.importFromTool(mapper, unified, options);
        break;

      case SyncMode.TWO_WAY_AUTO:
      case SyncMode.TWO_WAY_INTERACTIVE:
        const syncResult = await this.bidirectionalSync(
          mapper,
          unified,
          existingFingerprint,
          options
        );
        result.changes = syncResult.changes;
        result.conflicts = syncResult.conflicts;
        break;

      case SyncMode.MANUAL:
        const diff = await this.computeDiff(mapper, unified);
        result.diff = diff;
        break;
    }

    return result;
  }

  // 双向同步
  private async bidirectionalSync(
    mapper: ToolConfigMapper<any>,
    unified: UnifiedConfig,
    existingFingerprint: FileFingerprint | undefined,
    options: SyncOptions
  ): Promise<{ changes: Change[]; conflicts: Conflict[] }> {
    const configPath = mapper.configPath;

    // 1. 检查工具配置是否存在
    const toolConfigExists = await this.fileExists(configPath);
    const toolConfig = toolConfigExists
      ? await this.readJson(configPath)
      : null;

    // 2. 生成期望的工具配置
    const expectedConfig = await mapper.exportFromUnified(unified);

    // 3. 检测工具配置变更
    let toolModified = false;
    if (toolConfig && existingFingerprint) {
      const verification = this.fingerprintManager.verify(
        configPath,
        toolConfig
      );
      toolModified = verification.modified;

      // 检测是用户修改还是系统修改
      const changeSource = await this.changeTracker.detectSource(
        configPath,
        toolConfig
      );

      if (toolModified && changeSource.type === 'user') {
        // 用户修改了工具配置，需要导入回 unified
        const importData = await mapper.importToUnified(toolConfig, unified);

        // 检测冲突
        const diffs = new DiffEngine().deepDiff(expectedConfig, toolConfig);
        const conflicts = this.conflictDetector.detect(diffs, unified.$sync);

        if (conflicts.length > 0) {
          return {
            changes: [],
            conflicts,
          };
        }

        // 合并到 unified
        await this.mergeToUnified(importData, unified);
        return {
          changes: [{ type: 'import', path: configPath }],
          conflicts: [],
        };
      }
    }

    // 4. 导出到工具配置
    if (options.dryRun) {
      return {
        changes: [{ type: 'export', path: configPath, preview: expectedConfig }],
        conflicts: [],
      };
    }

    await this.writeJson(configPath, expectedConfig);
    this.fingerprintManager.update(configPath, expectedConfig, true);

    return {
      changes: [{ type: 'export', path: configPath }],
      conflicts: [],
    };
  }
}
```

---

## 8. CLI 命令设计

### 8.1 命令结构

```
unify-ai <command> [options]

Commands:
  init                  初始化 unified.json
  export [tools...]     导出到工具配置
  import [tools...]     从工具配置导入
  sync                  双向同步
  diff [tool]           查看差异
  status                查看同步状态
  watch                 监听文件变化
  history [path]        查看变更历史
  resolve               解决待处理的冲突
  lock <path>           锁定配置
  unlock <path>         解锁配置
  backup                备份配置
  restore [backup]      恢复配置

Options:
  --mode <mode>         同步模式
  --dry-run             预览不执行
  --force               强制执行
  --no-backup           不创建备份
  --config <path>       指定配置文件路径
```

### 8.2 命令详细设计

```typescript
// CLI 命令定义
const cliCommands: CommandDefinition[] = [
  {
    name: 'init',
    description: 'Initialize unified.json configuration',
    options: [
      { name: 'from', type: 'string', description: 'Import from existing tool config' },
      { name: 'interactive', type: 'boolean', alias: 'i', description: 'Interactive mode' },
    ],
    handler: async (args) => {
      const initializer = new ConfigInitializer();
      await initializer.init({
        fromTool: args.from,
        interactive: args.interactive,
      });
    },
  },

  {
    name: 'export',
    description: 'Export unified config to tool configs',
    options: [
      { name: 'tools', type: 'array', description: 'Target tools (default: all)' },
      { name: 'dry-run', type: 'boolean', description: 'Preview without writing' },
      { name: 'force', type: 'boolean', description: 'Overwrite existing configs' },
    ],
    handler: async (args) => {
      const exporter = new ConfigExporter();
      const result = await exporter.export({
        tools: args.tools,
        dryRun: args['dry-run'],
        force: args.force,
      });
      printExportResult(result);
    },
  },

  {
    name: 'import',
    description: 'Import tool configs into unified.json',
    options: [
      { name: 'tools', type: 'array', description: 'Source tools (default: all)' },
      { name: 'merge', type: 'boolean', description: 'Merge with existing config' },
      { name: 'strategy', type: 'string', enum: ['override', 'merge', 'ask'] },
    ],
    handler: async (args) => {
      const importer = new ConfigImporter();
      const result = await importer.import({
        tools: args.tools,
        merge: args.merge,
        strategy: args.strategy,
      });
      printImportResult(result);
    },
  },

  {
    name: 'sync',
    description: 'Bidirectional sync between unified and tool configs',
    options: [
      { name: 'mode', type: 'string', enum: Object.values(SyncMode) },
      { name: 'tools', type: 'array', description: 'Target tools' },
      { name: 'watch', type: 'boolean', description: 'Watch for changes' },
      { name: 'interval', type: 'number', description: 'Sync interval in seconds' },
    ],
    handler: async (args) => {
      const syncer = new SyncExecutor();

      if (args.watch) {
        // 启动 watch 模式
        const watcher = new ConfigWatcher();
        await watcher.start({
          on_change: async (event) => {
            const result = await syncer.sync({
              mode: args.mode,
              tools: args.tools,
            });
            printSyncResult(result);
          },
          interval: args.interval ?? 5,
        });
      } else {
        // 单次同步
        const result = await syncer.sync({
          mode: args.mode ?? SyncMode.TWO_WAY_INTERACTIVE,
          tools: args.tools,
        });
        printSyncResult(result);
      }
    },
  },

  {
    name: 'diff',
    description: 'Show differences between unified and tool configs',
    options: [
      { name: 'tool', type: 'string', description: 'Specific tool to compare' },
      { name: 'format', type: 'string', enum: ['table', 'json', 'unified'] },
      { name: 'color', type: 'boolean', default: true },
    ],
    handler: async (args) => {
      const differ = new DiffEngine();
      const unified = await loadUnified();
      const diffs = await differ.computeAllDiffs(unified, args.tool);
      printDiffs(diffs, { format: args.format, color: args.color });
    },
  },

  {
    name: 'status',
    description: 'Show sync status and pending conflicts',
    handler: async () => {
      const statusChecker = new StatusChecker();
      const status = await statusChecker.check();
      printStatus(status);
    },
  },

  {
    name: 'watch',
    description: 'Watch for config file changes and auto-sync',
    options: [
      { name: 'debounce', type: 'number', default: 1000 },
      { name: 'mode', type: 'string', enum: Object.values(SyncMode) },
    ],
    handler: async (args) => {
      const watcher = new ConfigWatcher();
      await watcher.start({
        mode: args.mode ?? SyncMode.TWO_WAY_AUTO,
        debounce: args.debounce,
      });
    },
  },

  {
    name: 'resolve',
    description: 'Resolve pending conflicts interactively',
    options: [
      { name: 'all', type: 'boolean', description: 'Resolve all conflicts' },
      { name: 'strategy', type: 'string', enum: Object.values(ResolutionStrategy) },
    ],
    handler: async (args) => {
      const resolver = new ConflictResolver();
      const conflicts = await resolver.getPendingConflicts();

      if (args.strategy) {
        await resolver.batchResolve(conflicts, args.strategy);
      } else {
        await resolver.interactiveResolve(conflicts, new ConsoleUI());
      }
    },
  },

  {
    name: 'history',
    description: 'Show change history',
    options: [
      { name: 'path', type: 'string', description: 'Filter by config path' },
      { name: 'limit', type: 'number', default: 20 },
      { name: 'format', type: 'string', enum: ['table', 'json'] },
    ],
    handler: async (args) => {
      const tracker = new ChangeTracker();
      const history = await tracker.getHistory(args.path, { limit: args.limit });
      printHistory(history, args.format);
    },
  },

  {
    name: 'backup',
    description: 'Backup current configurations',
    options: [
      { name: 'name', type: 'string', description: 'Backup name' },
    ],
    handler: async (args) => {
      const backupManager = new BackupManager();
      const backupId = await backupManager.create(args.name);
      console.log(`Backup created: ${backupId}`);
    },
  },

  {
    name: 'restore',
    description: 'Restore from backup',
    options: [
      { name: 'id', type: 'string', description: 'Backup ID to restore' },
      { name: 'list', type: 'boolean', description: 'List available backups' },
    ],
    handler: async (args) => {
      const backupManager = new BackupManager();

      if (args.list) {
        const backups = await backupManager.list();
        printBackups(backups);
        return;
      }

      await backupManager.restore(args.id);
      console.log(`Restored from backup: ${args.id}`);
    },
  },
];
```

### 8.3 输出格式示例

```typescript
// diff 命令输出
function printDiffs(diffs: DiffResult[], options: PrintOptions) {
  for (const diff of diffs) {
    console.log(`\n${chalk.bold(diff.toolName)} (${diff.configPath})`);
    console.log('─'.repeat(50));

    const table = new Table({
      head: ['Path', 'Type', 'Unified', 'Tool'],
      style: { head: ['cyan'] },
    });

    for (const entry of diff.entries) {
      table.push([
        entry.path,
        colorizeType(entry.type),
        formatValue(entry.unifiedValue),
        formatValue(entry.toolValue),
      ]);
    }

    console.log(table.toString());

    if (diff.hasConflicts) {
      console.log(chalk.yellow(`  ${diff.summary.conflicts} conflict(s) detected`));
    }
  }
}

// sync 命令输出
function printSyncResult(result: SyncResult) {
  console.log(chalk.bold('\nSync Result'));
  console.log('─'.repeat(50));
  console.log(`Status: ${colorizeStatus(result.status)}`);
  console.log(`Time: ${result.timestamp}`);

  if (result.changes.length > 0) {
    console.log('\nChanges:');
    for (const change of result.changes) {
      const icon = change.type === 'export' ? '→' : '←';
      console.log(`  ${icon} ${change.path}`);
    }
  }

  if (result.conflicts.length > 0) {
    console.log(chalk.yellow(`\nConflicts: ${result.conflicts.length}`));
    for (const conflict of result.conflicts) {
      console.log(`  ⚠ ${conflict.path} (${conflict.type})`);
    }
  }
}

// status 命令输出
function printStatus(status: SyncStatus) {
  console.log(chalk.bold('\nUnify-AI Status'));
  console.log('─'.repeat(50));
  console.log(`Config: ${status.configPath}`);
  console.log(`Last Sync: ${status.lastSync}`);
  console.log(`Version: ${status.version}`);

  console.log('\nTool Configs:');
  const table = new Table({
    head: ['Tool', 'Status', 'Last Modified', 'Changes'],
    style: { head: ['cyan'] },
  });

  for (const tool of status.tools) {
    table.push([
      tool.name,
      colorizeSyncStatus(tool.status),
      tool.lastModified,
      tool.pendingChanges,
    ]);
  }

  console.log(table.toString());

  if (status.pendingConflicts > 0) {
    console.log(chalk.yellow(`\n${status.pendingConflicts} conflict(s) pending resolution`));
    console.log('Run `unify-ai resolve` to resolve conflicts');
  }
}
```

---

## 9. 文件监听机制

### 9.1 文件监听器

```typescript
class ConfigWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private options: WatchOptions;

  async start(options: WatchOptions): Promise<void> {
    this.options = options;

    // 监听 unified.json
    const unifiedPath = this.getUnifiedPath();

    // 监听所有工具配置
    const toolPaths = this.getToolConfigPaths();

    const allPaths = [unifiedPath, ...toolPaths];

    this.watcher = watch(
      allPaths,
      {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100,
        },
      }
    );

    this.watcher
      .on('change', (path) => this.handleChange(path))
      .on('add', (path) => this.handleAdd(path))
      .on('unlink', (path) => this.handleUnlink(path))
      .on('error', (error) => this.handleError(error));

    console.log(`Watching ${allPaths.length} config files...`);
  }

  private async handleChange(path: string): Promise<void> {
    // 防抖处理
    const existing = this.debounceTimers.get(path);
    if (existing) {
      clearTimeout(existing);
    }

    this.debounceTimers.set(
      path,
      setTimeout(() => {
        this.debounceTimers.delete(path);
        this.processChange(path);
      }, this.options.debounce ?? 1000)
    );
  }

  private async processChange(path: string): Promise<void> {
    console.log(`Detected change in ${path}`);

    // 1. 确定变更来源
    const source = await this.determineSource(path);

    // 2. 根据来源决定同步方向
    if (source === 'unified') {
      // unified.json 变化，导出到工具
      console.log('Exporting to tool configs...');
      await this.syncExecutor.sync({
        mode: SyncMode.ONE_WAY_EXPORT,
        tools: this.getAffectedTools(path),
      });
    } else {
      // 工具配置变化，检查是否需要导入
      const changeSource = await this.changeTracker.detectSource(path, await this.readJson(path));

      if (changeSource.type === 'user') {
        console.log('User modification detected, importing...');
        await this.syncExecutor.sync({
          mode: SyncMode.ONE_WAY_IMPORT,
          tools: [source],
        });
      }
    }

    // 3. 触发回调
    this.options.on_change?.({ path, source });
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // 清理所有定时器
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}

interface WatchOptions {
  debounce?: number;
  mode?: SyncMode;
  on_change?: (event: WatchEvent) => void;
  on_error?: (error: Error) => void;
}

interface WatchEvent {
  path: string;
  source: string;
}
```

---

## 10. 完整 TypeScript 接口定义

```typescript
// ============================================================================
// 核心类型定义
// ============================================================================

// ---- 配置结构 ----

export interface UnifiedConfig {
  $schema: string;
  $version: string;
  $lastSync: string;
  $syncId: string;
  global: GlobalSettings;
  providers: ProviderConfig[];
  mcpServers: McpServerConfig[];
  tools: ToolsConfig;
  $sync: SyncMetadata;
}

export interface GlobalSettings {
  defaultProvider: string;
  defaultModel: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  permissions?: PermissionSettings;
}

export interface PermissionSettings {
  allow: string[];
  deny: string[];
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl?: string;
  models: ModelConfig[];
}

export type ProviderType = 'anthropic' | 'openai' | 'google' | 'custom';

export interface ModelConfig {
  id: string;
  name: string;
  maxTokens?: number;
  capabilities?: string[];
}

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  tools?: string[];
}

export interface ToolsConfig {
  claude?: ClaudeToolConfig;
  cursor?: CursorToolConfig;
  copilot?: CopilotToolConfig;
  windsurf?: WindsurfToolConfig;
  aider?: AiderToolConfig;
  [key: string]: unknown;
}

// ---- 同步元数据 ----

export interface SyncMetadata {
  version: number;
  lastModified: string;
  modifiedBy: ModificationSource;
  fingerprints: FileFingerprint[];
  history: ChangeRecord[];
  locks: ConfigLock[];
}

export type ModificationSource = 'user' | 'system' | 'import';

export interface FileFingerprint {
  path: string;
  hash: string;
  lastGenerated: string;
  generator: string;
  size: number;
}

export interface ChangeRecord {
  id: string;
  timestamp: string;
  type: ChangeType;
  source: string;
  changes: PropertyChange[];
  resolved?: boolean;
}

export type ChangeType = 'export' | 'import' | 'merge' | 'manual';

export interface PropertyChange {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  source: 'user' | 'system' | 'conflict';
}

export interface ConfigLock {
  path: string;
  reason: string;
  lockedAt: string;
  lockedBy: string;
}

// ---- 差异与冲突 ----

export enum DiffType {
  ADDED = 'added',
  REMOVED = 'removed',
  MODIFIED = 'modified',
  MOVED = 'moved',
}

export interface DiffEntry {
  type: DiffType;
  path: string;
  source: 'unified' | 'tool' | 'both';
  unifiedValue?: unknown;
  toolValue?: unknown;
  timestamp: string;
  toolId?: string;
  toolName?: string;
}

export interface DiffResult {
  toolId: string;
  toolName: string;
  configPath: string;
  entries: DiffEntry[];
  hasConflicts: boolean;
  summary: DiffSummary;
}

export interface DiffSummary {
  added: number;
  removed: number;
  modified: number;
  conflicts: number;
}

export enum ConflictType {
  VALUE_MISMATCH = 'value_mismatch',
  DELETE_MODIFY = 'delete_modify',
  ADD_ADD = 'add_add',
  TYPE_MISMATCH = 'type_mismatch',
  DEPENDENCY = 'dependency',
}

export interface Conflict {
  id: string;
  type: ConflictType;
  path: string;
  unified: ConflictValue;
  tool: ConflictToolValue;
  severity: ConflictSeverity;
  autoResolvable: boolean;
  resolution?: ConflictResolution;
}

export interface ConflictValue {
  value: unknown;
  modifiedAt: string;
  modifiedBy: string;
}

export interface ConflictToolValue extends ConflictValue {
  toolId: string;
  toolName: string;
}

export type ConflictSeverity = 'low' | 'medium' | 'high';

export interface ConflictResolution {
  strategy: ResolutionStrategy;
  resolvedValue: unknown;
  reason: string;
}

export enum ResolutionStrategy {
  UNIFIED_WINS = 'unified_wins',
  TOOL_WINS = 'tool_wins',
  MERGE = 'merge',
  KEEP_BOTH = 'keep_both',
  USER_DECIDE = 'user_decide',
  LATEST = 'latest',
}

// ---- 同步状态与结果 ----

export enum SyncState {
  IDLE = 'idle',
  SCANNING = 'scanning',
  DIFFING = 'diffing',
  RESOLVING = 'resolving',
  SYNCING = 'syncing',
  ERROR = 'error',
  CONFLICT = 'conflict',
}

export enum SyncMode {
  ONE_WAY_EXPORT = 'one-way-export',
  ONE_WAY_IMPORT = 'one-way-import',
  TWO_WAY_AUTO = 'two-way-auto',
  TWO_WAY_INTERACTIVE = 'two-way-interactive',
  MANUAL = 'manual',
  MIRROR = 'mirror',
}

export interface SyncOptions {
  mode: SyncMode;
  tools?: string[];
  dryRun: boolean;
  force: boolean;
  backup: boolean;
  conflictStrategy?: ResolutionStrategy;
  exclude?: string[];
}

export interface SyncResult {
  status: SyncStatus;
  timestamp: string;
  changes: SyncChange[];
  conflicts: Conflict[];
  warnings?: string[];
  errors?: SyncError[];
}

export type SyncStatus = 'success' | 'partial' | 'conflict' | 'error';

export interface SyncChange {
  type: 'export' | 'import' | 'merge' | 'delete';
  path: string;
  toolId?: string;
  preview?: unknown;
}

export interface SyncError {
  toolId: string;
  error: string;
}

export interface SyncStatus {
  configPath: string;
  lastSync: string;
  version: string;
  tools: ToolSyncStatus[];
  pendingConflicts: number;
}

export interface ToolSyncStatus {
  name: string;
  status: 'synced' | 'modified' | 'conflict' | 'missing';
  lastModified: string;
  pendingChanges: number;
}

// ---- 工具映射器 ----

export interface ToolConfigMapper<T> {
  readonly toolId: string;
  readonly toolName: string;
  readonly configPath: string;

  exportFromUnified(unified: UnifiedConfig): Promise<T>;
  importToUnified(config: T, unified: UnifiedConfig): Promise<Partial<UnifiedConfig>>;
  validate(config: T): ValidationResult;
  getDefault(): T;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

// ---- 变更追踪 ----

export interface ChangeSource {
  type: 'user' | 'system' | 'new' | 'unchanged' | 'unknown';
  confidence: number;
}

export interface ChangeEvent {
  id: string;
  type: ChangeType;
  path: string;
  source: ChangeSource;
  diff?: DiffEntry[];
  toolId?: string;
  timestamp: string;
}

// ---- 文件监听 ----

export interface WatchOptions {
  debounce?: number;
  mode?: SyncMode;
  on_change?: (event: WatchEvent) => void;
  on_error?: (error: Error) => void;
}

export interface WatchEvent {
  path: string;
  source: string;
  type: 'change' | 'add' | 'unlink';
}

// ============================================================================
// 服务接口
// ============================================================================

export interface IConfigManager {
  load(): Promise<UnifiedConfig>;
  save(config: UnifiedConfig): Promise<void>;
  validate(config: UnifiedConfig): ValidationResult;
  backup(name?: string): Promise<string>;
  restore(backupId: string): Promise<void>;
}

export interface IDiffEngine {
  deepDiff(unified: unknown, generated: unknown, path?: string): DiffEntry[];
  computeAllDiffs(unified: UnifiedConfig, toolId?: string): Promise<DiffResult[]>;
}

export interface IConflictDetector {
  detect(diffs: DiffEntry[], metadata: SyncMetadata): Conflict[];
}

export interface IConflictResolver {
  autoResolve(conflicts: Conflict[]): Promise<ConflictResolution[]>;
  interactiveResolve(conflicts: Conflict[], ui: IUserInterface): Promise<ConflictResolution[]>;
}

export interface IChangeTracker {
  recordChange(change: ChangeEvent): Promise<void>;
  getHistory(path: string, options?: HistoryOptions): Promise<ChangeRecord[]>;
  detectSource(path: string, content: unknown): Promise<ChangeSource>;
}

export interface IFingerprintManager {
  generate(path: string, content: unknown): FileFingerprint;
  update(path: string, content: unknown, isGenerated: boolean): void;
  verify(path: string, content: unknown): FingerprintVerification;
  get(path: string): FileFingerprint | undefined;
  save(): Promise<void>;
}

export interface ISyncExecutor {
  sync(options: SyncOptions): Promise<SyncResult>;
}

export interface IConfigWatcher {
  start(options: WatchOptions): Promise<void>;
  stop(): Promise<void>;
}

export interface IUserInterface {
  promptConflictResolution(conflict: Conflict, options: PromptOptions): Promise<unknown>;
  promptInput(message: string): Promise<string>;
  confirm(message: string): Promise<boolean>;
  select(message: string, options: SelectOption[]): Promise<string>;
}

export interface PromptOptions {
  options: SelectOption[];
  showDiff?: boolean;
}

export interface SelectOption {
  label: string;
  value: unknown;
  description?: string;
}

export interface HistoryOptions {
  limit?: number;
  since?: string;
}

export interface FingerprintVerification {
  status: 'new' | 'modified' | 'unchanged';
  modified: boolean;
  lastGenerated?: string;
  generatedBy?: string;
}

// ============================================================================
// 工具特定配置
// ============================================================================

export interface ClaudeToolConfig {
  permissions: {
    allow: string[];
    deny: string[];
  };
  mcpServers?: McpServerConfig[];
  defaultModel?: string;
}

export interface CursorToolConfig {
  models: {
    default: string;
    codebase: string;
  };
  rules: string[];
  mcp?: McpServerConfig[];
}

export interface CopilotToolConfig {
  model: string;
  instructions?: string;
  suggestions?: {
    enabled: boolean;
    providers?: string[];
  };
}

export interface WindsurfToolConfig {
  models: {
    chat: string;
    code: string;
  };
  context?: {
    files?: string[];
    exclude?: string[];
  };
}

export interface AiderToolConfig {
  model: string;
  editor?: string;
  commands?: Record<string, string>;
}
```

---

## 11. 实现路线图

### Phase 1: 核心基础设施

1. 配置结构与验证
   - UnifiedConfig 类型定义
   - JSON Schema 验证
   - 配置加载/保存

2. 工具映射器框架
   - ToolConfigMapper 接口
   - Claude Code 映射器实现
   - Cursor 映射器实现

### Phase 2: 差异与冲突

3. Diff 引擎
   - 深度比较算法
   - 差异报告生成
   - Diff 格式化输出

4. 冲突检测与解决
   - 冲突类型定义
   - 自动解决策略
   - 交互式解决

### Phase 3: 同步引擎

5. 同步执行器
   - 单向导出/导入
   - 双向同步
   - 变更追踪

6. 指纹管理
   - 文件哈希计算
   - 变更检测
   - 版本追踪

### Phase 4: CLI 与监听

7. CLI 命令
   - init/export/import
   - sync/diff/status
   - resolve/history/backup

8. 文件监听
   - Watch 模式
   - 防抖处理
   - 自动同步

---

## 12. 使用示例

### 12.1 初始化配置

```bash
# 交互式创建
unify-ai init --interactive

# 从现有 Claude Code 配置导入
unify-ai init --from claude

# 从 Cursor 配置导入
unify-ai init --from cursor
```

### 12.2 导出配置

```bash
# 导出到所有工具
unify-ai export

# 只导出到 Claude Code 和 Cursor
unify-ai export claude cursor

# 预览变更
unify-ai export --dry-run
```

### 12.3 导入配置

```bash
# 从 Cursor 导入
unify-ai import cursor

# 从所有工具合并
unify-ai import --merge
```

### 12.4 双向同步

```bash
# 交互式同步
unify-ai sync

# 自动同步（无冲突时）
unify-ai sync --mode two-way-auto

# 启动监听
unify-ai watch
```

### 12.5 查看状态

```bash
# 同步状态
unify-ai status

# 查看差异
unify-ai diff

# 查看特定工具差异
unify-ai diff claude

# 变更历史
unify-ai history mcpServers
```

### 12.6 冲突解决

```bash
# 交互式解决冲突
unify-ai resolve

# 使用策略批量解决
unify-ai resolve --all --strategy latest
```

---

## 13. 总结

本设计文档定义了 unify-ai 项目的完整双向转换和同步机制：

1. **状态机模型**: 清晰的同步状态流转
2. **差异检测**: 深度比较算法，精确识别变更
3. **冲突处理**: 多种策略 + 交互式解决
4. **变更追踪**: 区分用户修改与系统修改
5. **同步模式**: 支持单向、双向、手动等多种模式
6. **CLI 设计**: 完整的命令行工具
7. **类型系统**: 完整的 TypeScript 接口定义

这套机制确保 unified.json 作为单一真相源，同时支持用户在各工具中灵活修改配置，并能智能地合并和处理冲突。
