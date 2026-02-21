# 工具隔离架构重新设计分析报告

> **目标**: 基于用户反馈重新思考工具隔离的架构和交互设计
> **分析日期**: 2026-02-21
> **分析方法**: 深度调研 + 架构评估 + 风险分析

---

## 📋 执行摘要

用户选择了 **方案 A: 工具隔离模式**，但在实施前需要重新审视架构设计和交互模式，确保：

1. **用户价值清晰**: 工具隔离解决什么问题？
2. **交互直观**: 用户如何理解和操作工具隔离？
3. **架构合理**: 数据库设计是否最优？
4. **迁移风险可控**: 如何平滑升级？

---

## 一、核心问题重新定义

### 1.1 为什么要工具隔离？

**CC-Switch 的设计初衷**:
```
场景: 用户同时使用 Claude Code 和 Codex

工具隔离前:
- 全局共享 OpenAI 供应商
- Claude Code 被迫使用 OpenAI (不符合工具特性)
- Codex 被迫使用 Anthropic (浪费 GPT-4 优势)

工具隔离后:
- Claude Code 使用 Anthropic (Claude 模型原生支持)
- Codex 使用 OpenAI (GPT-4 模型原生支持)
- 每个工具配置最适合的供应商
```

**unify-ai 的实际情况**:
- 支持 9 个工具 (vs CC-Switch 的 3 个)
- 工具类型多样 (IDE 集成 vs CLI 工具)
- 用户场景更复杂

### 1.2 真正的用户需求是什么？

**假设 1**: 用户需要为每个工具配置不同供应商
- ✅ 真实场景: Claude Code 用 Anthropic, Codex 用 OpenAI
- ❌ 不真实场景: Cursor 用 OpenAI, Windsurf 也用 OpenAI (重复配置)

**假设 2**: 用户希望一次配置,多工具复用
- ✅ 真实场景: OpenRouter 聚合器在多个工具中使用相同配置
- ❌ 不真实场景: 每个工具都需要重新配置 (效率低)

**假设 3**: 用户希望灵活选择配置模式
- ✅ 真实场景: 部分供应商全局共享,部分工具特定
- ✅ 最佳方案: 混合模式

---

## 二、架构重新设计

### 2.1 方案对比

| 方案 | 描述 | 优势 | 劣势 | 适用场景 |
|------|------|------|------|---------|
| **A. 纯工具隔离** | 每个工具完全独立的供应商列表 | ✅ 清晰隔离<br>✅ 灵活配置 | ❌ 重复配置<br>❌ 维护成本高 | 工具差异大 |
| **B. 全局共享** | 所有工具共享供应商列表 | ✅ 一次配置<br>✅ 维护简单 | ❌ 无法工具特定 | 工具相似度高 |
| **C. 混合模式** | 全局供应商 + 工具级别覆盖 | ✅ 兼顾复用和灵活<br>✅ 最优用户体验 | ❌ 逻辑复杂<br>❌ 学习曲线 | 实际需求 |

### 2.2 推荐方案: **C. 混合模式**

**核心理念**:
```
全局供应商 (Global Providers)
  ├─ OpenRouter (一次配置,多工具复用)
  ├─ Anthropic (官方供应商)
  └─ OpenAI (官方供应商)

工具级别覆盖 (Tool-specific Overrides)
  ├─ Claude Code
  │   └─ 覆盖: 使用 Anthropic (而非全局的 OpenRouter)
  ├─ Codex
  │   └─ 覆盖: 使用 OpenAI (而非全局的 OpenRouter)
  └─ Cursor
      └─ 继承: 使用全局 OpenRouter (无覆盖)
```

**优先级规则**:
```
工具级别覆盖 > 全局配置 > 默认值

示例:
1. 用户查询 Cursor 的当前供应商
   → Cursor 有覆盖? No
   → 使用全局默认供应商 OpenRouter

2. 用户查询 Claude Code 的当前供应商
   → Claude Code 有覆盖? Yes (Anthropic)
   → 使用工具覆盖供应商 Anthropic
```

### 2.3 数据库设计 (混合模式)

#### Schema 设计

```sql
-- 供应商表 (支持全局 + 工具级别)
CREATE TABLE providers (
  id TEXT NOT NULL,
  tool_id TEXT,                       -- NULL 表示全局供应商
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  config TEXT,
  models TEXT,
  default_model TEXT,
  base_url TEXT,
  is_global INTEGER DEFAULT 0,        -- 是否为全局供应商
  is_current_global INTEGER DEFAULT 0,-- 全局当前供应商 (仅全局供应商)
  is_current_tool INTEGER DEFAULT 0,  -- 工具当前供应商 (仅工具供应商)
  sort_index INTEGER,
  category TEXT DEFAULT 'third-party',
  notes TEXT,
  meta TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, COALESCE(tool_id, 'global'))  -- 允许同名全局 + 工具供应商
);

-- 索引优化
CREATE INDEX idx_providers_global ON providers(is_global, is_current_global, priority DESC);
CREATE INDEX idx_providers_tool ON providers(tool_id, is_current_tool, priority DESC)
  WHERE tool_id IS NOT NULL;
```

**关键设计**:
- `tool_id` 为 NULL 表示全局供应商
- `is_global` 标记全局供应商
- `is_current_global` 全局当前供应商
- `is_current_tool` 工具级别当前供应商

#### 查询逻辑

```typescript
// 获取工具的当前供应商 (优先级: 工具覆盖 > 全局默认)
async getCurrentProvider(toolId: string): Promise<AIProvider | null> {
  // 1. 查找工具级别当前供应商
  const toolProvider = await this.db.get(`
    SELECT * FROM providers
    WHERE tool_id = ? AND is_current_tool = 1
    LIMIT 1
  `, [toolId]);

  if (toolProvider) {
    return rowToProvider(toolProvider);
  }

  // 2. 回退到全局当前供应商
  const globalProvider = await this.db.get(`
    SELECT * FROM providers
    WHERE is_global = 1 AND is_current_global = 1
    LIMIT 1
  `);

  return globalProvider ? rowToProvider(globalProvider) : null;
}
```

---

## 三、交互设计重新思考

### 3.1 用户心理模型

**用户的期望**:
```
1. 添加 OpenRouter 供应商
   → 所有工具都能用 (全局)

2. 发现 Claude Code 用 OpenRouter 效果不好
   → 为 Claude Code 配置 Anthropic (工具覆盖)

3. 其他工具继续使用 OpenRouter (全局)
```

**关键洞察**:
- 用户希望"默认全局,按需覆盖"
- 而非"每个工具独立配置"

### 3.2 UI 设计方案

#### 方案 1: 三栏布局 + 全局/工具切换

```
┌─────────────────────────────────────────────────────┐
│ [Global] [Claude Code] [Codex] [Cursor] [Windsurf] │  ← 工具切换器
└─────────────────────────────────────────────────────┘
┌───────────────┬─────────────────────┬───────────────┐
│ Providers     │ Detail              │ Usage         │
│               │                     │               │
│ ✓ OpenRouter  │ Name: OpenRouter    │ Total: $12.45 │
│   Anthropic   │ Type: Aggregator    │ Requests: 847 │
│   OpenAI      │ Base URL: ...       │               │
│               │ [Set as Global Default]             │ │
│               │                     │               │
│               │ Tool Overrides:     │               │
│               │ • Claude Code: Anthropic ✓         │ │
│               │ • Codex: OpenAI ✓                  │ │
│               │ • Others: Use Global               │ │
└───────────────┴─────────────────────┴───────────────┘
```

**交互流程**:
1. 用户在 Global 标签页配置全局供应商
2. 点击工具标签页查看工具级别覆盖
3. 在工具标签页"覆盖"全局供应商

#### 方案 2: 供应商卡片 + 应用范围选择

```
┌─────────────────────────────────────────────────────┐
│ Add Provider                                        │
├─────────────────────────────────────────────────────┤
│ Name: OpenRouter                                    │
│ Base URL: https://openrouter.ai/api                │
│ API Key: •••••••••••                               │
│                                                     │
│ Apply to:                                           │
│ ☑ Global Default (all tools)                       │
│ ☑ Claude Code (override)                           │
│ ☐ Codex (use global)                               │
│ ☑ Cursor (override)                                │
│ ☐ Windsurf (use global)                            │
│                                                     │
│ [Cancel] [Save]                                     │
└─────────────────────────────────────────────────────┘
```

**交互流程**:
1. 用户配置供应商
2. 勾选"Global Default"作为全局默认
3. 额外勾选特定工具进行覆盖

### 3.3 推荐交互方案: **方案 2**

**理由**:
- ✅ 符合用户心理模型 ("一次配置,按需覆盖")
- ✅ 避免重复配置 (全局 + 工具复用)
- ✅ 清晰可见影响范围 (勾选框)
- ✅ 支持批量操作 (一次应用到多个工具)

---

## 四、风险评估

### 4.1 高风险项

#### 风险 1: 用户混淆全局 vs 工具级别

**场景**: 用户在 Global 标签页配置了 OpenRouter,但在 Claude Code 标签页看不到

**缓解措施**:
1. **UI 提示**: 工具标签页显示"Using global provider: OpenRouter"
2. **引导流程**: 首次使用时引导用户理解全局/工具关系
3. **智能默认**: 默认显示全局供应商,带覆盖按钮

#### 风险 2: 优先级规则不清晰

**场景**: 用户配置了全局 OpenRouter + 工具 Anthropic,不知道哪个生效

**缓解措施**:
1. **实时预览**: 显示"Current provider for Claude Code: Anthropic (override)"
2. **视觉指示**: 工具供应商卡片标记"Override"徽章
3. **冲突提示**: 当全局和工具供应商冲突时弹出提示

#### 风险 3: 数据迁移复杂度

**场景**: 现有用户只有全局供应商,迁移后如何处理?

**缓解策略**:
```sql
-- 迁移策略: 所有现有供应商转为全局供应商
INSERT INTO providers_new (id, tool_id, is_global, is_current_global, ...)
SELECT id, NULL, 1, is_current, ...  -- tool_id = NULL, is_global = 1
FROM providers;
```

### 4.2 中等风险项

#### 风险 4: API Key 管理复杂化

**问题**: 全局供应商的 API Key 如何与工具级别共享?

**解决方案**:
```sql
-- API Keys 表设计
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  tool_id TEXT,                       -- NULL 表示全局 Key
  key_name TEXT DEFAULT 'primary',
  encrypted_key BLOB NOT NULL,
  ...
);

-- 查询逻辑: 工具级别 Key > 全局 Key
async getAPIKey(providerId: string, toolId: string): Promise<string | null> {
  // 1. 查找工具级别 Key
  const toolKey = await this.db.get(`
    SELECT * FROM api_keys
    WHERE provider_id = ? AND tool_id = ?
  `, [providerId, toolId]);

  if (toolKey) return decrypt(toolKey);

  // 2. 回退到全局 Key
  const globalKey = await this.db.get(`
    SELECT * FROM api_keys
    WHERE provider_id = ? AND tool_id IS NULL
  `, [providerId]);

  return globalKey ? decrypt(globalKey) : null;
}
```

---

## 五、实施建议

### 5.1 分阶段实施

**Phase 2A-1: 数据层支持 (Week 1-2)**
- [ ] 更新数据库 schema (支持 NULL tool_id)
- [ ] 实现全局/工具优先级查询
- [ ] 迁移现有数据为全局供应商
- [ ] 编写迁移脚本和验证

**Phase 2A-2: API 层实现 (Week 3-4)**
- [ ] ModelManager 支持全局/工具级别
- [ ] getCurrentProvider(toolId) 优先级逻辑
- [ ] setGlobalDefaultProvider() API
- [ ] setToolOverride() API

**Phase 2A-3: GUI 实现 (Week 5-6)**
- [ ] 供应商卡片 + 应用范围选择
- [ ] 工具标签页显示"Using global provider"
- [ ] 覆盖/继承切换 UI
- [ ] 实时预览和冲突提示

**Phase 2A-4: 测试和优化 (Week 7-8)**
- [ ] 单元测试 (优先级逻辑)
- [ ] 集成测试 (迁移脚本)
- [ ] 用户验收测试 (UAT)
- [ ] 性能优化

### 5.2 技术决策

| 决策点 | 推荐方案 | 理由 |
|--------|---------|------|
| **NULL tool_id 语义** | 表示全局供应商 | 符合 SQL 标准,查询简洁 |
| **优先级规则** | 工具 > 全局 > 默认 | 符合用户预期 |
| **API Key 共享** | 工具级别 Key > 全局 Key | 支持工具特定 Key |
| **UI 模式** | 供应商卡片 + 应用范围选择 | 符合用户心理模型 |
| **迁移策略** | 现有数据 → 全局供应商 | 向后兼容 |

---

## 六、关键文件清单

### 6.1 数据层

1. `packages/core/src/model/Database.ts`
   - 更新 schema DDL
   - 添加全局/工具索引

2. `packages/core/src/model/migrations/002_add_global_providers.ts`
   - 迁移脚本 (新增)
   - 支持全局供应商

3. `packages/core/src/model/types.ts`
   - 更新 AIProvider 接口
   - 添加 isGlobal, toolId 字段

### 6.2 API 层

4. `packages/core/src/model/ModelManager.ts`
   - getCurrentProvider(toolId) 优先级逻辑
   - setGlobalDefaultProvider() API
   - setToolOverrideProvider() API

5. `packages/core/src/model/EncryptionManager.ts`
   - getAPIKey() 支持全局/工具优先级

### 6.3 GUI 层

6. `packages/gui/src/components/model/AddProviderDialog.tsx`
   - 添加"Apply to"应用范围选择
   - 全局/工具复选框

7. `packages/gui/src/components/model/ProviderCard.tsx`
   - 显示"Global"或"Tool Override"徽章
   - 显示"Using global provider: X"

8. `packages/gui/src/pages/Models.tsx`
   - 工具标签页显示全局供应商继承状态

---

## 七、验收标准

### 功能验收

- [ ] 支持全局供应商 (tool_id = NULL)
- [ ] 支持工具级别覆盖 (tool_id = 'xxx')
- [ ] 优先级规则正确 (工具 > 全局)
- [ ] UI 显示全局/工具状态
- [ ] API Key 支持全局/工具优先级
- [ ] 迁移脚本正确转换现有数据

### UX 验收

- [ ] 用户能理解"全局 vs 工具"概念
- [ ] "Apply to"复选框交互直观
- [ ] 工具标签页清晰显示"Using global provider"
- [ ] 覆盖操作有明确反馈
- [ ] 冲突提示清晰易懂

### 性能验收

- [ ] getCurrentProvider() < 10ms (有索引)
- [ ] 迁移 1000 供应商 < 5s
- [ ] UI 切换工具标签 < 100ms

---

## 八、后续优化方向

### 8.1 短期优化 (Phase 2B)

1. **智能推荐**: 根据工具类型推荐最适合的供应商
   - Claude Code → Anthropic
   - Codex → OpenAI
   - Cursor → OpenRouter (aggregator)

2. **批量配置**: 一次配置应用到多个工具
   - "Apply to all code editors" (Cursor + Windsurf + Continue)
   - "Apply to all CLI tools" (Claude Code + Codex + Aider)

### 8.2 长期优化 (Phase 3)

1. **配置模板**: 预设常见配置组合
   - "Code Editing Mode": Cursor (OpenRouter) + Windsurf (OpenRouter)
   - "CLI Power User": Claude Code (Anthropic) + Codex (OpenAI)

2. **云同步**: 全局供应商配置云端同步
   - 团队共享全局供应商
   - 个人工具级别覆盖

---

## 九、决策矩阵

| 决策点 | 选项 A | 选项 B | 推荐 | 理由 |
|--------|--------|--------|------|------|
| **隔离模式** | 纯工具隔离 | 混合模式 (全局+覆盖) | **B** | 用户心理模型匹配 |
| **UI 模式** | 工具标签页 | 供应商卡片+应用范围 | **B** | 一次配置,按需覆盖 |
| **NULL tool_id** | 禁止 | 表示全局 | **允许** | SQL 标准,查询简洁 |
| **API Key 共享** | 每个工具独立 | 工具 > 全局优先级 | **B** | 灵活且复用 |
| **迁移策略** | 转为工具级别 | 转为全局供应商 | **B** | 向后兼容 |

---

**报告完成日期**: 2026-02-21
**下次评审**: 实施前评审 (预计 2026-02-22)
**负责人**: 架构团队
**批准人**: 技术负责人
