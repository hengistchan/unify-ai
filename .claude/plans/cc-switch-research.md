# CC-Switch 深度调研报告

> **调研目标**: 深入理解 cc-switch 的架构设计、交互模式和最佳实践,为 unify-ai 的 model 模块设计提供参考

---

## 一、项目概览

### 1.1 基本信息

- **项目名称**: CC-Switch (Claude Code / Codex / Gemini CLI 全方位辅助工具)
- **技术栈**: Tauri 2.8 + React 18 + Rust + SQLite
- **当前版本**: v3.10.2
- **核心功能**: AI CLI 工具的供应商管理、配置切换、MCP 管理、用量追踪

### 1.2 支持的 AI 工具

| 工具 | 配置文件 | API Key 字段 | 配置模式 |
|------|---------|-------------|---------|
| **Claude Code** | `~/.claude/settings.json` | `ANTHROPIC_AUTH_TOKEN` | 切换模式 |
| **Codex** | `~/.codex/auth.json` + `config.toml` | `OPENAI_API_KEY` | 切换模式 |
| **Gemini CLI** | `~/.gemini/.env` + `settings.json` | `GEMINI_API_KEY` | 切换模式 |
| **OpenCode** | `~/.opencode/opencode.json` | `options.apiKey` | 累加模式 |
| **OpenClaw** | `~/.openclaw/openclaw.json` | `apiKey` (顶层) | 累加模式 |

### 1.3 架构设计原则

```
┌─────────────────────────────────────────────────────────────┐
│                    前端 (React + TS)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ Components  │  │    Hooks     │  │  TanStack Query  │    │
│  │   （UI）     │──│ （业务逻辑）   │──│   （缓存/同步）    │    │
│  └─────────────┘  └──────────────┘  └──────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │ Tauri IPC
┌────────────────────────▼────────────────────────────────────┐
│                  后端 (Tauri + Rust)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Commands   │  │   Services   │  │  Models/Config   │    │
│  │ （API 层）   │──│  （业务层）    │──│    （数据）       │    │
│  └─────────────┘  └──────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**核心设计模式**:
- **SSOT (单一事实源)**: SQLite 数据库为唯一数据源
- **双层存储**: SQLite (可同步数据) + JSON (设备级设置)
- **双向同步**: 切换时写入 live 文件,编辑时从 live 回填
- **原子写入**: 临时文件 + 重命名防止配置损坏
- **并发安全**: Mutex 保护的数据库连接

---

## 二、核心数据模型

### 2.1 Provider 数据结构

```rust
pub struct Provider {
    pub id: String,                        // 唯一标识符
    pub name: String,                      // 供应商名称
    pub settings_config: Value,            // 应用配置 (JSON)
    pub website_url: Option<String>,       // 网站链接
    pub category: Option<String>,          // 分类 (官方/聚合/第三方)
    pub created_at: Option<i64>,           // 创建时间戳 (毫秒)
    pub sort_index: Option<usize>,         // 排序索引 (拖拽排序)
    pub notes: Option<String>,             // 备注信息
    pub meta: Option<ProviderMeta>,        // 元数据 (不写入 live 配置)
    pub icon: Option<String>,              // 图标名称
    pub icon_color: Option<String>,        // 图标颜色
    pub in_failover_queue: bool,           // 故障转移队列标记
}
```

**元数据设计**:
```rust
pub struct ProviderMeta {
    pub custom_endpoints: HashMap<String, CustomEndpoint>,  // 自定义端点
    pub usage_script: Option<UsageScript>,                  // 用量查询脚本
    pub endpoint_auto_select: Option<bool>,                 // 端点自动选择
    pub is_partner: Option<bool>,                           // 合作伙伴标记
    pub test_config: Option<ProviderTestConfig>,            // 测试配置
    pub proxy_config: Option<ProviderProxyConfig>,          // 代理配置
    pub cost_multiplier: Option<String>,                    // 成本倍数
    pub pricing_model_source: Option<String>,               // 计费模式
}
```

### 2.2 UniversalProvider (v3.10.0 统一供应商)

**设计目的**: 一次配置,多应用复用

```rust
pub struct UniversalProvider {
    pub id: String,
    pub name: String,
    pub provider_type: String,             // "newapi", "custom"
    pub apps: UniversalProviderApps,       // 启用的应用
    pub base_url: String,                  // API 基础地址
    pub api_key: String,                   // API 密钥
    pub models: UniversalProviderModels,   // 各应用的模型配置
    pub website_url: Option<String>,
    pub notes: Option<String>,
    pub icon: Option<String>,
    pub icon_color: Option<String>,
    pub meta: Option<ProviderMeta>,
}

pub struct UniversalProviderApps {
    pub claude: bool,
    pub codex: bool,
    pub gemini: bool,
}
```

**转换方法**: 单向生成各应用 Provider
- `to_claude_provider()` → 生成 Claude 配置
- `to_codex_provider()` → 生成 Codex 配置 (自动处理 /v1 后缀)
- `to_gemini_provider()` → 生成 Gemini 配置

---

## 三、数据库设计

### 3.1 SQLite Schema

**核心表结构**:

```sql
-- 供应商主表
CREATE TABLE providers (
    id TEXT NOT NULL,
    app_type TEXT NOT NULL,                -- 应用类型 (claude/codex/gemini)
    name TEXT NOT NULL,
    settings_config TEXT NOT NULL,         -- JSON 序列化配置
    website_url TEXT,
    category TEXT,
    created_at INTEGER,
    sort_index INTEGER,
    notes TEXT,
    icon TEXT,
    icon_color TEXT,
    meta TEXT NOT NULL DEFAULT '{}',       -- JSON 序列化元数据
    is_current BOOLEAN NOT NULL DEFAULT 0, -- 当前供应商标记
    in_failover_queue BOOLEAN NOT NULL DEFAULT 0,
    PRIMARY KEY (id, app_type)
);

-- 自定义端点
CREATE TABLE provider_endpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id TEXT NOT NULL,
    app_type TEXT NOT NULL,
    url TEXT NOT NULL,
    added_at INTEGER,
    FOREIGN KEY (provider_id, app_type)
        REFERENCES providers(id, app_type) ON DELETE CASCADE
);

-- MCP 服务器
CREATE TABLE mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    server_config TEXT NOT NULL,           -- JSON 格式
    description TEXT,
    homepage TEXT,
    docs TEXT,
    tags TEXT NOT NULL DEFAULT '[]',       -- JSON 数组
    enabled_claude BOOLEAN NOT NULL DEFAULT 0,
    enabled_codex BOOLEAN NOT NULL DEFAULT 0,
    enabled_gemini BOOLEAN NOT NULL DEFAULT 0,
    enabled_opencode BOOLEAN NOT NULL DEFAULT 0
);

-- Skills (v3.10.0+ 统一管理)
CREATE TABLE skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    directory TEXT NOT NULL,               -- 技能目录路径
    repo_owner TEXT,
    repo_name TEXT,
    repo_branch TEXT DEFAULT 'main',
    readme_url TEXT,
    enabled_claude BOOLEAN NOT NULL DEFAULT 0,
    enabled_codex BOOLEAN NOT NULL DEFAULT 0,
    enabled_gemini BOOLEAN NOT NULL DEFAULT 0,
    enabled_opencode BOOLEAN NOT NULL DEFAULT 0,
    installed_at INTEGER NOT NULL DEFAULT 0
);

-- 代理配置 (三行结构,每个应用独立配置)
CREATE TABLE proxy_config (
    app_type TEXT PRIMARY KEY CHECK (app_type IN ('claude','codex','gemini')),
    proxy_enabled INTEGER NOT NULL DEFAULT 0,
    listen_address TEXT NOT NULL DEFAULT '127.0.0.1',
    listen_port INTEGER NOT NULL DEFAULT 15721,
    enable_logging INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 0,    -- 代理接管状态
    auto_failover_enabled INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    streaming_first_byte_timeout INTEGER NOT NULL DEFAULT 60,
    streaming_idle_timeout INTEGER NOT NULL DEFAULT 120,
    non_streaming_timeout INTEGER NOT NULL DEFAULT 600,
    -- 熔断器配置
    circuit_failure_threshold INTEGER NOT NULL DEFAULT 4,
    circuit_success_threshold INTEGER NOT NULL DEFAULT 2,
    circuit_timeout_seconds INTEGER NOT NULL DEFAULT 60,
    circuit_error_rate_threshold REAL NOT NULL DEFAULT 0.6,
    circuit_min_requests INTEGER NOT NULL DEFAULT 10,
    default_cost_multiplier TEXT NOT NULL DEFAULT '1',
    pricing_model_source TEXT NOT NULL DEFAULT 'response',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 请求使用日志
CREATE TABLE proxy_request_logs (
    request_id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    app_type TEXT NOT NULL,
    model TEXT NOT NULL,
    request_model TEXT,                    -- 实际请求的模型
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
    input_cost_usd TEXT NOT NULL DEFAULT '0',  -- TEXT 存储精确小数
    output_cost_usd TEXT NOT NULL DEFAULT '0',
    cache_read_cost_usd TEXT NOT NULL DEFAULT '0',
    cache_creation_cost_usd TEXT NOT NULL DEFAULT '0',
    total_cost_usd TEXT NOT NULL DEFAULT '0',
    latency_ms INTEGER NOT NULL,
    first_token_ms INTEGER,
    duration_ms INTEGER,
    status_code INTEGER NOT NULL,
    error_message TEXT,
    session_id TEXT,
    provider_type TEXT,
    is_streaming INTEGER NOT NULL DEFAULT 0,
    cost_multiplier TEXT NOT NULL DEFAULT '1.0',
    created_at INTEGER NOT NULL
);

-- 索引优化
CREATE INDEX idx_request_logs_provider ON proxy_request_logs(provider_id, app_type);
CREATE INDEX idx_request_logs_created_at ON proxy_request_logs(created_at);
CREATE INDEX idx_request_logs_model ON proxy_request_logs(model);
CREATE INDEX idx_request_logs_session ON proxy_request_logs(session_id);
CREATE INDEX idx_request_logs_status ON proxy_request_logs(status_code);

-- 模型定价数据
CREATE TABLE model_pricing (
    model_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    input_cost_per_million TEXT NOT NULL,
    output_cost_per_million TEXT NOT NULL,
    cache_read_cost_per_million TEXT NOT NULL DEFAULT '0',
    cache_creation_cost_per_million TEXT NOT NULL DEFAULT '0'
);

-- 供应商健康状态
CREATE TABLE provider_health (
    provider_id TEXT NOT NULL,
    app_type TEXT NOT NULL,
    is_healthy INTEGER NOT NULL DEFAULT 1,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_success_at TEXT,
    last_failure_at TEXT,
    last_error TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (provider_id, app_type),
    FOREIGN KEY (provider_id, app_type) REFERENCES providers(id, app_type) ON DELETE CASCADE
);

-- 键值对存储 (UniversalProviders 存储在这里)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT                             -- JSON 序列化
);
```

### 3.2 数据库设计亮点

#### 1. 复合主键设计

```sql
PRIMARY KEY (id, app_type)
```

**优势**:
- 支持跨应用隔离 (同一 ID 可在不同应用中存在)
- 避免数据冲突
- 简化外键关联

#### 2. JSON 字段存储

```sql
settings_config TEXT NOT NULL,  -- JSON
meta TEXT NOT NULL DEFAULT '{}' -- JSON
```

**优势**:
- 灵活扩展 (无需频繁修改 Schema)
- 避免过度规范化
- 类型安全 (通过 serde_json 验证)

#### 3. TEXT 存储金额

```sql
total_cost_usd TEXT NOT NULL DEFAULT '0'
```

**原因**: 避免浮点精度问题,精确计算成本

#### 4. 索引策略

- **单列索引**: `created_at` (时间范围查询)
- **复合索引**: `(provider_id, app_type)` (多表关联)
- **覆盖索引**: `(app_type, in_failover_queue, sort_index)` (故障转移队列)

### 3.3 数据访问层 (DAO)

**文件结构**:
```
database/dao/
├── providers.rs          # Provider CRUD
├── mcp.rs                # MCP 服务器管理
├── prompts.rs            # 提示词管理
├── skills.rs             # Skills 管理
├── proxy.rs              # 代理配置、健康状态
├── settings.rs           # 通用键值对
├── failover.rs           # 故障转移队列
├── stream_check.rs       # 供应商连通性测试
└── universal_providers.rs  # 通用供应商模板
```

**并发控制**:
```rust
// 全局宏简化 Mutex 锁获取
macro_rules! lock_conn {
    ($mutex:expr) => {
        $mutex
            .lock()
            .map_err(|e| AppError::Database(format!("Mutex lock failed: {}", e)))?
    };
}

// 使用示例
pub fn save_provider(&self, app_type: &str, provider: &Provider) -> Result<(), AppError> {
    let mut conn = lock_conn!(self.conn);
    let tx = conn.transaction()?;

    // 业务逻辑...

    tx.commit()?;
    Ok(())
}
```

---

## 四、供应商切换机制

### 4.1 切换流程详解

```rust
pub fn switch(state: &AppState, app_type: AppType, id: &str) -> Result<(), AppError> {
    // 1. 验证供应商存在
    let provider = providers.get(id)?;

    // 2. 检查代理接管模式
    if should_hot_switch {
        // 热切换模式: 只更新数据库 + settings,不写 live
        state.db.set_current_provider(app_type, id)?;
        settings::set_current_provider(&app_type, Some(id))?;
        proxy_service.update_live_backup_from_provider(&provider)?;
        return Ok(());
    }

    // 3. 正常切换模式
    // 3.1 回填机制: 将当前 live 配置写回旧供应商
    if let Some(current_id) = get_effective_current_provider() {
        let live_config = read_live_settings(&app_type)?;
        current_provider.settings_config = live_config;
        db.save_provider(&current_provider)?;
    }

    // 3.2 更新本地 settings (设备级优先)
    settings::set_current_provider(&app_type, Some(id))?;

    // 3.3 更新数据库 is_current (云同步默认值)
    db.set_current_provider(app_type, id)?;

    // 3.4 写入 live 配置文件
    write_live_snapshot(&app_type, &provider)?;

    // 3.5 同步 MCP 配置
    McpService::sync_all_enabled(state)?;

    Ok(())
}
```

### 4.2 回填机制

**问题**: 用户手动修改 live 配置后切换供应商,修改会丢失

**解决方案**:
```rust
// 切换前将当前 live 配置写回旧供应商
if let Ok(live_config) = read_live_settings(app_type.clone()) {
    current_provider.settings_config = live_config;
    db.save_provider(&current_provider)?;
}
```

**触发条件**:
- 只在切换模式应用生效
- 只在切换到不同供应商时执行
- 失败不影响切换流程

### 4.3 代理接管模式的热切换

**触发条件**:
```rust
let should_hot_switch =
    (is_app_taken_over || live_taken_over) && is_proxy_running;
```

**特点**:
- 不修改 live 配置文件 (避免破坏代理接管)
- 只更新数据库和本地 settings
- 更新 live 备份 (确保关闭代理时恢复正确配置)
- 清理 Claude live 中的模型覆盖字段

### 4.4 当前供应商优先级

```rust
// 1. 优先读取本地 settings.json (设备级)
// 2. 验证 ID 是否存在于数据库
// 3. 不存在则 fallback 到数据库 is_current 字段 (云同步默认值)
// 4. 仍不存在则返回 None
```

**双层标记设计目的**:
- 设备级 (`settings.json`): 不同步,每台设备独立
- 云同步级 (`is_current`): 同步,作为默认值

---

## 五、Live 配置同步机制

### 5.1 写入策略

**切换模式应用** (Claude/Codex/Gemini):
- 只写当前供应商到 live 配置
- 切换时触发回填机制

**累加模式应用** (OpenCode/OpenClaw):
- 所有供应商同时存在于 live 配置
- 每次添加/更新都直接写 live
- 删除时从 live 中移除 (可选保留数据库记录)

### 5.2 写入实现

```rust
pub(crate) fn write_live_snapshot(app_type: &AppType, provider: &Provider) -> Result<(), AppError> {
    match app_type {
        AppType::Claude => {
            let path = get_claude_settings_path();
            let settings = sanitize_claude_settings_for_live(&provider.settings_config);
            write_json_file(&path, &settings)?;
        }
        AppType::Codex => {
            // 写入 auth.json
            write_json_file(&get_codex_auth_path(), auth)?;
            // 写入 config.toml
            std::fs::write(&get_codex_config_path(), config_str)?;
        }
        AppType::Gemini => {
            write_gemini_live(provider)?; // 特殊处理安全标志
        }
        AppType::OpenCode => {
            opencode_config::set_typed_provider(&provider.id, &config)?;
        }
        AppType::OpenClaw => {
            openclaw_config::set_typed_provider(&provider.id, &config)?;
        }
    }
    Ok(())
}
```

### 5.3 配置清理

```rust
// 移除仅内部使用的字段,不写入 Claude settings.json
obj.remove("api_format");
obj.remove("apiFormat");
obj.remove("openrouter_compat_mode");
obj.remove("openrouterCompatMode");
```

### 5.4 代理接管模式的特殊处理

**Live 备份机制**:
```sql
CREATE TABLE proxy_live_backup (
    app_type TEXT PRIMARY KEY,
    original_config TEXT NOT NULL,      -- 原始配置 JSON
    backed_up_at TEXT NOT NULL
)
```

**接管流程**:
1. 启动代理前,备份当前 live 配置到 `proxy_live_backup`
2. 写入代理接管配置到 live
3. 切换供应商时,只更新备份 (不修改 live)
4. 关闭代理时,从备份恢复 live 配置

---

## 六、前端交互设计

### 6.1 UniversalProviderPanel 组件

**状态管理**:
```typescript
const [providers, setProviders] = useState<UniversalProvidersMap>({});
const [loading, setLoading] = useState(true);
const [isFormOpen, setIsFormOpen] = useState(false);
const [editingProvider, setEditingProvider] = useState<UniversalProvider | null>(null);
```

**核心操作**:
```typescript
// 加载数据
const loadProviders = useCallback(async () => {
    const data = await universalProvidersApi.getAll();
    setProviders(data);
}, []);

// 保存并自动同步
const handleSave = useCallback(async (provider: UniversalProvider) => {
    await universalProvidersApi.upsert(provider);
    if (!editingProvider) {
        await universalProvidersApi.sync(provider.id); // 新建自动同步
    }
    loadProviders();
}, [editingProvider, loadProviders]);

// 手动同步
const handleSync = useCallback(async (id: string) => {
    await universalProvidersApi.sync(id);
    toast.success("已同步到所有应用");
}, []);
```

### 6.2 UniversalProviderFormModal 表单

**配置预览** (实时计算):
```typescript
// Claude 配置预览
const claudeConfigJson = useMemo(() => ({
    env: {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_AUTH_TOKEN: apiKey,
        ANTHROPIC_MODEL: models.claude?.model || "claude-sonnet-4-20250514",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: models.claude?.haikuModel,
        ANTHROPIC_DEFAULT_SONNET_MODEL: models.claude?.sonnetModel,
        ANTHROPIC_DEFAULT_OPUS_MODEL: models.claude?.opusModel,
    }
}), [baseUrl, apiKey, models.claude]);

// Codex 配置预览 (自动处理 /v1 后缀)
const codexConfigJson = useMemo(() => {
    const codexBaseUrl = baseUrl.endsWith("/v1")
        ? baseUrl
        : `${baseUrl.replace(/\/+$/, "")}/v1`;
    return {
        auth: { OPENAI_API_KEY: apiKey },
        config: `model_provider = "newapi"
model = "${models.codex?.model || "gpt-4o"}"
[model_providers.newapi]
base_url = "${codexBaseUrl}"`,
    };
}, [baseUrl, apiKey, models.codex]);
```

### 6.3 托盘交互

**托盘菜单结构**:
```rust
Menu {
    "Open main window",
    "---",
    "Claude",
    "  ✓ Auto (Failover)",      // 代理模式时选中
    "  ✓ Provider 1",           // 非代理模式时选中当前供应商
    "  Provider 2",
    "---",
    "Codex",
    "  ✓ Auto (Failover)",
    "  ✓ Provider A",
    "  Provider B",
    "---",
    "Quit",
}
```

**供应商切换事件**:
```rust
pub fn handle_provider_tray_event(app: &AppHandle, event_id: &str) {
    // 处理 "claude_provider-id" 格式的事件
    if let Some(provider_id) = event_id.strip_prefix("claude_") {
        handle_provider_click(app, &AppType::Claude, provider_id)?;
    }
}

fn handle_provider_click(app: &AppHandle, app_type: &AppType, provider_id: &str) {
    let state = app.state::<AppState>();
    ProviderService::switch(state, app_type.clone(), provider_id)?;
    update_tray_menu(app)?;
    // 发送事件通知前端刷新
    app.emit("provider-switched", payload)?;
}
```

---

## 七、关键特性实现

### 7.1 自定义端点管理

**数据结构**:
```rust
pub struct CustomEndpoint {
    pub url: String,
    pub added_at: i64,
    pub last_used: Option<i64>,
}
```

**存储方式**:
- 存储在 `provider.meta.custom_endpoints` (HashMap)
- 以 URL 为键去重
- 持久化到 `providers.meta` JSON 字段

**API**:
```rust
pub fn add_custom_endpoint(
    state: &AppState,
    app_type: AppType,
    provider_id: &str,
    url: String,
) -> Result<(), AppError> {
    let normalized = url.trim().trim_end_matches('/').to_string();
    state.db.add_custom_endpoint(app_type, provider_id, &normalized)
}

pub fn update_endpoint_last_used(...) {
    endpoint.last_used = Some(now_millis());
    db.save_provider(&provider)?;
}
```

### 7.2 速度测试

**实现**:
```rust
pub async fn test_endpoints(
    urls: Vec<String>,
    timeout_secs: Option<u64>,
) -> Result<Vec<EndpointLatency>, AppError> {
    let client = get(); // 全局 HTTP 客户端 (已配置代理)

    // 并发测试所有端点
    let tasks = urls.into_iter().map(|url| async {
        // 热身请求 (绕过首包惩罚)
        client.get(&url).timeout(timeout).send().await;

        // 第二次请求开始计时
        let start = Instant::now();
        let resp = client.get(&url).timeout(timeout).send().await;
        EndpointLatency {
            url,
            latency: Some(start.elapsed().as_millis()),
            status: Some(resp.status().as_u16()),
            error: None,
        }
    });

    join_all(tasks).await
}
```

**特点**:
- 热身请求避免首包延迟
- 使用全局代理配置
- 并发测试提高效率
- 返回延迟、状态码、错误信息

### 7.3 拖拽排序

**数据库更新**:
```rust
pub fn update_sort_order(
    state: &AppState,
    app_type: AppType,
    updates: Vec<ProviderSortUpdate>,
) -> Result<bool, AppError> {
    let mut providers = state.db.get_all_providers(app_type)?;

    for update in updates {
        if let Some(provider) = providers.get_mut(&update.id) {
            provider.sort_index = Some(update.sort_index);
            state.db.save_provider(app_type, provider)?;
        }
    }

    Ok(true)
}
```

**查询排序**:
```sql
SELECT ... FROM providers
WHERE app_type = ?1
ORDER BY
    COALESCE(sort_index, 999999),  -- 无排序索引的放最后
    created_at ASC,                 -- 相同索引按创建时间
    id ASC                          -- 最后按 ID
```

### 7.4 API Key 管理

**重要发现**: CC-Switch **没有实现 API Key 加密**!

- API Key 直接存储在 `settings_config` JSON 字段中
- 数据库文件本身无加密保护
- 依赖文件系统权限保证安全 (数据库文件权限 `0600`)

**风险缓解措施**:
1. 数据库文件权限: `0600` (仅所有者可读写)
2. 不参与 WebDAV 同步 (设备级数据)
3. SQL 导出时明文可见

**读取路径** (各应用不同):
```rust
// Claude
env["ANTHROPIC_AUTH_TOKEN"] 或 env["ANTHROPIC_API_KEY"]

// Codex
auth["OPENAI_API_KEY"]

// Gemini
env["GEMINI_API_KEY"]

// OpenCode
options["apiKey"]

// OpenClaw
apiKey (顶层字段)
```

---

## 八、代理服务器架构

### 8.1 代理架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Coding Assistant                       │
│                   (Cursor, Claude Code, etc.)               │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP Request
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Local Proxy Server                          │
│                   (localhost:15721)                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Request Interceptor                     │   │
│  │  - Add API key from encrypted storage               │   │
│  │  - Route to correct provider                        │   │
│  │  - Log request details                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Response Interceptor                    │   │
│  │  - Parse usage data                                 │   │
│  │  - Log token counts                                 │   │
│  │  - Calculate costs                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ModelManager                            │   │
│  │  - Get active provider                              │   │
│  │  - Get API key                                      │   │
│  │  - Log usage                                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS Request
                          │
                          ▼
              ┌───────────────────────┐
              │   AI Provider API     │
              │  (OpenAI, Anthropic)  │
              └───────────────────────┘
```

### 8.2 代理配置设计

**三行结构**: 每个应用独立配置行

```sql
CREATE TABLE proxy_config (
    app_type TEXT PRIMARY KEY,
    proxy_enabled INTEGER NOT NULL DEFAULT 0,
    listen_address TEXT NOT NULL DEFAULT '127.0.0.1',
    listen_port INTEGER NOT NULL DEFAULT 15721,
    -- ... 其他配置
);
```

**应用特定默认值**:
- Claude: 更激进的重试/超时配置 (6 次重试, 90s 首字节超时)
- Codex/Gemini: 标准配置

### 8.3 请求日志记录

```rust
pub struct RequestLog {
    pub request_id: String,
    pub provider_id: String,
    pub app_type: String,
    pub model: String,
    pub request_model: Option<String>,  // 实际请求的模型
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub input_cost_usd: String,
    pub output_cost_usd: String,
    pub total_cost_usd: String,
    pub latency_ms: u64,
    pub status_code: u16,
    pub error_message: Option<String>,
    // ...
}
```

**关键设计**:
- `request_model` 支持模型映射计费 (如请求 gpt-4,实际使用 gpt-4-turbo)
- TEXT 存储金额避免精度问题
- 记录 `session_id` 支持会话追踪

---

## 九、最佳实践与设计模式

### 9.1 SSOT (单一事实源) 架构

**数据流**:
```
Database (SSOT)
    ↓
Local Settings (device override)
    ↓
Live Config (runtime snapshot)
    ↓
AI Application
```

**核心原则**:
1. 数据库为主存储: 所有供应商配置持久化到 SQLite
2. 本地 settings 为设备级覆盖: `current_provider_xxx` 优先级高于数据库
3. Live 配置为运行时快照: 从数据库生成,可手动修改

### 9.2 Adapter 模式

**UniversalProvider 转换器**:
```rust
impl UniversalProvider {
    pub fn to_claude_provider(&self) -> Option<Provider> {
        if !self.apps.claude { return None; }

        Some(Provider {
            id: format!("universal-claude-{}", self.id),
            settings_config: json!({
                "env": {
                    "ANTHROPIC_BASE_URL": self.base_url,
                    "ANTHROPIC_AUTH_TOKEN": self.api_key,
                    // ...
                }
            }),
            // ...
        })
    }
}
```

**优势**:
- 一次配置,多应用复用
- 格式转换集中管理
- 易于扩展新应用

### 9.3 策略模式

**应用类型判断**:
```rust
impl AppType {
    pub fn is_additive_mode(&self) -> bool {
        matches!(self, AppType::OpenCode | AppType::OpenClaw)
    }
}

// 使用
if app_type.is_additive_mode() {
    // 所有供应商同时写入 live
} else {
    // 只写当前供应商
}
```

### 9.4 观察者模式

**数据库变更钩子**:
```rust
fn register_db_change_hook(conn: &Connection) {
    conn.update_hook(Some(|action, _db, table, _row_id| {
        match action {
            SQLITE_INSERT | SQLITE_UPDATE | SQLITE_DELETE => {
                webdav_auto_sync::notify_db_changed(table);
            }
            _ => {}
        }
    }));
}
```

**事件通知**:
```rust
// 托盘切换后通知前端
app.emit("provider-switched", ProviderSwitchEvent {
    app_type: app_type.as_str().to_string(),
    provider_id: id.to_string(),
})?;
```

---

## 十、设计亮点总结

### 10.1 回填机制

**解决问题**: 用户手动修改 live 配置后切换供应商,修改会丢失

**解决方案**: 切换前将当前 live 配置写回旧供应商

### 10.2 代理接管模式兼容

**场景**: 代理服务运行时切换供应商

**问题**: 直接写 live 会破坏代理接管配置

**解决**: 热切换模式 - 只更新数据库和备份,不修改 live

### 10.3 Codex Base URL 智能处理

**问题**: Codex 需要 `/v1` 后缀,但用户可能只输入 origin

**解决**:
```rust
// 智能添加 /v1
let codex_base_url = if base_trimmed.ends_with("/v1") {
    base_trimmed.to_string()
} else if origin_only {
    format!("{base_trimmed}/v1")
} else {
    base_trimmed.to_string() // 自定义前缀不强制加 /v1
};
```

### 10.4 累加模式支持

**设计**: OpenCode/OpenClaw 支持多供应商同时启用

**实现**:
- 数据库存储所有供应商
- Live 配置包含所有启用的供应商
- 添加/更新时直接写 live
- 删除时从 live 移除 (可选保留数据库记录)

### 10.5 双层当前供应商标记

**目的**: 云同步场景下多设备独立运作

**实现**:
```rust
// 设备级 (settings.json,不同步)
current_provider_claude: "provider-1"

// 云同步默认值 (数据库 is_current,同步)
is_current: true

// 获取时优先级
get_effective_current_provider() -> Option<String> {
    // 1. 读取本地 settings
    // 2. 验证存在性
    // 3. Fallback 到数据库 is_current
}
```

---

## 十一、Schema 迁移系统

### 11.1 版本迁移机制

```rust
pub(crate) const SCHEMA_VERSION: i32 = 5;  // 当前版本

pub(crate) fn apply_schema_migrations_on_conn(conn: &Connection) -> Result<(), AppError> {
    conn.execute("SAVEPOINT schema_migration;", [])?;

    let mut version = Self::get_user_version(conn)?;

    while version < SCHEMA_VERSION {
        match version {
            0 => Self::migrate_v0_to_v1(conn)?,
            1 => Self::migrate_v1_to_v2(conn)?,
            2 => Self::migrate_v2_to_v3(conn)?,
            3 => Self::migrate_v3_to_v4(conn)?,
            4 => Self::migrate_v4_to_v5(conn)?,
            _ => return Err(...)
        }
        version += 1;
    }

    conn.execute("RELEASE schema_migration;", [])?;
    Ok(())
}
```

### 11.2 迁移案例: v1→v2 (proxy_config 三行重构)

```rust
// 旧结构: 单例表 (无 app_type)
// 新结构: 三行表 (每应用独立配置)

fn migrate_proxy_config_to_per_app(conn: &Connection) -> Result<(), AppError> {
    // 1. 读取旧配置
    let old_config = conn.query_row("SELECT ... FROM proxy_config WHERE id = 1", ...)?;

    // 2. 创建新表
    conn.execute("CREATE TABLE proxy_config_new (...)", [])?;

    // 3. 插入三行 (应用特定默认值)
    conn.execute("INSERT INTO proxy_config_new VALUES ('claude', ...)", [])?;
    conn.execute("INSERT INTO proxy_config_new VALUES ('codex', ...)", [])?;
    conn.execute("INSERT INTO proxy_config_new VALUES ('gemini', ...)", [])?;

    // 4. 原子替换表
    conn.execute("DROP TABLE proxy_config", [])?;
    conn.execute("ALTER TABLE proxy_config_new RENAME TO proxy_config", [])?;

    Ok(())
}
```

### 11.3 兼容性处理

```rust
// 动态添加缺失列 (幂等操作)
Self::add_column_if_missing(conn, "providers", "in_failover_queue", "BOOLEAN NOT NULL DEFAULT 0")?;

// 检测旧表结构并自动迁移
if !Self::has_column(conn, "proxy_config", "app_type")? {
    Self::migrate_proxy_config_to_per_app(conn)?;
}
```

---

## 十二、备份与恢复机制

### 12.1 快照备份 (二进制)

```rust
fn backup_database_file(&self) -> Result<Option<PathBuf>, AppError> {
    let backup_path = backup_dir.join(format!("db_backup_{}.db", timestamp));

    let conn = lock_conn!(self.conn);
    let mut dest_conn = Connection::open(&backup_path)?;

    // 使用 rusqlite Backup API (原子操作)
    let backup = Backup::new(&conn, &mut dest_conn)?;
    backup.step(-1)?;  // -1 = 完整备份

    // 自动清理旧备份 (保留最新 10 个)
    Self::cleanup_db_backups(&backup_dir)?;

    Ok(Some(backup_path))
}
```

**触发时机**:
- SQL 导入前自动备份
- 用户手动导出时

### 12.2 SQL 导出 (文本)

```rust
fn dump_sql(conn: &Connection) -> Result<String, AppError> {
    let mut output = String::new();

    // 1. 写入头部 (包含版本信息)
    output.push_str("-- CC Switch SQLite 导出\n");
    output.push_str(&format!("PRAGMA user_version={};\n", user_version));

    // 2. 导出 Schema (CREATE 语句)
    // 3. 导出数据 (INSERT 语句)

    output.push_str("COMMIT;\n");
    Ok(output)
}
```

**安全导入**:
```rust
// 1. 验证 SQL 格式
Self::validate_cc_switch_sql_export(sql)?;

// 2. 备份现有数据库
let backup_path = self.backup_database_file()?;

// 3. 在临时数据库中执行导入
let temp_conn = Connection::open(&temp_path)?;
temp_conn.execute_batch(sql)?;

// 4. 校验基础状态
Self::validate_basic_state(&temp_conn)?;

// 5. 原子替换 (使用 Backup API)
let backup = Backup::new(&temp_conn, &mut main_conn)?;
backup.step(-1)?;
```

---

## 十三、对 unify-ai 的启示

### 13.1 架构层面

1. **采用 SSOT 架构**: SQLite 为单一数据源,JSON 为设备级存储
2. **双层配置管理**: 数据库 (可同步) + JSON (设备级)
3. **回填机制**: 保护用户手动修改
4. **代理接管兼容**: 热切换模式避免破坏代理配置

### 13.2 数据库设计

1. **复合主键**: `(id, tool_id)` 支持多工具隔离
2. **JSON 字段**: 灵活存储复杂配置
3. **TEXT 存储金额**: 避免浮点精度问题
4. **索引优化**: 根据查询模式设计复合索引
5. **版本化迁移**: 平滑升级路径

### 13.3 交互设计

1. **UniversalProvider 模式**: 一次配置,多工具复用
2. **实时配置预览**: 用户可见最终配置
3. **托盘快速切换**: 系统托盘直接切换供应商
4. **拖拽排序**: 直观的优先级管理

### 13.4 功能特性

1. **自定义端点管理**: 支持多个 API 端点
2. **速度测试**: 并发测试端点延迟
3. **代理服务器**: 透明代理,自动注入 API Key
4. **用量追踪**: 精确的成本计算
5. **健康监控**: 供应商可用性检测

### 13.5 需要改进的地方

1. **API Key 加密**: CC-Switch 没有加密,unify-ai 应该使用 Electron safeStorage
2. **连接池**: 高并发场景下考虑连接池
3. **日志清理**: 自动清理过期日志
4. **实时更新**: WebSocket 推送用量数据

---

## 十四、关键技术细节

### 14.1 并发控制

```rust
// 全局 Mutex 锁
pub struct AppState {
    pub db: Arc<Mutex<Database>>,
}

// 使用宏简化锁获取
macro_rules! lock_conn {
    ($mutex:expr) => {
        $mutex.lock().map_err(|e| AppError::Database(format!("Mutex lock failed: {}", e)))?
    };
}
```

### 14.2 事务处理

```rust
pub fn save_provider(&self, app_type: &str, provider: &Provider) -> Result<(), AppError> {
    let mut conn = lock_conn!(self.conn);
    let tx = conn.transaction()?;

    // 1. 插入/更新 Provider 主表
    tx.execute(...)?

    // 2. 批量插入自定义端点
    for endpoint in endpoints {
        tx.execute(...)?
    }

    tx.commit()?;
    Ok(())
}
```

### 14.3 错误处理

```rust
// 统一错误类型
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    // ...
}

// 使用
.map_err(|e| AppError::Database(format!("Operation failed: {e}")))?
```

---

## 十五、总结

CC-Switch 是一个设计精良的 AI 工具配置管理系统,其核心优势在于:

1. **清晰的架构**: SSOT + 双层存储,职责分明
2. **灵活的设计**: 支持多种配置模式 (切换/累加)
3. **完善的机制**: 回填、热切换、代理接管兼容
4. **丰富的功能**: 供应商管理、MCP、Skills、用量追踪
5. **良好的扩展性**: Adapter 模式易于添加新工具

对于 unify-ai 项目,CC-Switch 提供了宝贵的参考价值,特别是在:
- 数据库设计和迁移
- 配置同步机制
- 供应商切换逻辑
- 用户体验设计

但需要注意:
- **必须实现 API Key 加密** (CC-Switch 的最大缺陷)
- 考虑连接池提升性能
- 添加实时更新机制
- 完善监控和告警

---

**文档版本**: 1.0
**最后更新**: 2026-02-20
**基于 CC-Switch 版本**: v3.10.2
