# 人工智能学习助手

一个基于 **Electron + React + TypeScript** 的桌面学习工作台，面向理工科课程学习场景。它把 **主题、课堂笔记、PDF 讲义** 统一进一个三栏工作区：左侧知识地图、中间阅读区、右侧 AI 讲解区，帮助你围绕材料进行结构化理解、追问和笔记沉淀。

## 主要能力

- **从主题开始学习**：输入一个概念，生成知识节点并进入工作台
- **从课堂笔记整理知识结构**：将原始笔记切分成多个更有意义的知识节点
- **PDF 阅读联动**：导入讲义或课件后，支持页码跳转、章节导航、节点页联动
- **AI 会话式讲解**：自动讲解当前节点，支持继续追问，并保留对话历史
- **学习笔记沉淀**：可以把 AI 回复保存为笔记，也可以手动整理当前节点理解
- **暖色学习工作台 UI**：参考 Claude Desktop 的温暖桌面气质，但针对“学习助手”场景重新设计

## 技术栈

- **桌面壳**：Electron
- **前端**：React 19 + TypeScript + Vite
- **状态管理**：Jotai
- **PDF**：react-pdf + pdfjs-dist
- **AI**：OpenAI Node SDK（兼容 OpenAI 接口）
- **测试**：Vitest + Testing Library

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 启动前端开发环境

```bash
npm run dev
```

### 3. 启动桌面端

```bash
npm run electron:start
```

## 构建与校验

```bash
npm run lint
npm run test
npm run build
```

## AI 配置说明

应用支持在首页直接填写：

- `API 密钥`
- `API 地址`
- `模型`

桌面端会把这些配置保存到用户目录下，并在调用 AI 讲解时通过 Electron 主进程发起请求。

你也可以通过环境变量提供默认配置：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

## Electron 与浏览器预览的区别

### 桌面端（完整模式）

- 可打开本地 PDF
- 可读取本地文件
- 可调用真实 AI 接口

### 浏览器预览（演示模式）

- 仍可体验主要 UI 和工作台结构
- 可在浏览器里选择本地 PDF 进行预览式体验
- AI 区会返回**演示讲解文本**，用于说明交互流程
- 不代表桌面端真实 AI 能力上限

## 项目结构

```text
electron/                 Electron 主进程与 preload
scripts/                  开发辅助脚本
src/components/           主要界面组件
src/hooks/                输入/导入相关逻辑
src/services/             AI、PDF、工作区构建等服务
src/store/                Jotai 状态原子
src/types/                类型定义
tests/                    Electron 侧测试
```

## 当前交付状态

已完成并验证：

- `npm run lint` ✅
- `npm run test` ✅
- `npm run build` ✅
- Electron 可启动 ✅

## 适合继续扩展的方向

- 工作区与学习笔记持久化
- 更强的 PDF 目录/章节抽取
- 流式 AI 回复
- 更精细的知识图谱关系推断

## License

当前仓库未单独附带许可证文件。如需开源分发，建议补充明确 License。
