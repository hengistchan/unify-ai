# Models 手动配置重构计划

> **创建日期**: 2026-02-23
> **目标**: 支持 Provider 中 Models 的手动配置（添加、编辑、删除）

---

## 1. 需求分析

### 1.1 当前问题

| 功能          |     后端     |     IPC      | Store |    UI     |
| ------------- | :----------: | :----------: | :---: | :-------: |
| 列出模型      |      ✅      |      ✅      |  ✅   | ✅ (只读) |
| 添加模型      |      ❌      |      ❌      |  ❌   |    ❌     |
| 删除模型      |      ❌      |      ❌      |  ❌   |    ❌     |
| 编辑模型属性  | ⚠️ 仅 config | ⚠️ 仅 config |  ❌   |    ❌     |
| 设置默认模型  |      ✅      |      ✅      |  ✅   |    ❌     |
| 启用/禁用模型 |      ❌      |      ❌      |  ❌   |    ❌     |

### 1.2 目标功能

1. **添加模型** - 手动添加新模型到 Provider
2. **编辑模型** - 修改模型属性（名称、上下文窗口、定价等）
3. **删除模型** - 从 Provider 移除模型
4. **启用/禁用** - 切换模型可用状态
5. **设置默认** - 将模型设为默认

---

## 2. 技术设计

### 2.1 类型定义

#### 新增类型 (`packages/core/src/model/types.ts`)

```typescript
/**
 * Input for adding a new model
 */
export interface AddModelInput {
  /** Model identifier */
  id: string;
  /** Display name */
  displayName: string;
  /** Context window size (tokens) */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Pricing information */
  pricing?: Partial<ModelPricing>;
  /** Whether model is enabled (default: true) */
  enabled?: boolean;
  /** Model-specific configuration */
  config?: ModelConfig;
}

/**
 * Input for updating a model
 */
export interface UpdateModelInput {
  /** Display name */
  displayName?: string;
  /** Context window size (tokens) */
  contextWindow?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** Pricing information */
  pricing?: Partial<ModelPricing>;
  /** Whether model is enabled */
  enabled?: boolean;
  /** Model-specific configuration */
  config?: Partial<ModelConfig>;
}
```

### 2.2 后端 API 设计

#### ModelManager 新增方法 (`packages/core/src/model/ModelManager.ts`)

```typescript
/**
 * Add a new model to a provider
 */
async addModel(providerId: string, input: AddModelInput): Promise<ModelInfo>

/**
 * Update model properties
 */
async updateModel(providerId: string, modelId: string, input: UpdateModelInput): Promise<ModelInfo>

/**
 * Delete a model from a provider
 */
async deleteModel(providerId: string, modelId: string): Promise<void>

/**
 * Toggle model enabled status
 */
async setModelEnabled(providerId: string, modelId: string, enabled: boolean): Promise<ModelInfo>
```

### 2.3 IPC 通道设计

#### 新增通道 (`packages/gui/electron/ipc/channels.ts`)

```typescript
// Model management - Models (扩展)
ADD_MODEL: 'add-model',
UPDATE_MODEL_DETAILS: 'update-model-details',  // 替代现有 UPDATE_MODEL
DELETE_MODEL: 'delete-model',
SET_MODEL_ENABLED: 'set-model-enabled',
```

### 2.4 Store Actions 设计

#### modelStore 新增 (`packages/gui/src/stores/modelStore.ts`)

```typescript
// Model Actions (扩展)
addModel: (providerId: string, input: AddModelInput) => Promise<ModelInfo>;
updateModelDetails: (providerId: string, modelId: string, input: UpdateModelInput) =>
  Promise<ModelInfo>;
deleteModel: (providerId: string, modelId: string) => Promise<void>;
setModelEnabled: (providerId: string, modelId: string, enabled: boolean) => Promise<void>;
```

### 2.5 UI 组件设计

#### 新增组件

| 组件              | 路径                                   | 功能                     |
| ----------------- | -------------------------------------- | ------------------------ |
| `ModelListItem`   | `components/model/ModelListItem.tsx`   | 单个模型行（含操作按钮） |
| `AddModelDialog`  | `components/model/AddModelDialog.tsx`  | 添加模型对话框           |
| `ModelEditDialog` | `components/model/ModelEditDialog.tsx` | 编辑模型对话框           |

#### 修改组件

| 组件                 | 修改内容                          |
| -------------------- | --------------------------------- |
| `ProviderDetail.tsx` | 重构 Models Section，添加操作按钮 |
| `modelStore.ts`      | 添加新的 actions                  |

---

## 3. 实施计划

### Phase 1: 后端扩展 (Day 1)

#### 1.1 更新类型定义

**文件**: `packages/core/src/model/types.ts`

- [ ] 添加 `AddModelInput` 接口
- [ ] 添加 `UpdateModelInput` 接口
- [ ] 导出新类型

#### 1.2 更新 ModelManager

**文件**: `packages/core/src/model/ModelManager.ts`

- [ ] 实现 `addModel()` 方法
- [ ] 扩展 `updateModel()` 支持 `UpdateModelInput`
- [ ] 实现 `deleteModel()` 方法
- [ ] 实现 `setModelEnabled()` 方法

**代码示例**:

```typescript
async addModel(providerId: string, input: AddModelInput): Promise<ModelInfo> {
  const provider = await this.getProvider(providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  const model: ModelInfo = {
    id: input.id,
    providerId,
    displayName: input.displayName,
    contextWindow: input.contextWindow,
    maxOutputTokens: input.maxOutputTokens,
    pricing: {
      inputPerK: input.pricing?.inputPerK ?? 0,
      outputPerK: input.pricing?.outputPerK ?? 0,
    },
    enabled: input.enabled ?? true,
    config: input.config,
  };

  await this.db.run(
    `INSERT INTO model_configs
     (id, provider_id, model_id, display_name, context_window, max_output_tokens, pricing_input, pricing_output, enabled, config)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `${providerId}:${input.id}`,
      providerId,
      input.id,
      input.displayName,
      input.contextWindow,
      input.maxOutputTokens,
      model.pricing.inputPerK,
      model.pricing.outputPerK,
      model.enabled ? 1 : 0,
      JSON.stringify(input.config || {}),
    ]
  );

  return model;
}

async updateModel(providerId: string, modelId: string, input: UpdateModelInput): Promise<ModelInfo> {
  const existing = await this.getModel(providerId, modelId);
  if (!existing) {
    throw new Error(`Model not found: ${modelId}`);
  }

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (input.displayName !== undefined) {
    updates.push('display_name = ?');
    values.push(input.displayName);
  }
  if (input.contextWindow !== undefined) {
    updates.push('context_window = ?');
    values.push(input.contextWindow);
  }
  if (input.maxOutputTokens !== undefined) {
    updates.push('max_output_tokens = ?');
    values.push(input.maxOutputTokens);
  }
  if (input.pricing !== undefined) {
    if (input.pricing.inputPerK !== undefined) {
      updates.push('pricing_input = ?');
      values.push(input.pricing.inputPerK);
    }
    if (input.pricing.outputPerK !== undefined) {
      updates.push('pricing_output = ?');
      values.push(input.pricing.outputPerK);
    }
  }
  if (input.enabled !== undefined) {
    updates.push('enabled = ?');
    values.push(input.enabled ? 1 : 0);
  }
  if (input.config !== undefined) {
    updates.push('config = ?');
    values.push(JSON.stringify({ ...existing.config, ...input.config }));
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(providerId, modelId);
    await this.db.run(
      `UPDATE model_configs SET ${updates.join(', ')} WHERE provider_id = ? AND model_id = ?`,
      values
    );
  }

  return this.getModel(providerId, modelId);
}

async deleteModel(providerId: string, modelId: string): Promise<void> {
  await this.db.run(
    'DELETE FROM model_configs WHERE provider_id = ? AND model_id = ?',
    [providerId, modelId]
  );
}

async setModelEnabled(providerId: string, modelId: string, enabled: boolean): Promise<ModelInfo> {
  return this.updateModel(providerId, modelId, { enabled });
}
```

---

### Phase 2: IPC 层 (Day 1)

#### 2.1 更新通道定义

**文件**: `packages/gui/electron/ipc/channels.ts`

```typescript
// Model management - Models
GET_MODELS: 'get-models',
ADD_MODEL: 'add-model',
UPDATE_MODEL_DETAILS: 'update-model-details',
DELETE_MODEL: 'delete-model',
SET_MODEL_ENABLED: 'set-model-enabled',
SET_DEFAULT_MODEL: 'set-default-model',
GET_DEFAULT_MODEL: 'get-default-model',
```

#### 2.2 更新 IPC 处理器

**文件**: `packages/gui/electron/ipc/model.ts`

- [ ] 添加 `ADD_MODEL` 处理器
- [ ] 更新 `UPDATE_MODEL_DETAILS` 处理器（替代现有 `UPDATE_MODEL`）
- [ ] 添加 `DELETE_MODEL` 处理器
- [ ] 添加 `SET_MODEL_ENABLED` 处理器

#### 2.3 更新 Preload

**文件**: `packages/gui/electron/preload.ts`

- [ ] 添加 `addModel` 方法
- [ ] 更新 `updateModelDetails` 方法
- [ ] 添加 `deleteModel` 方法
- [ ] 添加 `setModelEnabled` 方法

#### 2.4 更新类型定义

**文件**: `packages/gui/src/types/electron.d.ts`

```typescript
model: {
  // ... existing methods

  // Model management (更新)
  getModels: (providerId: string) => Promise<ModelInfo[]>;
  addModel: (providerId: string, input: AddModelInput) => Promise<ModelInfo>;
  updateModelDetails: (providerId: string, modelId: string, input: UpdateModelInput) =>
    Promise<ModelInfo>;
  deleteModel: (providerId: string, modelId: string) => Promise<void>;
  setModelEnabled: (providerId: string, modelId: string, enabled: boolean) => Promise<ModelInfo>;
  setDefaultModel: (providerId: string, modelId: string) => Promise<void>;
  getDefaultModel: (providerId: string) => Promise<ModelInfo | null>;
}
```

---

### Phase 3: Store 层 (Day 2)

#### 3.1 更新 modelStore

**文件**: `packages/gui/src/stores/modelStore.ts`

- [ ] 添加 `addModel` action
- [ ] 添加 `updateModelDetails` action
- [ ] 添加 `deleteModel` action
- [ ] 添加 `setModelEnabled` action

**代码示例**:

```typescript
// Model Actions (扩展)

addModel: async (providerId: string, input: AddModelInput) => {
  set({ loading: true, error: null });
  try {
    const model = await window.electronAPI.model.addModel(providerId, input);
    await get().loadProviders();
    set({ loading: false });
    return model;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add model';
    set({ error: message, loading: false });
    throw error;
  }
},

updateModelDetails: async (providerId: string, modelId: string, input: UpdateModelInput) => {
  set({ loading: true, error: null });
  try {
    const model = await window.electronAPI.model.updateModelDetails(providerId, modelId, input);
    await get().loadProviders();
    set({ loading: false });
    return model;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update model';
    set({ error: message, loading: false });
    throw error;
  }
},

deleteModel: async (providerId: string, modelId: string) => {
  set({ loading: true, error: null });
  try {
    await window.electronAPI.model.deleteModel(providerId, modelId);
    await get().loadProviders();
    set({ loading: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete model';
    set({ error: message, loading: false });
    throw error;
  }
},

setModelEnabled: async (providerId: string, modelId: string, enabled: boolean) => {
  set({ loading: true, error: null });
  try {
    await window.electronAPI.model.setModelEnabled(providerId, modelId, enabled);
    await get().loadProviders();
    set({ loading: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle model';
    set({ error: message, loading: false });
    throw error;
  }
},
```

---

### Phase 4: UI 组件 (Day 2-3)

#### 4.1 创建 ModelListItem 组件

**文件**: `packages/gui/src/components/model/ModelListItem.tsx`

**Props**:

```typescript
interface ModelListItemProps {
  model: ModelInfo;
  isDefault: boolean;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}
```

**UI 设计**:

```
┌────────────────────────────────────────────────────────────────┐
│ ○ gpt-4o                              [Default] [Edit] [Delete]│
│   128,000 tokens · $2.50/1K in · $10.00/1K out                 │
└────────────────────────────────────────────────────────────────┘
```

#### 4.2 创建 AddModelDialog 组件

**文件**: `packages/gui/src/components/model/AddModelDialog.tsx`

**Props**:

```typescript
interface AddModelDialogProps {
  open: boolean;
  onClose: () => void;
  providerId: string;
  onSuccess: () => void;
}
```

**表单字段**:
| 字段 | 类型 | 必填 | 默认值 |
|------|------|:----:|--------|
| Model ID | text | ✅ | - |
| Display Name | text | ✅ | - |
| Context Window | number | ✅ | 8192 |
| Max Output Tokens | number | ✅ | 4096 |
| Input Price ($/1K) | number | ❌ | 0 |
| Output Price ($/1K) | number | ❌ | 0 |
| Enabled | checkbox | ❌ | true |

#### 4.3 创建 ModelEditDialog 组件

**文件**: `packages/gui/src/components/model/ModelEditDialog.tsx`

**Props**:

```typescript
interface ModelEditDialogProps {
  open: boolean;
  onClose: () => void;
  providerId: string;
  model: ModelInfo;
  onSuccess: () => void;
}
```

**表单字段**: 与 AddModelDialog 相同，但预填充现有值

#### 4.4 更新 ProviderDetail 组件

**文件**: `packages/gui/src/components/model/ProviderDetail.tsx`

**修改内容**:

- 重构 Models Section
- 添加 "+ Add Model" 按钮
- 使用 ModelListItem 替代现有简单列表
- 集成 AddModelDialog 和 ModelEditDialog

**新 UI 结构**:

```tsx
<Card className="p-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Settings className="h-5 w-5" />
      <h3 className="font-semibold">Models</h3>
      <span className="text-xs text-text-secondary">({provider.models.length})</span>
    </div>
    <Button size="sm" onClick={() => setShowAddDialog(true)}>
      + Add Model
    </Button>
  </div>
  <div className="mt-3 space-y-2">
    {provider.models.map(model => (
      <ModelListItem
        key={model.id}
        model={model}
        isDefault={provider.defaultModel === model.id}
        onSetDefault={() => handleSetDefault(model.id)}
        onEdit={() => openEditDialog(model)}
        onDelete={() => handleDelete(model.id)}
        onToggleEnabled={enabled => handleToggleEnabled(model.id, enabled)}
      />
    ))}
  </div>
</Card>
```

---

## 4. 文件变更清单

### 4.1 新增文件

| 文件路径                                                | 说明           |
| ------------------------------------------------------- | -------------- |
| `packages/gui/src/components/model/ModelListItem.tsx`   | 模型列表项组件 |
| `packages/gui/src/components/model/AddModelDialog.tsx`  | 添加模型对话框 |
| `packages/gui/src/components/model/ModelEditDialog.tsx` | 编辑模型对话框 |

### 4.2 修改文件

| 文件路径                                               | 修改内容                             |
| ------------------------------------------------------ | ------------------------------------ |
| `packages/core/src/model/types.ts`                     | 添加 AddModelInput, UpdateModelInput |
| `packages/core/src/model/index.ts`                     | 导出新类型                           |
| `packages/core/src/model/ModelManager.ts`              | 添加/修改模型方法                    |
| `packages/gui/electron/ipc/channels.ts`                | 添加新 IPC 通道                      |
| `packages/gui/electron/ipc/model.ts`                   | 添加新处理器                         |
| `packages/gui/electron/preload.ts`                     | 暴露新 API                           |
| `packages/gui/src/types/electron.d.ts`                 | 添加类型定义                         |
| `packages/gui/src/stores/modelStore.ts`                | 添加新 actions                       |
| `packages/gui/src/components/model/ProviderDetail.tsx` | 重构 Models Section                  |

---

## 5. 验收标准

### 5.1 功能验收

- [ ] 可以添加新模型到 Provider
- [ ] 可以编辑模型属性（名称、上下文窗口、定价等）
- [ ] 可以删除模型
- [ ] 可以启用/禁用模型
- [ ] 可以设置默认模型
- [ ] 模型列表正确显示所有信息
- [ ] 表单验证正确（必填字段、数值范围）

### 5.2 技术验收

- [ ] TypeScript 编译无错误
- [ ] ESLint 检查通过
- [ ] 所有 IPC 通道正确注册
- [ ] Store 状态正确更新
- [ ] UI 响应流畅无卡顿

---

## 6. 时间估算

| Phase    | 内容     | 预计时间 |
| -------- | -------- | -------- |
| Phase 1  | 后端扩展 | 0.5 天   |
| Phase 2  | IPC 层   | 0.5 天   |
| Phase 3  | Store 层 | 0.5 天   |
| Phase 4  | UI 组件  | 1.5 天   |
| **总计** |          | **3 天** |

---

## 7. 风险与缓解

| 风险         | 影响                 | 缓解措施                    |
| ------------ | -------------------- | --------------------------- |
| 数据库迁移   | 可能影响现有数据     | 先备份，添加回滚脚本        |
| IPC 通道冲突 | 可能与现有通道冲突   | 使用新的通道名称            |
| UI 状态同步  | 编辑后列表可能不更新 | 统一使用 loadProviders 刷新 |

---

**计划创建日期**: 2026-02-23
**预计开始日期**: 待定
**负责人**: 待定
