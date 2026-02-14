# unify-ai GUI 设计文档

**版本**: 1.0.0
**日期**: 2026-02-14
**项目**: unify-ai
**类型**: Electron Desktop Application

---

## 1. 产品概述

### 1.1 产品定位

**unify-ai** 是一个用于统一管理多种 AI 编码工具配置的桌面应用。通过适配器模式，将 8 种主流 AI 编码工具的配置文件进行统一管理和同步。

### 1.2 目标用户

- **开发者**: 使用多种 AI 编码工具的开发者
- **团队 Lead**: 需要统一团队编码规范的 Tech Lead
- **AI 爱好者**: 希望统一管理多个 AI 工具配置的用户

### 1.3 支持的工具

| 工具 | 配置文件 | 主要能力 |
|------|----------|----------|
| Cursor | `.cursor/rules/*.md`, `.cursor/mcp.json` | Rules, MCP, Settings |
| Claude Code | `.claude/settings.json`, `.claude/rules/*` | Rules, MCP, Settings |
| Copilot | `.github/copilot-instructions.md` | Rules only |
| Windsurf | `.windsurfrules`, `.windsurf/mcp.json` | Rules, MCP |
| Codex | `AGENTS.md`, `.codex/config.toml` | Rules, MCP, Settings |
| Cline | `.clinerules/`, `.cline/state.json` | Rules, MCP, Settings |
| Aider | `.aider.conf.yml` | Rules, Settings |
| Continue | `.continue/config.yaml` | Rules, MCP, Settings, Prompts |

---

## 2. 设计系统

### 2.1 视觉风格

**风格**: OLED Dark Mode + Modern Tech

- **背景**: Deep Black (#000000) + Dark Grey (#121212)
- **主色**: Vibrant Purple (#7C3AED)
- **次色**: Soft Purple (#A78BFA)
- **强调色**: Action Orange (#F97316)
- **文本**: White (#FFFFFF) / Light Gray (#E0E0E0)
- **成功**: Neon Green (#10B981)
- **警告**: Amber (#F59E0B)
- **错误**: Red (#EF4444)

### 2.2 配色方案 (CSS Variables)

```css
:root {
  /* 背景色 */
  --bg-primary: #000000;
  --bg-secondary: #121212;
  --bg-tertiary: #1E1E1E;
  --bg-elevated: #252525;
  --bg-hover: #2A2A2A;

  /* 文字色 */
  --text-primary: #FFFFFF;
  --text-secondary: #A1A1AA;
  --text-tertiary: #71717A;
  --text-disabled: #52525B;

  /* 主题色 */
  --color-primary: #7C3AED;
  --color-primary-hover: #8B5CF6;
  --color-primary-muted: rgba(124, 58, 237, 0.15);

  --color-secondary: #A78BFA;

  /* 强调色 */
  --color-accent: #F97316;
  --color-accent-hover: #FB923C;

  /* 状态色 */
  --color-success: #10B981;
  --color-success-muted: rgba(16, 185, 129, 0.15);
  --color-warning: #F59E0B;
  --color-warning-muted: rgba(245, 158, 11, 0.15);
  --color-error: #EF4444;
  --color-error-muted: rgba(239, 68, 68, 0.15);

  /* 边框 */
  --border-default: #27272A;
  --border-hover: #3F3F46;
  --border-focus: #7C3AED;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px rgba(124, 58, 237, 0.3);

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* 过渡 */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;

  /* 字体 */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### 2.3 字体排版

**字体选择**:
- **Heading**: Space Grotesk (Google Fonts)
- **Body**: Inter (系统字体)
- **Code**: JetBrains Mono

**字号系统**:
```css
--text-xs: 12px;
--text-sm: 14px;
--text-base: 16px;
--text-lg: 18px;
--text-xl: 20px;
--text-2xl: 24px;
--text-3xl: 30px;
--text-4xl: 36px;
```

**行高**:
- 标题: 1.2
- 正文: 1.5
- 代码: 1.6

### 2.4 图标系统

使用 **Lucide Icons** (React 版本)

```bash
npm install lucide-react
```

**核心图标**:
- `Settings` - 设置
- `RefreshCw` - 同步
- `FolderOpen` - 打开项目
- `FileCode` - 配置文件
- `Plus` - 添加
- `Trash2` - 删除
- `Edit` - 编辑
- `Eye` - 预览
- `Check` - 确认
- `X` - 关闭
- `ChevronRight` - 展开
- `ChevronDown` - 折叠
- `AlertCircle` - 警告
- `Info` - 信息
- `Search` - 搜索
- `ArrowRight` - 导入
- `ArrowLeft` - 导出
- `Link` - 关联
- `Unlink` - 取消关联

---

## 3. 界面结构

### 3.1 窗口模型

**主窗口**:
- 尺寸: 1200x800 (最小: 900x600)
- 可调整大小
- 居中显示
- 使用系统原生窗口控件

**对话框**:
- 模态对话框 (设置、同步预览)
- 非模态通知 (Toast)

### 3.2 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  标题栏 (系统原生)                                           │
├──────────────┬──────────────────────────────────────────────┤
│              │  工具栏                                        │
│   侧边栏      ├──────────────────────────────────────────────┤
│   (220px)    │                                              │
│              │  主内容区                                      │
│   - 项目      │                                              │
│   - 工具      │                                              │
│   - 设置      │                                              │
│              │                                              │
│              ├──────────────────────────────────────────────┤
│              │  状态栏                                        │
└──────────────┴──────────────────────────────────────────────┘
```

### 3.3 侧边栏 (Sidebar)

**宽度**: 220px (可折叠至 60px)

**结构**:
```
┌────────────────────┐
│ [Logo] unify-ai   │
├────────────────────┤
│ 🔍 搜索项目        │
├────────────────────┤
│ 📁 当前项目        │
│   └─ /path/to/proj │
├────────────────────┤
│ 🔧 工具            │
│   ├─ Cursor    ✓  │
│   ├─ Claude    ✓  │
│   ├─ Copilot   ✗  │
│   ├─ Windsurf  ✓  │
│   ├─ Codex     ✗  │
│   ├─ Cline     ✗  │
│   ├─ Aider     ✗  │
│   └─ Continue  ✗  │
├────────────────────┤
│ ⚙️ 设置            │
│ 🔄 同步            │
└────────────────────┘
```

### 3.4 主内容区

**工具栏**:
- 面包屑导航
- 操作按钮 (同步、导入、导出)
- 视图切换 (列表/卡片)

**内容面板**:
- 配置文件列表
- 详情编辑器
- 预览面板

### 3.5 状态栏

- 同步状态
- 最后更新时间
- 错误/警告计数

---

## 4. 核心功能视图

### 4.1 首页/项目视图

```
┌─────────────────────────────────────────────────────────────┐
│ unify-ai                              [同步] [设置] [—][□][×]│
├──────────────┬──────────────────────────────────────────────┤
│ 🔍 搜索...   │  📁 my-project                               │
│              │  /Users/dev/my-project                        │
│ 📁 项目      │                                              │
│   └─ proj1  │ ┐  │
│ ┌────────────────────────────────────────   └─ proj2  │  │ 检测到: Cursor, Claude Code, Continue  │  │
│              │  │                                          │  │
│ 🔧 工具      │  │ [同步所有] [添加工具]                     │  │
│   └─ Cursor │  └────────────────────────────────────────┘  │
│   └─ Claude │                                              │
│   └─ Continue│  配置文件                                    │
│              │  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ ⚙️ 设置      │  │ Cursor  │ │ Claude  │ │Continue │        │
│              │  │ .cursor │ │ .claude │ │.continue│        │
│              │  │  ✓ 3    │ │  ✓ 5    │ │  ✓ 2    │        │
│              │  └─────────┘ └─────────┘ └─────────┘        │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 4.2 工具配置详情

```
┌─────────────────────────────────────────────────────────────┐
│ ← 返回   Cursor 配置                            [编辑] [删除]│
├──────────────┬──────────────────────────────────────────────┤
│              │  ┌─────────────────────────────────────────┐ │
│ 规则文件     │  │ 规则文件 (.cursor/rules/)               │ │
│ ├─ rules.md │  │                                         │ │
│ ├─ code.md  │  │ 名称: 代码规范                           │ │
│ └─ docs.md  │  │ 描述: 项目代码规范                        │ │
│              │  │ 文件: rules.md                          │ │
│ MCP 服务器   │  │ 范围: ["*.ts", "*.tsx"]                 │ │
│ ├─ server1  │  │                                         │ │
│ └─ server2  │  │ [预览] [编辑] [删除]                     │ │
│              │  └─────────────────────────────────────────┘ │
│ 设置         │                                              │
│ └─ editor   │  ┌─────────────────────────────────────────┐ │
│              │  │ MCP 服务器                              │ │
│              │  │                                         │ │
│              │  │ + 添加 MCP 服务器                       │ │
│              │  └─────────────────────────────────────────┘ │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 4.3 同步预览

```
┌─────────────────────────────────────────────────────────────┐
│ 同步预览                                     [取消] [确认同步] │
├──────────────┬──────────────────────────────────────────────┤
│              │  检测到以下更改:                              │
│ 源配置       │                                              │
│ └─ Unified   │  ┌────────────────────────────────────────┐  │
│              │  │ + cursor/rules/new-rule.md            │  │
│ 目标工具     │  │ ~ claude/settings.json                │  │
│ ├─ Cursor   │  │ ~ windsurf/mcp.json                   │  │
│ ├─ Claude   │  │                                        │  │
│ └─ Windsurf │  └────────────────────────────────────────┘  │
│              │                                              │
│ 选项         │  冲突解决:                                    │
│ ☑ 备份      │  ┌────────────────────────────────────────┐  │
│ ☑ 覆盖      │  │ [保留源] [保留目标] [合并]              │  │
│ ☐ 预览 only │  └────────────────────────────────────────┘  │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 4.4 设置页面

```
┌─────────────────────────────────────────────────────────────┐
│ 设置                                            [保存] [取消]│
├──────────────┬──────────────────────────────────────────────┤
│              │  常规                                        │
│ 常规         │  ┌────────────────────────────────────────┐ │
│ ├─ 外观     │  │ 启动时打开: [选择项目         ▼]        │ │
│ ├─ 同步     │  │ 自动同步: [☑ 每小时] [☑ 启动时]          │ │
│ ├─ 快捷键   │  │ 备份: [☑ 自动备份] [保留天数: 7 ▼]       │ │
│ └─ 关于     │  └────────────────────────────────────────┘  │
│              │                                              │
│              │  外观                                        │
│              │  ┌────────────────────────────────────────┐  │
│              │  │ 主题: [● 深色] [○ 浅色] [○ 跟随系统]   │  │
│              │  │ 动画: [☑ 启用动画]                      │  │
│              │  │ 透明效果: [☑ 启用毛玻璃效果]            │  │
│              │  └────────────────────────────────────────┘  │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

---

## 5. 组件规范

### 5.1 按钮

**主按钮**:
```tsx
<button className="btn-primary">
  <Icon name="RefreshCw" size={16} />
  同步
</button>

/* CSS */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  box-shadow: var(--shadow-glow);
}

.btn-primary:active {
  transform: scale(0.98);
}
```

**次按钮**:
```tsx
<button className="btn-secondary">
  取消
</button>

.btn-secondary {
  padding: 8px 16px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}
```

### 5.2 卡片

```tsx
<div className="card">
  <div className="card-header">
    <Icon name="FileCode" size={20} className="text-primary" />
    <span className="card-title">Cursor</span>
    <span className="badge badge-success">已配置</span>
  </div>
  <div className="card-body">
    <p className="text-secondary">3 个规则文件</p>
    <p className="text-tertiary">2 个 MCP 服务器</p>
  </div>
  <div className="card-footer">
    <button className="btn-ghost">编辑</button>
    <button className="btn-ghost">同步</button>
  </div>
</div>

/* CSS */
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--transition-normal);
}

.card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-default);
}

.card-body {
  padding: 16px;
}

.card-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg-tertiary);
}
```

### 5.3 列表项

```tsx
<li className="list-item">
  <Icon name="FileText" size={18} />
  <div className="list-item-content">
    <span className="list-item-title">rules.md</span>
    <span className="list-item-meta">Markdown • 2.3 KB</span>
  </div>
  <button className="btn-icon">
    <Icon name="MoreVertical" size={16} />
  </button>
</li>

.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.list-item:hover {
  background: var(--bg-hover);
}
```

### 5.4 徽章

```tsx
<span className="badge badge-success">已配置</span>
<span className="badge badge-warning">待同步</span>
<span className="badge badge-error">错误</span>

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-full);
}

.badge-success {
  background: var(--color-success-muted);
  color: var(--color-success);
}

.badge-warning {
  background: var(--color-warning-muted);
  color: var(--color-warning);
}

.badge-error {
  background: var(--color-error-muted);
  color: var(--color-error);
}
```

### 5.5 输入框

```tsx
<input
  type="text"
  className="input"
  placeholder="搜索项目..."
/>

.input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: all var(--transition-fast);
}

.input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--color-primary-muted);
}

.input::placeholder {
  color: var(--text-tertiary);
}
```

### 5.6 开关

```tsx
<label className="toggle">
  <input type="checkbox" />
  <span className="toggle-slider"></span>
  <span className="toggle-label">启用自动同步</span>
</label>

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.toggle input {
  display: none;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  transition: background var(--transition-fast);
}

.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: var(--text-secondary);
  border-radius: 50%;
  transition: all var(--transition-fast);
}

.toggle input:checked + .toggle-slider {
  background: var(--color-primary);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(20px);
  background: white;
}
```

---

## 6. 交互规范

### 6.1 动画

| 场景 | 动画 | 时长 |
|------|------|------|
| 按钮悬停 | scale(1.02) + glow | 150ms |
| 卡片悬停 | translateY(-2px) + shadow | 200ms |
| 侧边栏折叠 | width 变化 | 200ms |
| 页面切换 | fade + slide | 250ms |
| 模态框 | fade + scale | 200ms |
| Toast 通知 | slide-in from right | 300ms |

### 6.2 键盘导航

- `Tab` - 焦点顺序导航
- `Enter` - 确认选择
- `Escape` - 关闭对话框/取消
- `Ctrl+S` - 保存
- `Ctrl+,` - 打开设置
- `Ctrl+O` - 打开项目

### 6.3 反馈

- **成功**: Toast 通知 (绿色) + 短暂震动
- **错误**: Toast 通知 (红色) + 聚焦错误字段
- **加载**: 骨架屏 (Skeleton) + 旋转指示器

---

## 7. 技术栈

### 7.1 前端框架

```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "lucide-react": "^0.294.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "electron-builder": "^24.9.0"
  }
}
```

### 7.2 项目结构

```
unify-ai/
├── electron/
│   ├── main.ts              # 主进程
│   ├── preload.ts           # 预加载脚本
│   └── ipc/                 # IPC 处理器
├── src/
│   ├── components/          # React 组件
│   │   ├── common/          # 通用组件
│   │   ├── layout/          # 布局组件
│   │   ├── project/         # 项目视图
│   │   ├── tool/            # 工具配置
│   │   └── settings/        # 设置页面
│   ├── hooks/               # 自定义 Hooks
│   ├── stores/              # Zustand 状态管理
│   ├── services/            # 业务逻辑
│   ├── utils/               # 工具函数
│   ├── styles/              # 全局样式
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── icon.png
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── electron-builder.yml
└── tsconfig.json
```

---

## 8. 验收标准

### 8.1 功能验收

- [ ] 能够打开项目文件夹并自动检测工具配置
- [ ] 能够在列表中显示所有 8 种工具的配置状态
- [ ] 能够查看单个工具的配置文件详情
- [ ] 能够编辑和保存配置文件
- [ ] 能够实现工具间的配置同步
- [ ] 同步前显示预览并支持冲突解决
- [ ] 设置页面能够保存用户偏好

### 8.2 视觉验收

- [ ] 深色主题符合设计规范
- [ ] 所有图标使用 Lucide Icons
- [ ] 按钮悬停有正确的动画反馈
- [ ] 卡片悬停有正确的提升效果
- [ ] 侧边栏能够折叠/展开
- [ ] 窗口能够调整大小 (最小 900x600)

### 8.3 交互验收

- [ ] Tab 键能够按顺序导航所有可交互元素
- [ ] Enter 键能够确认操作
- [ ] Escape 键能够关闭对话框
- [ ] 所有点击有即时视觉反馈
- [ ] Toast 通知在操作后正确显示

### 8.4 性能验收

- [ ] 冷启动时间 < 3 秒
- [ ] 页面切换 < 200ms
- [ ] 配置文件解析 < 500ms

---

## 9. 后续规划

### Phase 2 (后续迭代)
- [ ] 导入/导出统一配置
- [ ] 配置模板系统
- [ ] 团队配置共享
- [ ] 云端同步

### Phase 3
- [ ] CLI 工具
- [ ] VS Code 插件
- [ ] Web 版本

---

*文档版本: 1.0.0*
*最后更新: 2026-02-14*
