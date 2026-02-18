# 开发命令指南

## 🚀 快速开始

```bash
# 一键启动开发环境（GUI + 热更新）
pnpm dev
```

## 📦 开发命令

### 核心开发

```bash
# 启动 GUI 开发环境（Electron + Vite + 热更新）
pnpm dev              # 或 pnpm dev:gui

# 启动 CLI 开发模式
pnpm dev:cli

# 启动 Core 库监听编译
pnpm dev:core
```

### 构建命令

```bash
# 构建所有包
pnpm build

# 构建单个包
pnpm build:core       # 构建核心库
pnpm build:cli        # 构建 CLI
pnpm build:gui        # 构建 GUI（包括 Electron）
```

### 测试命令

```bash
# 运行所有测试
pnpm test:all

# 运行单个包的测试
pnpm test             # 或 pnpm test:core
pnpm test:cli
pnpm test:gui
```

## 🎯 使用场景

### 场景 1: 开发 GUI 界面

```bash
# 启动带热更新的 GUI 开发环境
pnpm dev

# 效果：
# - Vite 开发服务器运行在 http://localhost:5173
# - Electron 窗口自动打开
# - 前端代码修改 → 自动刷新
# - Electron 主进程修改 → 自动重启
```

### 场景 2: 测试 CLI 命令

```bash
# 方式 1: 直接运行（推荐）
pnpm dev:cli -- --help
pnpm dev:cli -- init /tmp/test-project
pnpm dev:cli -- detect /tmp/test-project

# 方式 2: 全局链接（一次性设置）
cd packages/cli
pnpm link --global
unify-ai --help
unify-ai init /tmp/test-project
```

### 场景 3: 开发 Core 库

```bash
# 启动监听编译
pnpm dev:core

# 在另一个终端运行测试
pnpm test
```

### 场景 4: 构建和测试

```bash
# 构建所有包
pnpm build

# 运行所有测试
pnpm test:all

# 验证构建结果
cd packages/gui
ls dist/              # 前端构建产物
ls dist/electron/     # Electron 构建产物
```

## 🎨 前端开发（仅浏览器）

如果只想开发前端 UI（不启动 Electron）：

```bash
cd packages/gui
pnpm dev              # 仅启动 Vite 服务器

# 浏览器访问 http://localhost:5173
# 修改前端代码 → 即时热更新
```

## 📝 命令对照表

| 旧命令     | 新命令                       | 说明               |
| ---------- | ---------------------------- | ------------------ |
| `pnpm dev` | `pnpm dev:core`              | Core 库监听编译    |
| `pnpm cli` | `pnpm dev:cli`               | CLI 开发模式       |
| `pnpm gui` | `pnpm dev` 或 `pnpm dev:gui` | GUI 开发环境       |
| -          | `pnpm dev:gui`               | 明确指定 GUI 开发  |
| -          | `pnpm dev:core`              | 明确指定 Core 开发 |

## 🔥 推荐工作流

### 日常开发

```bash
# 终端 1: 启动 GUI 开发
pnpm dev

# 终端 2: 运行测试（可选）
pnpm test:all --watch
```

### Core 库开发

```bash
# 终端 1: Core 监听编译
pnpm dev:core

# 终端 2: 测试监听
pnpm test --watch

# 终端 3: GUI 开发（测试集成）
pnpm dev
```

### CLI 开发

```bash
# 终端 1: CLI 开发
pnpm dev:cli

# 终端 2: 测试
cd /tmp/test-project
unify-ai init .
unify-ai detect .
```

## 🛠️ 故障排除

### GUI 启动失败

```bash
# 清理并重新构建
pnpm build:gui
pnpm dev
```

### 测试失败

```bash
# 重新构建所有包
pnpm build
pnpm test:all
```

### CLI 命令找不到

```bash
# 使用完整路径
pnpm dev:cli -- --help

# 或全局链接
cd packages/cli && pnpm link --global
```

## 💡 提示

- `pnpm dev` 默认启动 GUI（最常用）
- 所有 `dev:*` 命令都支持热更新/监听
- 使用 `--` 分隔符传递参数给子命令
- 测试使用 Vitest，支持 `--watch` 模式
