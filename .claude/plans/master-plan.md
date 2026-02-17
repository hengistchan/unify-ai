# unify-ai 主开发计划

**版本**: 1.0.0
**日期**: 2026-02-17
**项目**: unify-ai - AI 编码工具配置统一管理

---

## 1. 项目概述

### 1.1 目标

创建一个统一管理多种 AI 编码工具（Cursor, Claude Code, Copilot, Windsurf, Codex, Cline, Aider, Continue）配置的工具，支持：
- 配置导入/导出
- 双向同步
- 冲突检测与解决
- CLI 和 GUI 界面

### 1.2 当前状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 核心类型 | ✅ 完成 | types.ts, 能力枚举 |
| 适配器基类 | ✅ 完成 | BaseAdapter, IAdapter, Capability |
| 8 个适配器 | ✅ 完成 | 全部 8 个工具适配器 |
| 适配器注册表 | ✅ 完成 | AdapterRegistry |
| 文件发现 | ✅ 完成 | FileDiscovery |
| 转换器 | ✅ 完成 | Importer, Exporter, ConflictResolver, DiffEngine |
| 变更追踪 | ✅ 完成 | ChangeTracker, FingerprintManager |
| 配置管理 | ✅ 完成 | ConfigManager, validator |
| CLI 包 | ✅ 骨架完成 | packages/cli 骨架已创建 |
| GUI 包 | ✅ 完成 | packages/gui 已完成 |
| JSON Schema | ✅ 完成 | schemas/ 目录 |
| 文档 | ✅ 完成 | README, LICENSE, CONTRIBUTING, CLAUDE.md |
| 单元测试 | ❌ 未开始 | - |

---

## 2. 开发阶段

### Phase 1: 核心能力完善 (Week 1)

#### 1.1 完善转换器模块

**任务**:
- [x] 完善 `src/converter/Exporter.ts` - 导出逻辑
- [x] 实现 `src/converter/DiffEngine.ts` - 差异检测
- [x] 完善 `src/converter/ConflictResolver.ts` - 冲突解决
- [x] 实现 `src/converter/ChangeTracker.ts` - 变更追踪
- [x] 实现 `src/converter/FingerprintManager.ts` - 指纹管理

**文件**:
```
src/converter/
├── index.ts
├── Importer.ts (已有)
├── Exporter.ts (需完善)
├── DiffEngine.ts (新建)
├── ConflictResolver.ts (需完善)
├── ChangeTracker.ts (新建)
├── FingerprintManager.ts (新建)
└── SyncWatcher.ts (新建)
```

#### 1.2 统一配置 Schema

**任务**:
- [x] 创建 `schemas/unified.schema.json` - 主配置 JSON Schema
- [x] 实现 `src/core/ConfigManager.ts` - 配置加载/保存/验证

**文件**:
```
src/
├── core/
│   ├── ConfigManager.ts (新建)
│   └── validator.ts (新建)
└── schemas/
    └── unified.schema.json (新建)
```

---

### Phase 2: CLI 工具 (Week 2)

#### 2.1 CLI 框架搭建

**任务**:
- [x] 初始化 CLI 包 (`packages/cli`)
- [x] 配置 commander.js 或 picocolors
- [x] 实现核心命令

**命令设计**:
```
unify-ai <command> [options]

Commands:
  init              初始化 unified.json
  detect            检测项目中的 AI 工具
  import [tools]    从工具配置导入
  export [tools]    导出到工具配置
  sync              双向同步
  diff [tool]       查看差异
  status            查看同步状态
  watch             监听文件变化
  resolve           解决冲突

Options:
  -c, --config     配置文件路径
  -t, --target     目标工具
  -f, --format     输出格式 (table/json/yaml)
  --dry-run        预览模式
```

**文件**:
```
packages/cli/
├── bin/
│   └── unify-ai.ts
├── src/
│   ├── index.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── detect.ts
│   │   ├── import.ts
│   │   ├── export.ts
│   │   ├── sync.ts
│   │   ├── diff.ts
│   │   ├── status.ts
│   │   ├── watch.ts
│   │   └── resolve.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── config.ts
│   │   └── formatter.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

#### 2.2 CLI 功能实现

**任务**:
- [x] 实现 init 命令 - 创建 unified.json
- [x] 实现 detect 命令 - 自动检测工具
- [x] 实现 import/export 命令
- [x] 实现 sync 命令 - 同步逻辑
- [x] 实现 diff 命令 - 差异显示
- [x] 实现 status 命令 - 状态查看
- [x] 实现 watch 命令 - 文件监听

---

### Phase 3: Electron GUI 应用 (Week 3-4)

#### 3.1 项目初始化

**任务**:
- [x] 初始化 Electron + React + Vite 项目
- [x] 配置 Tailwind CSS
- [x] 配置 Electron Builder
- [x] 设置 IPC 通信机制

**文件**:
```
packages/gui/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── ipc/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── stores/
│   └── styles/
├── public/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── electron-builder.yml
└── tsconfig.json
```

#### 3.2 布局组件

**任务**:
- [x] 实现侧边栏组件 (Sidebar)
- [x] 实现主内容区布局
- [x] 实现工具栏 (Toolbar)
- [x] 实现状态栏 (StatusBar)

#### 3.3 页面实现

**任务**:
- [x] 首页/项目视图
- [x] 工具配置详情页
- [x] 同步预览对话框
- [x] 设置页面

#### 3.4 IPC 集成

**任务**:
- [x] 实现主进程命令处理
- [x] 实现渲染进程 API 调用
- [x] 实现文件选择对话框

---

### Phase 4: 测试与发布 (Week 5)

#### 4.1 单元测试

**任务**:
- [ ] 适配器测试
- [ ] 转换器测试
- [ ] CLI 测试
- [ ] GUI 组件测试

#### 4.2 发布准备

**任务**:
- [ ] 版本号管理
- [ ] 发布 npm 包
- [ ] 构建 Electron 安装包
- [ ] 编写文档

---

## 3. 任务依赖图

```
Phase 1: 核心完善
├── 完善 Exporter
├── 实现 DiffEngine
├── 完善 ConflictResolver
├── 实现 ChangeTracker
├── 实现 FingerprintManager
└── 实现 ConfigManager
    │
    ▼
Phase 2: CLI
├── CLI 框架
├── init 命令
├── detect 命令
├── import/export 命令
├── sync 命令
├── diff 命令
├── status 命令
└── watch 命令
    │
    ▼
Phase 3: GUI
├── Electron 项目
├── 布局组件
├── 首页/项目视图
├── 工具详情页
├── 同步预览
└── 设置页面
    │
    ▼
Phase 4: 测试发布
├── 单元测试
├── 集成测试
├── 发布 CLI
└── 发布 GUI
```

---

## 4. 文件清单

### 4.1 现有文件 (保持不变)

```
src/
├── adapters/
│   ├── base/
│   │   ├── BaseAdapter.ts
│   │   ├── Capability.ts
│   │   ├── IAdapter.ts
│   │   └── index.ts
│   ├── cursor/
│   ├── claude-code/
│   ├── copilot/
│   ├── windsurf/
│   ├── codex/
│   ├── cline/
│   ├── aider/
│   ├── continue/
│   ├── index.ts
│   └── registry.ts
├── converter/
│   ├── Importer.ts
│   ├── Exporter.ts
│   └── ConflictResolver.ts
├── core/
│   ├── types.ts
│   └── index.ts
├── discovery/
│   ├── FileDiscovery.ts
│   ├── patterns.ts
│   └── index.ts
└── index.ts
```

### 4.2 新增文件 (Phase 1)

```
src/
├── converter/
│   ├── DiffEngine.ts          # 新建
│   ├── ChangeTracker.ts       # 新建
│   ├── FingerprintManager.ts  # 新建
│   └── SyncWatcher.ts         # 新建
├── core/
│   ├── ConfigManager.ts       # 新建
│   └── validator.ts           # 新建
└── schemas/
    └── unified.schema.json     # 新建
```

### 4.3 新增文件 (Phase 2)

```
packages/cli/
├── bin/
│   └── unify-ai.ts
├── src/
│   ├── index.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── detect.ts
│   │   ├── import.ts
│   │   ├── export.ts
│   │   ├── sync.ts
│   │   ├── diff.ts
│   │   ├── status.ts
│   │   ├── watch.ts
│   │   └── resolve.ts
│   └── utils/
│       ├── logger.ts
│       ├── config.ts
│       └── formatter.ts
└── package.json
```

### 4.4 新增文件 (Phase 3)

```
packages/gui/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── ipc/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── Badge.tsx
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── Toolbar.tsx
│   │       └── StatusBar.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Project.tsx
│   │   ├── ToolDetail.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   ├── useProject.ts
│   │   └── useSync.ts
│   ├── stores/
│   │   └── appStore.ts
│   └── styles/
│       └── globals.css
├── public/
│   └── icon.png
└── package.json
```

---

## 5. 验收标准

### Phase 1 验收

- [x] `npm run build` 编译通过
- [x] 能够导入/导出配置
- [x] 差异检测正常工作
- [x] 冲突解决正常工作
- [x] 变更追踪正常工作

### Phase 2 验收

- [x] CLI 命令行工具可用
- [x] `unify-ai detect` 能检测项目中的工具
- [x] `unify-ai sync` 能执行同步
- [x] `unify-ai watch` 能监听文件变化
- [x] 支持 JSON/Table 输出格式

### Phase 3 验收

- [x] Electron 应用能启动
- [x] 能打开项目文件夹
- [x] 能显示工具配置状态
- [x] 能执行同步操作
- [x] 窗口可调整大小 (最小 900x600)

### Phase 4 验收

- [ ] 单元测试覆盖 > 70%
- [ ] CLI 包发布到 npm
- [ ] GUI 生成可执行安装包
- [x] README 文档完整

---

## 6. 后续规划

### v1.1 (后续迭代)

- [ ] 配置模板系统
- [ ] 团队配置共享
- [ ] 云端同步

### v1.2

- [ ] VS Code 插件
- [ ] Web 版本

---

*计划版本: 1.0.0*
*最后更新: 2026-02-17*
