# 前端架构文档

## 概述

Claude Code Haha 前端是一个基于 Electron + React 的桌面应用，为用户提供图形化的 AI 编程工作台。前端通过 REST API 和 WebSocket 与后端通信，支持多会话管理、代码编辑、权限审批、模型配置等功能。

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 框架 | React 18 | UI 组件框架 |
| 状态管理 | Zustand | 轻量级状态管理 |
| UI 样式 | Tailwind CSS 4 | CSS 框架 |
| 图标 | Lucide React | 图标库 |
| 代码编辑器 | Monaco (via LSP) | 代码编辑支持 |
| 终端 | xterm.js | 终端仿真 |
| 构建工具 | Vite | 构建工具 |
| 测试 | Vitest | 测试框架 |
| 桌面框架 | Electron | 跨平台桌面应用 |

## 核心架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Electron 主进程                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     electron/main.ts                        │   │
│  │  - 窗口管理                                                 │   │
│  │  - 应用生命周期                                             │   │
│  │  - 本地文件系统访问                                          │   │
│  │  - 系统通知                                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │ IPC / preload
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      渲染进程 (React)                               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        App.tsx                              │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │                  AppShell.tsx                        │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │   │   │
│  │  │  │ Sidebar  │  │  TabBar  │  │  ContentRouter   │   │   │   │
│  │  │  │ (会话列表)│  │ (标签栏) │  │   (页面路由)     │   │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────────────┘   │   │   │
│  │  │                           │                        │   │   │
│  │  │                           ▼                        │   │   │
│  │  │              ┌──────────────────────────┐           │   │   │
│  │  │              │     ChatSession.tsx      │           │   │   │
│  │  │              │  (聊天会话主组件)         │           │   │   │
│  │  │              └──────────────────────────┘           │   │   │
│  │  │              ┌──────────────────────────┐           │   │   │
│  │  │              │     MessageList.tsx      │           │   │   │
│  │  │              │  (消息列表)               │           │   │   │
│  │  │              └──────────────────────────┘           │   │   │
│  │  │              ┌──────────────────────────┐           │   │   │
│  │  │              │     MessageComposer.tsx  │           │   │   │
│  │  │              │  (消息输入框)             │           │   │   │
│  │  │              └──────────────────────────┘           │   │   │
│  │  │              ┌──────────────────────────┐           │   │   │
│  │  │              │     PermissionPanel.tsx  │           │   │   │
│  │  │              │  (权限审批面板)           │           │   │   │
│  │  │              └──────────────────────────┘           │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        Stores (Zustand)                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │chatStore │  │session   │  │uiStore   │  │settings  │  │   │
│  │  │(聊天状态) │  │ Store    │  │ (UI状态) │  │ Store    │  │   │
│  │  │          │  │(会话存储) │  │          │  │ (设置)   │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        API Layer                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │client.ts │  │sessions  │  │websocket │  │providers │  │   │
│  │  │(HTTP客户端)│ │Api.ts    │  │Manager   │  │Api.ts    │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
desktop/
├── electron/                  # Electron 主进程
│   ├── main.ts               # Electron 入口
│   ├── preload.ts            # 预加载脚本
│   ├── pet-preload.ts        # Pet 窗口预加载
│   └── preview-preload.ts    # 预览窗口预加载
├── src/                      # React 前端源码
│   ├── components/           # UI 组件
│   │   ├── layout/           # 布局组件
│   │   │   ├── AppShell.tsx    # 主布局
│   │   │   ├── Sidebar.tsx      # 侧边栏
│   │   │   ├── TabBar.tsx       # 标签栏
│   │   │   ├── ContentRouter.tsx # 内容路由
│   │   │   ├── StartupErrorView.tsx # 启动错误
│   │   │   └── H5ConnectionView.tsx # H5 连接视图
│   │   ├── chat/             # 聊天组件
│   │   │   ├── ChatSession.tsx   # 聊天会话
│   │   │   ├── MessageList.tsx   # 消息列表
│   │   │   ├── MessageItem.tsx   # 消息项
│   │   │   ├── MessageComposer.tsx # 消息输入框
│   │   │   ├── PermissionPanel.tsx # 权限面板
│   │   │   ├── ToolUsePanel.tsx   # 工具使用面板
│   │   │   ├── ThinkingIndicator.tsx # 思考指示器
│   │   │   └── ComputerUsePanel.tsx # Computer Use 面板
│   │   ├── shared/           # 共享组件
│   │   │   ├── Toast.tsx        # 提示组件
│   │   │   ├── UpdateChecker.tsx # 更新检查
│   │   │   ├── Spinner.tsx      # 加载动画
│   │   │   └── Dialog.tsx       # 对话框
│   │   ├── settings/         # 设置组件
│   │   ├── workspace/        # 工作区组件
│   │   ├── teams/            # 团队组件
│   │   └── tasks/            # 任务组件
│   ├── pages/                # 页面组件
│   │   ├── ChatPage.tsx       # 聊天页面
│   │   ├── SettingsPage.tsx   # 设置页面
│   │   ├── TeamPage.tsx      # 团队页面
│   │   ├── TaskPage.tsx      # 任务页面
│   │   ├── MarketPage.tsx    # 技能市场页面
│   │   ├── TraceList.tsx     # 追踪列表
│   │   └── TraceSession.tsx  # 追踪会话
│   ├── stores/               # Zustand 状态管理
│   │   ├── chatStore.ts      # 聊天状态
│   │   ├── sessionStore.ts   # 会话状态
│   │   ├── uiStore.ts        # UI 状态
│   │   ├── settingsStore.ts  # 设置状态
│   │   ├── tabStore.ts       # 标签状态
│   │   ├── teamStore.ts      # 团队状态
│   │   ├── cliTaskStore.ts   # CLI 任务状态
│   │   ├── sessionRuntimeStore.ts # 会话运行时状态
│   │   └── fileSystemStore.ts # 文件系统状态
│   ├── api/                  # API 接口
│   │   ├── client.ts         # HTTP 客户端
│   │   ├── websocket.ts      # WebSocket 管理器
│   │   ├── sessions.ts       # 会话 API
│   │   ├── settings.ts       # 设置 API
│   │   ├── providers.ts      # 提供商 API
│   │   ├── skills.ts         # 技能 API
│   │   ├── teams.ts          # 团队 API
│   │   ├── tasks.ts          # 任务 API
│   │   ├── mcp.ts            # MCP API
│   │   ├── search.ts         # 搜索 API
│   │   ├── memory.ts         # 记忆 API
│   │   ├── traces.ts         # 追踪 API
│   │   ├── agents.ts         # 代理 API
│   │   ├── market.ts         # 市场 API
│   │   ├── doctor.ts         # 诊断 API
│   │   └── desktopUiPreferences.ts # 桌面 UI 偏好设置
│   ├── hooks/                # React Hooks
│   │   ├── useKeyboardShortcuts.ts # 键盘快捷键
│   │   ├── useElectronWindowDragRegions.ts # 窗口拖拽
│   │   ├── useScheduledTaskDesktopNotifications.ts # 定时任务通知
│   │   ├── useMobileViewport.ts # 移动端视口
│   │   ├── useSettings.ts    # 设置 Hook
│   │   └── useTasksV2.ts     # 任务 Hook
│   ├── lib/                  # 工具函数
│   │   ├── desktopRuntime.ts # 桌面运行时检测
│   │   ├── desktopHost.ts    # 桌面主机 API
│   │   ├── desktopNotifications.ts # 桌面通知
│   │   ├── desktopNotificationNavigation.ts # 通知导航
│   │   ├── appZoom.ts        # 应用缩放
│   │   ├── touchH5.ts        # 触屏 H5 支持
│   │   ├── persistenceMigrations.ts # 持久化迁移
│   │   ├── diagnosticsCapture.ts # 诊断捕获
│   │   ├── sessionTitle.ts   # 会话标题处理
│   │   ├── composerAttachments.ts # 输入框附件
│   │   ├── backgroundTasks.ts # 后台任务
│   │   └── traceLaunch.ts    # 追踪启动
│   ├── types/                # TypeScript 类型定义
│   │   ├── chat.ts           # 聊天类型
│   │   ├── session.ts        # 会话类型
│   │   ├── settings.ts       # 设置类型
│   │   ├── team.ts           # 团队类型
│   │   ├── task.ts           # 任务类型
│   │   ├── skill.ts          # 技能类型
│   │   ├── mcp.ts            # MCP 类型
│   │   ├── runtime.ts        # 运行时类型
│   │   └── trace.ts          # 追踪类型
│   ├── config/               # 配置文件
│   │   └── spinnerVerbs.ts   # 加载提示语
│   ├── i18n/                 # 国际化
│   │   └── index.ts          # 翻译管理
│   ├── theme/                # 主题
│   │   └── globals.css       # 全局样式
│   ├── App.tsx               # 应用根组件
│   ├── main.tsx              # React 入口
│   └── vite-env.d.ts         # Vite 类型定义
├── src-tauri/                # Tauri 资源
│   ├── icons/                # 应用图标
│   ├── binaries/             # 二进制文件
│   └── resources/            # 资源文件
├── index.html                # HTML 模板
├── vite.config.ts            # Vite 配置
├── vitest.config.ts          # Vitest 配置
├── tsconfig.json             # TypeScript 配置
└── package.json              # 依赖配置
```

## 核心组件详解

### 1. 应用入口 (`desktop/src/main.tsx`)

**功能**: React 应用启动入口，初始化主题、诊断捕获和应用组件。

**启动流程**:
```
加载 Bootstrap 模块 → 初始化主题 → 安装诊断捕获 → 创建 React 根节点 → 渲染 App 组件
```

**关键代码**:
```typescript
export async function bootstrapDesktopApp(root) {
  const [{ App }, { ErrorBoundary }, { installClientDiagnosticsCapture }, { initializeTheme }] = 
    await loadDesktopBootstrapModules()
  
  initializeTheme()
  installClientDiagnosticsCapture()
  
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
}
```

### 2. 应用根组件 (`desktop/src/App.tsx`)

**功能**: 应用根组件，初始化通知钩子和导航。

**主要职责**:
- 安装定时任务桌面通知
- 安装桌面通知导航处理器
- 渲染 AppShell 布局

### 3. 主布局组件 (`desktop/src/components/layout/AppShell.tsx`)

**功能**: 主布局容器，包含侧边栏、标签栏和内容区域。

**布局结构**:
```
┌─────────────┬──────────────────────────────────────┐
│             │                                      │
│   Sidebar   │         Content Area                  │
│   (240px)   │  ┌──────────────────────────────┐   │
│             │  │         TabBar               │   │
│             │  └──────────────────────────────┘   │
│             │                                      │
│             │  ┌──────────────────────────────┐   │
│             │  │      ContentRouter           │   │
│             │  │      (聊天/设置/团队/任务)    │   │
│             │  └──────────────────────────────┘   │
│             │                                      │
└─────────────┴──────────────────────────────────────┘
```

**核心逻辑**:
- 响应式布局（桌面端/移动端）
- 侧边栏折叠/展开
- 标签页管理
- 会话激活同步
- 启动引导流程

### 4. 聊天状态管理 (`desktop/src/stores/chatStore.ts`)

**功能**: 管理所有聊天会话的状态，包括消息、连接状态、权限请求等。

**状态结构**:
```typescript
type PerSessionState = {
  messages: UIMessage[]                    // 消息列表
  chatState: ChatState                     // 聊天状态 (idle/thinking/tool_executing/permission_pending)
  connectionState: ConnectionState         // 连接状态 (disconnected/connecting/connected/reconnecting)
  streamingText: string                    // 流式文本缓冲区
  pendingPermissions: PendingPermissions   // 待处理权限请求
  pendingComputerUsePermissions: PendingComputerUsePermissions // Computer Use 权限请求
  tokenUsage: TokenUsage                   // Token 使用量
  elapsedSeconds: number                   // 经过秒数
  slashCommands: SlashCommand[]            // 斜杠命令列表
  backgroundAgentTasks: BackgroundAgentTask[] // 后台任务
  // ... 其他状态
}
```

**核心方法**:
- `connectToSession(sessionId)` - 连接到会话
- `disconnectSession(sessionId)` - 断开会话
- `sendMessage(sessionId, content)` - 发送消息
- `respondToPermission(sessionId, requestId, allowed)` - 响应权限请求
- `stopGeneration(sessionId)` - 停止生成
- `loadHistory(sessionId)` - 加载历史消息
- `handleServerMessage(sessionId, msg)` - 处理服务器消息

### 5. 会话状态管理 (`desktop/src/stores/sessionStore.ts`)

**功能**: 管理会话列表和元数据。

**核心方法**:
- `fetchSessions()` - 获取会话列表
- `createSession()` - 创建新会话
- `deleteSession(sessionId)` - 删除会话
- `setActiveSession(sessionId)` - 设置活动会话
- `updateSessionTitle(sessionId, title)` - 更新会话标题

### 6. UI 状态管理 (`desktop/src/stores/uiStore.ts`)

**功能**: 管理全局 UI 状态。

**状态项**:
- `sidebarOpen` - 侧边栏展开状态
- `pendingSettingsTab` - 待打开的设置标签
- `theme` - 当前主题

### 7. 标签状态管理 (`desktop/src/stores/tabStore.ts`)

**功能**: 管理标签页状态。

**核心方法**:
- `openTab(sessionId, title, type)` - 打开标签
- `closeTab(sessionId)` - 关闭标签
- `setActiveTab(sessionId)` - 设置活动标签
- `restoreTabs()` - 恢复标签（从本地存储）
- `updateTabStatus(sessionId, status)` - 更新标签状态

### 8. WebSocket 管理器 (`desktop/src/api/websocket.ts`)

**功能**: 管理 WebSocket 连接和消息收发。

**核心特性**:
- 自动重连机制
- 消息队列管理
- 连接状态追踪
- 消息类型分发

**连接流程**:
```
connect(sessionId) → 创建 WebSocket → 注册消息处理器 → 发送初始化消息
    ↓
消息到达 → onMessage 回调 → chatStore.handleServerMessage → 更新 UI
```

### 9. HTTP 客户端 (`desktop/src/api/client.ts`)

**功能**: 封装 HTTP 请求，处理认证和错误。

**核心方法**:
- `api.get<T>(path)` - GET 请求
- `api.post<T>(path, body)` - POST 请求
- `api.put<T>(path, body)` - PUT 请求
- `api.delete<T>(path)` - DELETE 请求

**特性**:
- 自动添加认证头
- 请求超时处理
- 错误诊断记录
- 支持 AbortSignal

## 数据流

### 聊天消息流程

```
用户输入消息 → MessageComposer → chatStore.sendMessage()
    ↓
WebSocket 发送 user_message → 后端 ws/handler.ts
    ↓
CLI 子进程处理 → 返回 assistant_text → WebSocket
    ↓
chatStore.handleServerMessage() → 更新 messages → MessageList 渲染
```

### 权限请求流程

```
后端发送 permission_request → WebSocket → chatStore.handleServerMessage()
    ↓
更新 pendingPermissions → PermissionPanel 渲染
    ↓
用户点击允许/拒绝 → chatStore.respondToPermission()
    ↓
WebSocket 发送 permission_response → 后端 → CLI 执行工具
```

### 会话加载流程

```
打开会话 → tabStore.openTab() → chatStore.connectToSession()
    ↓
WebSocket 连接 → chatStore.loadHistory()
    ↓
API 请求 /api/sessions/{id}/messages → 返回消息列表
    ↓
更新 messages 状态 → MessageList 渲染历史消息
```

## UI 组件架构

### 聊天会话组件 (`ChatSession.tsx`)

**功能**: 聊天会话主组件，整合消息列表、输入框和权限面板。

**子组件**:
- `MessageList` - 消息列表
- `MessageComposer` - 消息输入框
- `PermissionPanel` - 权限审批面板
- `ComputerUsePanel` - Computer Use 面板
- `ThinkingIndicator` - 思考指示器

### 消息列表组件 (`MessageList.tsx`)

**功能**: 渲染消息列表，支持多种消息类型。

**消息类型**:
- `user_text` - 用户文本
- `assistant_text` - 助手文本
- `tool_use` - 工具调用
- `tool_result` - 工具结果
- `thinking` - 思考内容
- `background_task` - 后台任务
- `task_summary` - 任务摘要
- `compact_summary` - 上下文压缩摘要
- `error` - 错误消息
- `system_notification` - 系统通知

### 消息输入框组件 (`MessageComposer.tsx`)

**功能**: 用户输入消息的主要界面。

**特性**:
- 文本输入
- 附件上传（文件、图片）
- 代码块支持
- 斜杠命令自动补全
- 引用插入
- 草稿保存

### 权限审批面板 (`PermissionPanel.tsx`)

**功能**: 显示待处理的权限请求，允许用户批准或拒绝。

**支持的权限类型**:
- Bash 命令执行
- 文件读取
- 文件写入
- 网络请求
- Computer Use

### 设置页面 (`SettingsPage.tsx`)

**功能**: 应用设置页面。

**设置分类**:
- 模型设置（提供商、API Key、默认模型）
- 权限设置（默认权限模式）
- 外观设置（主题、字体大小）
- 网络设置（代理配置）
- H5 访问设置（远程访问）
- 关于页面

## 主题系统

### 主题变量

使用 CSS 自定义属性定义主题：

```css
:root {
  --color-surface: #1e1e2e;
  --color-surface-hover: #2a2a3e;
  --color-border: #3a3a4e;
  --color-text-primary: #cdd6f4;
  --color-text-secondary: #a6adc8;
  --color-text-tertiary: #6c7086;
  --color-success: #a6e3a1;
  --color-error: #f38ba8;
  --color-warning: #f9e2af;
  --color-info: #89b4fa;
}
```

### 主题切换

通过 `uiStore` 管理主题状态，支持亮/暗色模式。

## 国际化

### 翻译管理 (`desktop/src/i18n/index.ts`)

**功能**: 管理应用翻译。

**支持的语言**:
- 中文（默认）
- 英文

**使用方式**:
```typescript
import { useTranslation } from '../../i18n'

const t = useTranslation()
console.log(t('session.untitled')) // 无标题
```

## Electron 集成

### 主进程 (`desktop/electron/main.ts`)

**功能**: Electron 主进程，管理窗口和系统资源。

**主要职责**:
- 创建主窗口
- 管理应用生命周期
- 处理 IPC 通信
- 管理系统菜单
- 处理自动更新
- 管理 Pet 窗口

### 预加载脚本 (`desktop/electron/preload.ts`)

**功能**: 在渲染进程中注入全局变量和 API。

**注入的全局变量**:
- `MACRO.VERSION` - 应用版本
- `MACRO.PACKAGE_URL` - 包 URL
- `window.__CC_HAHA_BOOTSTRAPPED__` - 启动标志

### 桌面主机 API (`desktop/src/lib/desktopHost.ts`)

**功能**: 封装 Electron API，提供统一的桌面功能接口。

**API 方法**:
- `window.onNativeMenuNavigate` - 原生菜单导航
- `pets.show()` - 显示 Pet 窗口
- `pets.onNavigateSession` - Pet 窗口会话导航
- `isDesktop` - 是否为桌面端

## 性能优化

### 虚拟滚动

消息列表使用虚拟滚动优化大量消息的渲染性能。

### WebSocket 消息节流

通过 `pendingDeltaBySession` 缓冲高频消息，减少 UI 更新次数。

### 状态分片

使用 Zustand 的 `getSession` 方法按需获取会话状态，避免不必要的重渲染。

### 延迟加载

组件按需加载，减少初始包体积。

## 测试策略

### 单元测试

使用 Vitest 进行单元测试：

```bash
cd desktop && bun run test
```

### 组件测试

使用 `@testing-library/react` 进行组件测试：

```bash
cd desktop && bun run test -- --run
```

### 构建检查

```bash
cd desktop && bun run check:desktop
```

## 开发模式

### 启动开发服务器

```bash
cd desktop && bun run dev
```

### 启动 Electron

```bash
cd desktop && bun run electron:dev
```

### 构建生产版本

```bash
cd desktop && bun run electron:package
```

## 部署平台

### macOS
- DMG 安装包
- 签名和公证

### Windows
- NSIS 安装程序
- 支持自定义安装目录

### Linux
- AppImage
- DEB 包

## 安全考虑

### 内容安全策略
- 限制外部资源加载
- 防止 XSS 攻击

### 权限管理
- 危险操作需要用户确认
- 权限模式可配置

### 数据保护
- 本地数据加密存储
- OAuth 令牌安全管理

### 网络安全
- 本地访问默认允许
- 远程访问需要认证令牌
- HTTPS 通信支持
