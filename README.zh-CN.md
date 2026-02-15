# unify-ai

<div align="center">

[![npm 版本](https://img.shields.io/npm/v/unify-ai.svg)](https://www.npmjs.com/package/unify-ai)
[![许可: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 版本](https://img.shields.io/node/v/unify-ai)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178c6.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10+-f69220.svg)](https://pnpm.io/)

AI 编码助手的统一配置管理工具。

[English](./README.md) | [中文](./README.zh-CN.md)

</div>

## 概述

unify-ai 是一个用于统一管理多种 AI 编码助手配置的工具。支持从各种 AI 工具导入、导出，同步配置，以及检测配置冲突。

## 支持的工具

| 工具 | 规则 | MCP | 设置 | 配置格式 |
|------|------|-----|------|----------|
| Cursor | ✅ 完整 | ⚠️ 部分 | ⚠️ 部分 | Markdown + JSON |
| Claude Code | ✅ 完整 | ✅ 完整 | ✅ 完整 | Markdown + JSON |
| Codex | ✅ 完整 | ✅ 完整 | ✅ 完整 | TOML + Markdown |
| Copilot | ✅ 完整 | ❌ 无 | ❌ 无 | Markdown |
| Windsurf | ✅ 完整 | ⚠️ 部分 | ⚠️ 部分 | 纯文本 |
| Cline | ✅ 完整 | ✅ 完整 | ⚠️ 部分 | Markdown + JSON |
| Aider | ✅ 完整 | ❌ 无 | ✅ 完整 | YAML |
| Continue | ✅ 完整 | ⚠️ 部分 | ✅ 完整 | YAML |

## 功能特性

- 🔄 **导入/导出**：在不同 AI 工具配置之间转换
- 🔀 **双向同步**：保持各工具配置同步
- 📊 **差异检测**：检测配置之间的差异
- ⚔️ **冲突解决**：智能处理配置冲突
- 💻 **命令行工具**：便于自动化操作
- 🖥️ **图形界面**：可视化配置管理（即将推出）

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建项目
pnpm build
```

### 命令行使用

```bash
# 检测项目中的 AI 工具
unify-ai detect /path/to/project

# 从指定工具导入配置
unify-ai import cursor /path/to/project

# 导出统一配置到指定工具
unify-ai export cursor /path/to/project

# 显示工具之间的差异
unify-ai diff cursor /path/to/project

# 同步配置
unify-ai sync /path/to/project

# 监听配置变化
unify-ai watch /path/to/project
```

### 库使用

```typescript
import { adapterRegistry, Importer, Exporter } from '@unify-ai/core';

// 初始化适配器
await adapterRegistry.initialize();

// 从指定工具导入
const importer = new Importer();
const result = await importer.importFrom('cursor', '/path/to/project');

// 导出到指定工具
const exporter = new Exporter();
await exporter.exportTo('claude-code', config, '/path/to/project');
```

## 架构设计

这是一个 pnpm monorepo 项目，包含三个包：

- 📦 `@unify-ai/core` - 核心库，包含适配器和转换器
- 💻 `@unify-ai/cli` - 命令行工具
- 🖥️ `@unify-ai/gui` - Electron + React 图形界面（即将推出）

核心库使用**适配器模式**，每个 AI 工具都有独立的适配器实现 `IAdapter` 接口。

## 开发

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行测试
pnpm test

# 开发模式
pnpm dev          # 核心库
pnpm cli         # 命令行工具
pnpm gui         # 图形界面
```

## JSON Schema

配置文件 Schema 位于 `schemas/` 目录：

- `unified.schema.json` - 主统一配置 Schema
- `rules.schema.json` - 规则/指令 Schema
- `mcp.schema.json` - MCP 服务器配置 Schema
- `permission.schema.json` - 权限控制 Schema
- `model.schema.json` - 模型配置 Schema

## 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 贡献

欢迎贡献代码！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。
