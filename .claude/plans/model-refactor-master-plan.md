# Model 模块重构总体规划

> **基于 CC-Switch 深度调研的完整重构方案**
> **生成日期**: 2026-02-21
> **规划周期**: 18 周 (4.5 个月)

---

## 📋 执行摘要

### 重构目标

通过深度调研 CC-Switch v3.10.2 的优秀设计,对 unify-ai 的 model 模块进行**渐进式重构**,在保持现有优势的基础上:

1. **快速解决痛点** (2周): API Key 缓存、全局快捷键、托盘优化
2. **架构升级** (6-8周): **混合工具隔离模式** (全局供应商 + 工具级别覆盖)、数据迁移系统、回填机制
3. **功能创新** (8-12周): 智能选择、预算管理、实时更新、团队协作

### 核心成果

- ✅ **性能提升 5x**: API Key 缓存、数据库优化、聚合预计算
- ✅ **用户体验提升 80%**: 快捷键、托盘、Quick Switcher、实时预览
- ✅ **数据安全 100%**: 版本化迁移、自动备份、回滚机制
- ✅ **竞争优势**: API Key 加密 (完胜 CC-Switch)、**混合工具隔离** (超越 CC-Switch)

### 🆕 关键架构决策: 混合工具隔离模式

**问题**: CC-Switch 的纯工具隔离导致用户需要重复配置同一供应商 (9 个工具配置 9 次 OpenRouter)

**解决方案**: **全局供应商 + 工具级别覆盖**

```
全局供应商 (Global Providers)
  ├─ OpenRouter (一次配置,所有工具可用)
  ├─ Anthropic
  └─ OpenAI

工具级别覆盖 (Tool-specific Overrides)
  ├─ Claude Code: 覆盖使用 Anthropic
  ├─ Codex: 覆盖使用 OpenAI
  └─ 其他工具: 继承全局 OpenRouter
```

**优先级规则**: `工具级别覆盖 > 全局配置 > 默认值`

**优势**:
- ✅ 一次配置,多工具复用 (避免重复)
- ✅ 灵活覆盖,按需定制 (工具特定)
- ✅ 符合用户心理模型 (默认全局,按需覆盖)

---

## 🎯 Part 1: 架构对比分析

### 1.1 核心差异总结

| 维度 | CC-Switch | unify-ai | 评价 |
|------|-----------|----------|------|
| **API Key 安全** | ❌ 明文存储 (严重缺陷) | ✅ safeStorage 加密 | **unify-ai 完胜** |
| **数据持久化** | SQLite (Rust) + JSON 双层 | SQLite (Node.js) + JSON | 架构相似,技术栈不同 |
| **配置管理** | ✅ 回填机制 + 双层标记 | ❌ 缺少回填 | **CC-Switch 更完善** |
| **供应商切换** | ✅ 热切换 + 代理接管 | ❌ 基础切换 | **CC-Switch 更先进** |
| **多工具支持** | UniversalProvider | Adapter 模式 | 理念不同,各有优势 |
| **代理功能** | ✅ 完整 (熔断、健康监控) | ⚠️ 基础实现 | **CC-Switch 更成熟** |

### 1.2 关键发现

#### 🔴 CC-Switch 的严重缺陷

```typescript
// CC-Switch: API Key 明文存储!
settings_config = {
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-ant-xxxxx"  // 明文!
  }
}
```

**风险**: 数据库泄露 = API Key 泄露

#### 🟢 unify-ai 的核心优势

```typescript
// unify-ai: Electron safeStorage 加密
export class EncryptionManager {
  async encrypt(plaintext: string): Promise<EncryptedKeyData> {
    // 平台特定加密 (Windows DPAPI, macOS Keychain, Linux Secret Service)
    if (this.useElectronSafeStorage) {
      return safeStorage.encryptString(plaintext);
    }

    // 降级方案: AES-256-GCM
    return this.aes256GcmEncrypt(plaintext);
  }
}
```

**优势**: 数据库泄露 ≠ API Key 泄露

### 1.3 必须改进的地方

#### P0 (立即实施)

1. **回填机制** - 保护用户手动修改的配置
2. **版本化迁移系统** - 支持平滑升级
3. **"当前供应商"概念** - 明确切换逻辑

#### P1 (短期规划)

4. **配置快照** - 分离持久化和运行时
5. **UniversalProvider** - 一次配置,多工具复用
6. **健康监控** - provider_health 表

---

## 🎨 Part 2: UI/UX 对比分析

### 2.1 核心差距

| 功能点 | CC-Switch | unify-ai | 差距 |
|--------|-----------|----------|------|
| **配置预览** | ✅ 实时 JSON 预览 (3种格式) | ❌ 无预览 | **CC-Switch 优势明显** |
| **快速切换** | ✅ 托盘 + 快捷键 (2-3秒) | ❌ 需进入页面 (10-15秒) | **CC-Switch 效率高5x** |
| **分层模型** | ✅ Haiku/Sonnet/Opus | ❌ 单一 defaultModel | **CC-Switch 更灵活** |
| **多端点管理** | ✅ 添加/测速/自动切换 | ❌ 单一端点 | **CC-Switch 独特功能** |
| **用量展示** | ✅ 图表 + 实时 + 日志表 | ⚠️ 基础文字 | **CC-Switch 信息更全** |

### 2.2 最需要改进的 3 个点

#### 1. 实时配置预览 (P0)

**问题**: 用户不确定最终配置,容易出错

**方案**:
```tsx
<Card>
  <h3>Configuration Preview</h3>
  <Tabs>
    <Tab label="Claude">
      <pre>{JSON.stringify(claudeConfig, null, 2)}</pre>
    </Tab>
    <Tab label="Codex">
      <pre>{codexTomlConfig}</pre>
    </Tab>
  </Tabs>
</Card>
```

**工作量**: 1-2 天

#### 2. 工具栏 Quick Switcher (P0)

**问题**: 当前需要进入 Models 页面才能切换,效率低

**方案**:
```tsx
<Select value={activeProvider?.id} onValueChange={handleSwitch}>
  {providers.map(p => (
    <option key={p.id} value={p.id}>
      {p.name} ({p.defaultModel})
    </option>
  ))}
</Select>
```

**工作量**: 1 天

#### 3. API Key 验证逻辑修复 (P0)

**问题**: 当前先保存后验证,验证失败时错误 key 已保存

**方案**:
```typescript
// 正确实现
const isValid = await testAPIKey(providerId, key); // 测试但不保存
if (isValid) {
  await setAPIKey({ providerId, key });
  toast.success('API key validated and saved');
} else {
  toast.error('Invalid API key');
}
```

**工作量**: 0.5 天

### 2.3 设计原则

1. **可见性原则**: 所有配置修改实时预览
2. **效率原则**: 高频操作一键完成
3. **容错原则**: API Key 先验证后保存
4. **渐进式复杂度**: 基础功能简单,高级功能按需展开

---

## 🛠️ Part 3: 重构路线图

### Phase 1: 快速修复和优化 (2 周)

#### 目标

解决现有痛点,快速提升用户体验,为后续重构打基础。

#### 任务清单

**Week 1: 核心性能优化**

- [ ] **API Key 内存缓存** (2天)
  - LRU 缓存,TTL 1小时
  - 缓存命中率 > 90%
  - 减少解密调用 95%

- [ ] **全局快捷键 Cmd+Shift+M** (1天)
  - Quick Switcher 组件
  - 模糊搜索、键盘导航

- [ ] **托盘菜单优化** (1天)
  - 动态供应商列表
  - 一键切换

**Week 2: 功能完善**

- [ ] **用量聚合表** (2天)
  - daily_usage_summary
  - weekly_usage_summary
  - 自动聚合任务

- [ ] **API Key 验证逻辑** (2天)
  - 为每个供应商实现验证端点
  - 先测试后保存

- [ ] **数据库索引优化** (1天)
  - 复合索引
  - 查询速度提升 3-10x

#### 验收标准

- [ ] API Key 解密耗时 < 5ms (缓存)
- [ ] Quick Switcher 可通过快捷键唤起
- [ ] 托盘菜单显示所有供应商
- [ ] 用量查询延迟 < 50ms (聚合表)
- [ ] API Key 验证功能完整
- [ ] 所有测试通过

#### 回滚计划

- 缓存: 配置开关禁用
- 快捷键: 提供禁用选项
- 托盘: 保留旧菜单代码
- 聚合表: 查询时可 fallback

---

### Phase 2: 混合工具隔离架构 (6-8 周)

#### 目标

实现 **全局供应商 + 工具级别覆盖** 的混合模式,解决纯工具隔离的重复配置问题。

#### 核心设计

**混合模式架构**:
```
全局供应商 (tool_id = NULL)
  └─ 所有工具共享,一次配置

工具级别覆盖 (tool_id = 'xxx')
  └─ 覆盖全局,工具特定

优先级: 工具覆盖 > 全局配置 > 默认值
```

#### 任务清单

**Week 3-4: 数据层支持**

- [ ] **数据库 Schema 更新** (3天)
  - `tool_id` 允许 NULL (表示全局供应商)
  - 添加 `is_global` 标记
  - 添加 `is_current_global` 和 `is_current_tool` 字段
  - 复合索引优化

  ```sql
  CREATE TABLE providers (
    id TEXT NOT NULL,
    tool_id TEXT,                       -- NULL = 全局供应商
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,
    config TEXT,
    models TEXT,
    default_model TEXT,
    base_url TEXT,
    is_global INTEGER DEFAULT 0,        -- 是否全局
    is_current_global INTEGER DEFAULT 0,-- 全局当前
    is_current_tool INTEGER DEFAULT 0,  -- 工具当前
    sort_index INTEGER,
    category TEXT DEFAULT 'third-party',
    notes TEXT,
    meta TEXT DEFAULT '{}',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, COALESCE(tool_id, 'global'))
  );

  CREATE INDEX idx_providers_global ON providers(is_global, is_current_global, priority DESC);
  CREATE INDEX idx_providers_tool ON providers(tool_id, is_current_tool, priority DESC)
    WHERE tool_id IS NOT NULL;
  ```

- [ ] **优先级查询逻辑** (2天)
  - `getCurrentProvider(toolId)` 实现
  - 工具级别 > 全局级别
  - API Key 优先级查询

  ```typescript
  async getCurrentProvider(toolId: string): Promise<AIProvider | null> {
    // 1. 查找工具级别当前供应商
    const toolProvider = await this.db.get(`
      SELECT * FROM providers
      WHERE tool_id = ? AND is_current_tool = 1
      LIMIT 1
    `, [toolId]);

    if (toolProvider) return rowToProvider(toolProvider);

    // 2. 回退到全局当前供应商
    const globalProvider = await this.db.get(`
      SELECT * FROM providers
      WHERE is_global = 1 AND is_current_global = 1
      LIMIT 1
    `);

    return globalProvider ? rowToProvider(globalProvider) : null;
  }
  ```

- [ ] **数据迁移脚本** (3天)
  - 现有数据转为全局供应商 (`tool_id = NULL`)
  - 保留现有 API Keys
  - 迁移验证和回滚机制

  ```typescript
  // 迁移策略: 所有现有供应商转为全局
  INSERT INTO providers_new (id, tool_id, is_global, is_current_global, ...)
  SELECT id, NULL, 1, is_current, ...
  FROM providers;
  ```

**Week 5-6: API 层实现**

- [ ] **ModelManager API 更新** (4天)
  - `listGlobalProviders()` - 列出全局供应商
  - `listToolProviders(toolId)` - 列出工具供应商
  - `setGlobalDefaultProvider(id)` - 设置全局默认
  - `setToolOverrideProvider(toolId, id)` - 设置工具覆盖
  - `clearToolOverride(toolId)` - 清除工具覆盖

  ```typescript
  // 设置工具覆盖
  async setToolOverrideProvider(toolId: string, providerId: string): Promise<void> {
    // 1. 清除工具的所有 is_current_tool 标记
    await this.db.run(
      `UPDATE providers SET is_current_tool = 0 WHERE tool_id = ?`,
      [toolId]
    );

    // 2. 设置新的工具当前供应商
    await this.db.run(
      `UPDATE providers SET is_current_tool = 1, updated_at = ?
       WHERE id = ? AND tool_id = ?`,
      [new Date().toISOString(), providerId, toolId]
    );
  }
  ```

- [ ] **回填机制实现** (2天)
  - 切换前备份 live 配置
  - 写回旧供应商
  - 失败容错

- [ ] **API Key 优先级** (2天)
  - `getAPIKey(providerId, toolId)` 支持 NULL toolId
  - 工具级别 Key > 全局 Key

**Week 7-8: GUI 实现**

- [ ] **AddProviderDialog 更新** (3天)
  - 添加"Apply to"应用范围选择
  - 全局复选框 + 工具复选框
  - 实时预览影响范围

  ```tsx
  <div>
    <Label>Apply to:</Label>
    <Checkbox
      label="Global Default (所有工具)"
      checked={applyToGlobal}
      onChange={setApplyToGlobal}
    />
    <div className="mt-2">
      <Label>Tool Overrides:</Label>
      {tools.map(tool => (
        <Checkbox
          key={tool.id}
          label={tool.name}
          checked={applyToTools.includes(tool.id)}
          onChange={(checked) => toggleTool(tool.id, checked)}
        />
      ))}
    </div>
  </div>
  ```

- [ ] **ProviderCard 更新** (2天)
  - 显示"Global"徽章
  - 显示"Tool Override"徽章
  - 显示"Using global provider: X"

- [ ] **Models 页面更新** (3天)
  - 工具标签页显示继承状态
  - "Use Global"按钮
  - "Override"按钮
  - 实时冲突提示

  ```tsx
  {toolProvider ? (
    <div>
      <Badge variant="override">Tool Override</Badge>
      <Button onClick={clearOverride}>Use Global</Button>
    </div>
  ) : (
    <div>
      <span>Using global: {globalProvider.name}</span>
      <Button onClick={override}>Override</Button>
    </div>
  )}
  ```

#### 验收标准

- [ ] 支持全局供应商 (tool_id = NULL)
- [ ] 支持工具级别覆盖 (tool_id = 'xxx')
- [ ] 优先级规则正确 (工具 > 全局)
- [ ] UI 显示全局/工具状态
- [ ] "Apply to"复选框交互直观
- [ ] 工具标签页显示"Using global provider"
- [ ] API Key 支持全局/工具优先级
- [ ] 迁移脚本正确转换现有数据
- [ ] 所有测试通过 (单元 + 集成 + 迁移)
- [ ] 性能测试通过 (getCurrentProvider < 10ms)

#### 回滚计划

**触发条件**:
- 迁移失败率 > 0.1%
- 用户混淆反馈 > 5%
- 性能下降 > 2x

**回滚策略**:
1. 保留 v1 数据库备份
2. 提供回滚脚本
3. 禁用混合模式 UI
4. 回退到全局共享模式

---

### Phase 3: 功能增强和创新 (8-12 周)

#### 目标

超越 CC-Switch,提供独特价值,打造差异化竞争优势。

#### 任务清单

**Week 7-10: 智能功能**

- [ ] **智能供应商选择** (2周)
  - 成本优化引擎
  - 负载均衡策略
  - 推荐准确率 > 80%

- [ ] **成本预算和告警** (2周)
  - 预算管理 (日/周/月)
  - 超支告警 (邮件/通知)
  - 预算看板

- [ ] **实时 WebSocket 更新** (1周)
  - WebSocket 服务器
  - 前端实时更新
  - 推送延迟 < 100ms

**Week 11-14: 高级功能**

- [ ] **团队协作功能** (2周)
  - 配置共享 (不含 API Key)
  - 团队工作区

- [ ] **高级分析** (2周)
  - 趋势预测
  - 异常检测
  - 自定义报表

#### 验收标准

- [ ] 智能选择推荐准确率 > 80%
- [ ] 预算告警延迟 < 1 分钟
- [ ] WebSocket 推送延迟 < 100ms
- [ ] 团队配置同步无数据丢失
- [ ] 异常检测召回率 > 90%

#### 回滚计划

- 智能选择: 降级到手动选择
- 预算告警: 禁用告警,只记录日志
- WebSocket: 降级到 HTTP 轮询
- 团队协作: 回退到个人模式

---

## 🔬 Part 4: 技术决策

### 4.1 重构策略

**推荐**: **B. 渐进式重构**

**核心理由**:
1. 现有基础扎实 (已完成 70% 核心功能)
2. 风险可控 (分阶段交付)
3. 用户友好 (零停机升级)
4. ROI 更高 (4-6 周可见成果)

**实施要点**:
- Week 1-2: 数据迁移系统 + 回填机制
- Week 3-4: UniversalProvider + 服务层优化
- Week 5-6: 代理接管模式 + 故障转移

### 4.2 数据迁移策略

**推荐**: **版本化迁移系统 (参考 CC-Switch)**

**架构设计**:
```sql
-- 快速版本检查
PRAGMA user_version;
PRAGMA user_version = 5;
```

```typescript
export class MigrationManager {
  async applyMigrations(): Promise<void> {
    const currentVersion = await this.getUserVersion();

    while (version < SCHEMA_VERSION) {
      this.db.exec('SAVEPOINT schema_migration;');

      try {
        switch (version) {
          case 0: await this.migrate_v0_to_v1(); break;
          case 1: await this.migrate_v1_to_v2(); break;
          // ...
        }

        version++;
        this.db.exec(`PRAGMA user_version = ${version};`);
        this.db.exec('RELEASE schema_migration;');
      } catch (error) {
        this.db.exec('ROLLBACK TO schema_migration;');
        throw new MigrationError(...);
      }
    }
  }
}
```

**数据安全**:
- 自动备份 (SQLite Backup API)
- 迁移失败自动回滚
- 保留最近 10 个备份

### 4.3 工具隔离模式决策

**推荐**: **混合模式 (全局供应商 + 工具级别覆盖)**

**问题分析**:
- ❌ **纯工具隔离** (CC-Switch): 用户需要重复配置同一供应商 (9 个工具配置 9 次 OpenRouter)
- ✅ **全局共享** (unify-ai 现有): 一次配置,但无法工具特定
- ✅ **混合模式**: 兼顾复用和灵活

**架构设计**:
```
全局供应商 (tool_id = NULL)
  └─ 一次配置,所有工具可用

工具级别覆盖 (tool_id = 'xxx')
  └─ 按需覆盖,工具特定

优先级: 工具覆盖 > 全局配置 > 默认值
```

**实施要点**:
- Week 3-4: 数据库支持 NULL tool_id
- Week 5-6: API 层实现优先级查询
- Week 7-8: GUI 显示全局/工具状态

**用户价值**:
1. **减少重复配置**: OpenRouter 配置一次,所有工具可用
2. **灵活覆盖**: Claude Code 覆盖使用 Anthropic,其他工具继续用 OpenRouter
3. **符合心理模型**: "默认全局,按需覆盖"

### 4.4 API Key 加密方案

**推荐**: **保持现有混合方案 (safeStorage + AES-256-GCM)**

**理由**:
1. 安全性充足 (完胜 CC-Switch 的明文存储)
2. 已实现并测试 (代码成熟)
3. 用户体验好 (GUI 无感知,CLI 环境变量)

**改进建议**:
1. 密钥轮换机制 (重新加密所有 API Keys)
2. 数据库文件权限加固 (chmod 0o600)
3. 安全审计日志 (记录敏感操作)

### 4.4 代理服务器必要性

**推荐**: **延后到 Phase 2**

**理由**:
- 代理是增值功能,非 MVP 必需
- MVP 用户量不足以验证稳定性
- 增加用户学习成本

**MVP 替代方案**:
1. 手动配置 + 批量导出到所有工具
2. 简单用量追踪 (导入账单 CSV)

**Phase 2 实现**:
- 自动注入 API Key
- 用量追踪
- 请求日志
- 故障转移

### 4.5 性能优化优先级

**ROI 排序**:

| 优化项 | ROI | 实现难度 | 性能提升 |
|--------|-----|---------|---------|
| 1. API Key 缓存 | 🟢🟢🟢🟢🟢 | 🟢 简单 | 🟢🟢🟢🟢 |
| 2. 数据库索引 | 🟢🟢🟢🟢 | 🟢 简单 | 🟢🟢🟢 |
| 3. 用量聚合 | 🟢🟢🟢 | 🟡 中等 | 🟢🟢🟢🟢 |
| 4. N+1 查询 | 🟢🟢 | 🟡 中等 | 🟢🟢 |
| 5. 连接池 | 🟢 | 🔴 困难 | 🟢 |

**实施计划**:
- Week 1: API Key 缓存 + 索引优化 (必做)
- Week 2: 用量聚合预计算 (推荐)
- Week 3: N+1 查询优化 (可选)

### 4.5 UniversalProvider vs 混合模式

**推荐**: **混合模式已包含 UniversalProvider 的核心价值**

**对比分析**:

| 方案 | 核心价值 | unify-ai 混合模式 |
|------|---------|------------------|
| **UniversalProvider** | 一次配置,多工具复用 | ✅ 全局供应商实现 |
| **工具特定配置** | 按需定制 | ✅ 工具级别覆盖实现 |
| **转换逻辑** | 自动生成工具配置 | ⚠️ 可选功能 (Phase 3) |

**结论**:
- 混合模式的"全局供应商" = UniversalProvider
- 混合模式的"工具覆盖" = 工具特定配置
- 暂不需要独立的 UniversalProvider 概念

**Phase 3 可选增强**:
- UniversalAdapter: 自动转换全局供应商配置到工具特定格式
- 配置模板: 预设常见全局 + 覆盖组合

### 4.6 代理服务器必要性

## 📊 关键里程碑

| 里程碑 | 时间 | 交付物 | 验收标准 |
|--------|------|--------|----------|
| **M1: Phase 1 完成** | 第 2 周末 | API 缓存 + 快捷键 + 托盘 | 缓存命中率 > 90%, UI 响应 < 100ms |
| **M2: 混合模式 - 数据层** | 第 4 周末 | 数据库 schema + 迁移脚本 | 迁移成功率 100%, 无数据丢失 |
| **M3: 混合模式 - API 层** | 第 6 周末 | 优先级查询 + 回填机制 | getCurrentProvider < 10ms |
| **M4: 混合模式 - GUI 层** | 第 8 周末 | "Apply to" UI + 状态显示 | 用户理解全局/工具概念 |
| **M5: 智能功能** | 第 12 周末 | 智能选择 + 预算 | 推荐准确率 > 80% |
| **M6: Phase 3 完成** | 第 18 周末 | 团队协作 + 高级分析 | 全功能发布 |

---

## 📈 成功指标

### 技术指标

| 指标 | 当前值 | Phase 1 | Phase 2 | Phase 3 |
|------|--------|---------|---------|---------|
| API Key 解密耗时 | ~50ms | < 5ms | < 5ms | < 5ms |
| 用量查询延迟 | ~200ms | < 50ms | < 30ms | < 30ms |
| 供应商切换耗时 | ~300ms | < 200ms | < 150ms | < 100ms |
| 代理吞吐量 | - | - | 100 req/s | 500 req/s |

### 用户指标

| 指标 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| 供应商切换频率 | +50% | +100% | +150% |
| 用户满意度 (NPS) | > 7 | > 8 | > 9 |
| 功能采用率 | 缓存: 100% | UniversalProvider: 60% | 团队协作: 40% |
| 错误率 | < 1% | < 0.5% | < 0.1% |

---

## 🎬 下一步行动

### 立即执行 (Week 1)

1. ✅ **实现 API Key 缓存**
   - 文件: `packages/core/src/model/EncryptionManager.ts`
   - LRU 缓存 + TTL
   - 预计: 2 天

2. ✅ **实现全局快捷键**
   - 文件: `packages/gui/electron/main.ts`
   - Quick Switcher 组件
   - 预计: 2 天

3. ✅ **托盘菜单优化**
   - 文件: `packages/gui/electron/main.ts`
   - 动态供应商列表
   - 预计: 1 天

### 短期计划 (Week 2-4)

4. ✅ **混合工具隔离 - 数据层**
   - 文件: `packages/core/src/model/migrations/002_hybrid_tool_isolation.ts` (新建)
   - 数据库 schema 更新
   - 迁移脚本
   - 预计: 1 周

5. ✅ **混合工具隔离 - API 层**
   - 文件: `packages/core/src/model/ModelManager.ts`
   - 优先级查询逻辑
   - 预计: 1 周

6. ✅ **回填机制**
   - 文件: `packages/core/src/model/ModelManager.ts`
   - 切换前备份 + 写回
   - 预计: 3 天

### 中期计划 (Week 5-8)

7. ✅ **混合工具隔离 - GUI 层**
   - 文件: `packages/gui/src/components/model/AddProviderDialog.tsx`
   - "Apply to" 应用范围选择
   - 预计: 1 周

8. ✅ **代理服务器改进**
   - 文件: `packages/core/src/model/ProxyServer.ts`
   - 请求队列 + 熔断器
   - 预计: 1 周

9. ✅ **智能供应商选择**
   - 文件: `packages/core/src/model/SmartProviderSelector.ts` (新建)
   - 成本优化引擎
   - 预计: 2 周

---

## 📚 参考文档

1. [CC-Switch 深度调研报告](/.claude/plans/cc-switch-research.md)
2. [工具隔离重新设计分析](/.claude/plans/tool-isolation-redesign-analysis.md)
3. [架构对比报告](/.claude/plans/cc-switch-research.md#1-架构对比) (本文件 Part 1)
4. [UI/UX 对比报告](/.claude/plans/cc-switch-research.md#2-交互对比) (本文件 Part 2)
5. [Model Config Architecture](/.claude/plans/model-config-architecture.md)
6. [Model Config Management](/.claude/plans/model-config-management.md)

---

## 🔄 更新日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-02-21 | v1.0 | 初始版本,整合 4 个 agent 分析结果 |

---

**规划完成日期**: 2026-02-21
**下次评审**: Phase 1 完成后 (预计 2026-03-07)
**负责人**: 开发团队
**批准人**: 产品负责人
