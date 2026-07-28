# 后端架构文档

## 概述

Claude Code Haha 后端是一个基于 Bun 的 HTTP + WebSocket 服务器，为桌面端 UI 提供 REST API 和实时通信能力。后端与 CLI 共享相同的文件系统，确保 CLI 和 UI 数据互通。

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 运行时 | Bun | 高性能 JavaScript 运行时 |
| HTTP 服务器 | Bun.serve | Bun 内置 HTTP/WebSocket 服务器 |
| API 客户端 | undici | 高性能 HTTP 客户端 |
| 数据库 | 文件系统 | 会话和设置存储在文件系统中 |
| 进程管理 | execa / Bun.spawn | CLI 子进程管理 |
| WebSocket | ws | WebSocket 通信 |

## 核心架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        客户端层                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Electron │  │  H5 Web   │  │   IM     │  │  CLI     │          │
│  │  Desktop │  │  Browser  │  │ Adapter  │  │ Terminal │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
└───────┼─────────────┼─────────────┼─────────────┼─────────────────┘
        │             │             │             │
        │  HTTP/WS    │  HTTP/WS    │  HTTP/WS    │  CLI Args
        ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        服务器层                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Bun.serve (HTTP + WebSocket)              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │
│  │  │  Router  │  │ WS       │  │  Auth    │  │  CORS    │  │   │
│  │  │  API路由 │  │ Handler  │  │ Middleware│ │ Middleware│  │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │   │
│  └───────┼─────────────┼─────────────┼─────────────┼─────────┘   │
└──────────┼─────────────┼─────────────┼─────────────┼─────────────┘
           │             │             │             │
           ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        服务层                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐       │
│  │Conversation    │  │  Session       │  │  Provider      │       │
│  │  Service       │  │  Service       │  │  Service       │       │
│  │ (CLI进程管理)   │  │ (会话存储)      │  │ (模型提供商)    │       │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘       │
│           │                   │                   │               │
│  ┌────────┴───────┐  ┌────────┴───────┐  ┌────────┴───────┐       │
│  │ ComputerUse    │  │  Title         │  │  H5Access      │       │
│  │  Approval      │  │  Service       │  │  Service       │       │
│  │  Service       │  │ (自动标题)      │  │ (远程访问)     │       │
│  └────────────────┘  └────────────────┘  └────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CLI 子进程层                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │            Bun.spawn (Claude CLI 子进程)                    │   │
│  │  - 每个会话一个 CLI 进程                                   │   │
│  │  - 通过 WebSocket (/sdk/) 与服务器通信                    │   │
│  │  - 使用 stream-json 格式传输消息                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
src/
├── server/                    # HTTP + WebSocket 服务器
│   ├── index.ts               # 服务器入口
│   ├── router.ts              # API 路由分发
│   ├── server.ts              # 服务器配置
│   ├── serverLog.ts           # 日志记录
│   ├── lockfile.ts            # 锁文件管理
│   ├── staticH5.ts            # H5 静态资源服务
│   ├── types.ts               # 服务器类型定义
│   ├── api/                   # REST API 接口
│   │   ├── sessions.ts        # 会话管理 API
│   │   ├── settings.ts        # 设置 API
│   │   ├── models.ts          # 模型 API
│   │   ├── conversations.ts   # 对话 API
│   │   ├── teams.ts           # 团队 API
│   │   ├── providers.ts       # 提供商 API
│   │   ├── skills.ts          # 技能 API
│   │   ├── market.ts          # 技能市场 API
│   │   ├── mcp.ts             # MCP 协议 API
│   │   ├── search.ts          # 搜索 API
│   │   ├── agents.ts          # 代理 API
│   │   ├── scheduled-tasks.ts # 定时任务 API
│   │   ├── computer-use.ts    # Computer Use API
│   │   ├── diagnostics.ts     # 诊断 API
│   │   ├── h5-access.ts       # H5 访问控制 API
│   │   ├── memory.ts          # 记忆系统 API
│   │   ├── traces.ts          # 追踪 API
│   │   └── ...                # 其他 API
│   ├── ws/                    # WebSocket 处理
│   │   ├── handler.ts         # WebSocket 消息处理
│   │   └── events.ts          # 消息类型定义
│   ├── services/              # 核心服务
│   │   ├── conversationService.ts   # CLI 进程管理
│   │   ├── sessionService.ts        # 会话存储
│   │   ├── providerService.ts       # 模型提供商
│   │   ├── titleService.ts          # 自动标题生成
│   │   ├── teamWatcher.ts           # 团队文件监听
│   │   ├── cronScheduler.ts         # 定时任务调度
│   │   ├── h5AccessService.ts       # H5 访问控制
│   │   ├── computerUseApprovalService.ts # Computer Use 审批
│   │   ├── localIndex/              # 本地索引服务
│   │   └── ...                      # 其他服务
│   ├── proxy/                 # OpenAI 兼容代理
│   └── middleware/            # 中间件
│       ├── auth.ts            # 认证中间件
│       └── cors.ts            # CORS 中间件
├── services/                  # 核心服务层
│   ├── api/                   # API 客户端服务
│   │   ├── claude.ts          # Claude API 客户端
│   │   ├── client.ts          # 通用 API 客户端
│   │   ├── errors.ts          # API 错误处理
│   │   ├── grove.ts           # Grove API 客户端
│   │   └── usage.ts           # 使用量统计
│   ├── mcp/                   # MCP 协议服务
│   │   ├── client.ts          # MCP 客户端
│   │   ├── config.ts          # MCP 配置
│   │   ├── auth.ts            # MCP 认证
│   │   └── types.ts           # MCP 类型定义
│   ├── lsp/                   # LSP 协议服务
│   ├── tips/                  # 提示服务
│   ├── notifier.ts            # 通知服务
│   ├── vcr.ts                 # VCR 录制服务
│   └── voice.ts               # 语音服务
├── commands/                  # CLI 命令系统
│   ├── btw/                   # 顺便命令
│   ├── copy/                  # 复制命令
│   ├── diff/                  # 差异命令
│   ├── exit/                  # 退出命令
│   ├── fast/                  # 快速命令
│   ├── fork/                  # 分叉命令
│   ├── goal/                  # 目标命令
│   ├── help/                  # 帮助命令
│   ├── ide/                   # IDE 命令
│   ├── mcp/                   # MCP 命令
│   ├── plan/                  # 计划命令
│   ├── tag/                   # 标签命令
│   ├── vim/                   # Vim 命令
│   ├── agent.ts               # 代理命令
│   ├── commit.ts              # 提交命令
│   ├── brief.ts               # 摘要命令
│   ├── review.ts              # 评审命令
│   └── ...                    # 其他命令
├── tools/                     # 工具系统
│   ├── BashTool/              # Bash 工具
│   ├── GlobTool/              # 文件查找工具
│   ├── GrepTool/              # 文本搜索工具
│   ├── LSPTool/               # LSP 工具
│   ├── MCPTool/               # MCP 工具
│   ├── SkillTool/             # 技能工具
│   ├── AgentTool/             # 代理工具
│   ├── BriefTool/             # 摘要工具
│   └── utils.ts               # 工具工具函数
├── ink/                       # Ink 终端渲染引擎
│   ├── components/            # Ink 组件
│   ├── events/                # Ink 事件系统
│   ├── hooks/                 # Ink Hooks
│   ├── layout/                # Ink 布局引擎
│   ├── termio/                # 终端 IO 处理
│   ├── renderer.ts            # 渲染器
│   ├── reconciler.ts          # 协调器
│   └── ...                    # Ink 核心模块
├── skills/                    # 技能系统
│   ├── bundled/               # 内置技能
│   └── mcpSkills.ts           # MCP 技能
├── cli/                       # CLI 处理
│   ├── handlers/              # CLI 命令处理器
│   ├── bg.ts                  # 后台模式
│   ├── exit.ts                # 退出处理
│   └── ...                    # CLI 工具
├── entrypoints/               # 入口点
│   ├── cli.tsx                # CLI 入口
│   ├── init.ts                # 初始化入口
│   └── mcp.ts                 # MCP 入口
├── constants/                 # 常量定义
├── context/                   # 上下文管理
├── hooks/                     # React Hooks
├── memdir/                    # 记忆目录管理
├── proactive/                 # 主动建议系统
├── query/                     # 查询引擎
├── schemas/                   # JSON Schema
├── screens/                   # 终端屏幕
├── state/                     # 状态管理
├── tasks/                     # 任务系统
├── types/                     # 类型定义
├── assistant/                 # 助手核心
├── buddy/                     # 伙伴系统
├── bridge/                    # 桥接层
├── bootstrap/                 # 启动引导
├── jobs/                      # 后台作业
├── keybindings/               # 键盘绑定
├── main.tsx                   # TUI 主入口
├── QueryEngine.ts             # 查询引擎
├── Task.ts                    # 任务类型
├── Tool.ts                    # 工具类型
├── commands.ts                # 命令注册
├── context.ts                 # 上下文类型
├── cost-tracker.ts            # 成本追踪
├── history.ts                 # 历史记录
├── localRecoveryCli.ts        # 降级 Recovery CLI
├── replLauncher.tsx           # REPL 启动器
└── setup.ts                   # 启动初始化
```

## 核心组件详解

### 1. 服务器入口 (`src/server/index.ts`)

**功能**: 启动 HTTP + WebSocket 服务器，处理所有客户端请求。

**主要职责**:
- 解析命令行参数和环境变量
- 配置服务器端口和主机
- 初始化后台索引服务
- 注册 WebSocket 处理程序
- 处理 HTTP 请求路由
- 管理 CORS 和认证中间件
- 处理 H5 远程访问策略
- 启动团队文件监听器和定时任务调度器

**关键代码**:
```typescript
export function startServer(port = PORT, host = HOST) {
  enableConfigs()
  void refreshDisconnectGraceMs()
  
  const server = Bun.serve<WebSocketData>({
    port,
    hostname: host,
    async fetch(req, server) {
      // HTTP 请求处理（路由、认证、CORS）
    },
    websocket: handleWebSocket,
  })
  
  beginBackgroundIndexStartup()
  teamWatcher.start()
  cronScheduler.start()
  
  return server
}
```

### 2. API 路由 (`src/server/router.ts`)

**功能**: 将 REST API 请求路由到对应的处理程序。

**路由映射**:

| API 路径 | 处理程序 | 功能 |
|----------|----------|------|
| `/api/sessions` | handleSessionsApi | 会话管理 |
| `/api/conversations` | handleConversationsApi | 对话管理 |
| `/api/settings` | handleSettingsApi | 设置管理 |
| `/api/models` | handleModelsApi | 模型管理 |
| `/api/providers` | handleProvidersApi | 提供商管理 |
| `/api/teams` | handleTeamsApi | 团队管理 |
| `/api/skills` | handleSkillsApi | 技能管理 |
| `/api/mcp` | handleMcpApi | MCP 协议 |
| `/api/search` | handleSearchApi | 搜索功能 |
| `/api/computer-use` | handleComputerUseApi | Computer Use |
| `/api/h5-access` | handleH5AccessApi | H5 访问控制 |
| `/api/memory` | handleMemoryApi | 记忆系统 |

### 3. WebSocket 处理器 (`src/server/ws/handler.ts`)

**功能**: 管理 WebSocket 连接生命周期，处理实时消息路由。

**消息类型**:

| 客户端消息 | 服务端消息 | 说明 |
|------------|------------|------|
| `user_message` | `assistant_text` | 用户消息 |
| `permission_response` | `permission_resolved` | 权限响应 |
| `computer_use_permission_response` | `permission_resolved` | Computer Use 权限响应 |
| `set_permission_mode` | `permission_mode_changed` | 设置权限模式 |
| `set_runtime_config` | `status` | 设置运行时配置 |
| `stop_generation` | `status` | 停止生成 |
| `ping` | `pong` | 心跳检测 |

**连接通道**:
- `/ws/{sessionId}` - 客户端通道（桌面端、H5、IM）
- `/sdk/{sessionId}` - SDK 通道（CLI 子进程）

### 4. 会话服务 (`src/server/services/conversationService.ts`)

**功能**: 管理 CLI 子进程生命周期。

**核心特性**:
- 每个会话拥有独立的 CLI 子进程
- CLI 子进程通过 WebSocket 与服务器通信
- 处理用户消息、权限请求、控制命令
- 管理会话启动、停止、重启
- 处理网络环境动态更新
- 管理 OAuth 认证令牌

**会话生命周期**:
```
创建会话 → 启动 CLI 子进程 → 建立 SDK WebSocket → 处理消息 → 停止 CLI 子进程 → 清理会话
```

### 5. 会话存储服务 (`src/server/services/sessionService.ts`)

**功能**: 管理会话持久化存储。

**存储位置**: `~/.claude/cc-haha/sessions/`

**存储格式**: JSONL（每行一条消息）

**主要方法**:
- `listSessions()` - 获取会话列表
- `getSessionWorkDir()` - 获取会话工作目录
- `getSessionLaunchInfo()` - 获取会话启动信息
- `appendSessionMetadata()` - 更新会话元数据
- `clearSessionTranscript()` - 清空会话记录

### 6. 提供商服务 (`src/server/services/providerService.ts`)

**功能**: 管理模型提供商配置。

**支持的提供商**:
- Anthropic 官方 API
- OpenAI 兼容 API（DeepSeek、Ollama 等）
- Grok 官方 API
- 第三方自定义提供商

**核心功能**:
- 提供商配置管理
- API Key 管理
- 运行时环境变量构建
- OAuth 认证管理

### 7. 本地索引服务 (`src/server/services/localIndex/`)

**功能**: 为会话提供全文搜索能力。

**组件**:
- `coordinator.ts` - 索引协调器
- `searchContentCoordinator.ts` - 搜索内容协调器
- 支持增量索引和冷启动优化

## API 接口分类

### 会话管理
- `GET /api/sessions` - 获取会话列表
- `POST /api/sessions` - 创建新会话
- `GET /api/sessions/{id}` - 获取会话详情
- `DELETE /api/sessions/{id}` - 删除会话
- `GET /api/sessions/{id}/messages` - 获取消息历史

### 对话控制
- `POST /api/sessions/{id}/chat/message` - 发送消息（REST 方式）
- `GET /api/sessions/{id}/chat/status` - 获取对话状态

### 设置管理
- `GET /api/settings` - 获取设置
- `PUT /api/settings` - 更新设置
- `GET /api/settings/permissions` - 获取权限设置

### 模型管理
- `GET /api/models` - 获取模型列表
- `GET /api/models/{id}` - 获取模型详情

### 团队管理
- `GET /api/teams` - 获取团队列表
- `POST /api/teams` - 创建团队
- `GET /api/teams/{id}/members` - 获取团队成员

### 技能管理
- `GET /api/skills` - 获取技能列表
- `POST /api/skills` - 安装技能
- `DELETE /api/skills/{id}` - 卸载技能

### 搜索功能
- `GET /api/search` - 搜索会话内容

### Computer Use
- `POST /api/computer-use/approve` - 批准 Computer Use 请求

### H5 访问
- `GET /api/h5-access/settings` - 获取 H5 访问设置
- `PUT /api/h5-access/settings` - 更新 H5 访问设置
- `POST /api/h5-access/token` - 生成 H5 访问令牌

## 数据流

### 消息处理流程

```
用户发送消息 → WebSocket 客户端消息 → ws/handler.ts → conversationService → CLI 子进程
                                                                 ↓
CLI 子进程输出 → conversationService → ws/handler.ts → WebSocket 服务器消息 → 客户端
```

### 权限处理流程

```
CLI 请求工具使用 → permission_request → WebSocket → 前端显示权限请求 → 用户响应 → permission_response → WebSocket → CLI 执行工具
```

### 会话启动流程

```
前端请求创建会话 → POST /api/sessions → 创建会话目录 → 返回 sessionId
    ↓
前端连接 WebSocket → /ws/{sessionId} → 发送 prewarm_session → conversationService.startSession()
    ↓
Bun.spawn 启动 CLI 子进程 → CLI 连接 /sdk/{sessionId} → SDK WebSocket 建立 → 会话就绪
```

## 认证机制

### 本地访问
- 默认允许本地访问（127.0.0.1）
- 通过 `localToken` 查询参数进行简单认证

### H5 远程访问
- 需要配置 H5 访问令牌
- 支持一次性令牌和持久令牌
- 通过 H5AccessService 管理访问策略

### Pet 窗口访问
- 专用的受限访问模式
- 只允许特定消息类型
- 通过 `clientKind: 'pet'` 标识

### OAuth 认证
- 支持 Anthropic、OpenAI、Grok 官方 OAuth
- 通过回调端点处理授权流程
- 令牌存储在本地配置文件中

## 性能优化

### 索引冷启动优化
- 会话列表索引优先加载
- 全文索引后台异步构建
- 最多等待 30 秒索引就绪

### 会话断开优雅处理
- 客户端断开后保留 CLI 进程一段时间
- 如果正在执行任务，等待任务完成后再清理
- 超时后自动清理空闲会话

### 流式消息节流
- 客户端缓冲区合并高频消息
- 避免过多的 UI 更新

## 容错机制

### CLI 进程崩溃恢复
- 检测 CLI 退出状态
- 自动重试启动（最多一次）
- 记录诊断信息

### 网络环境动态更新
- 检测网络配置变化
- 通过 SDK 消息实时更新子进程环境变量

### 权限请求超时处理
- 权限请求最长保留 30 分钟
- 超时后自动清理

### 会话锁文件管理
- 使用锁文件防止重复启动
- 检测并清理过期锁文件

## 扩展能力

### IM 适配器 (`adapters/`)
- 支持 Telegram、飞书、微信、钉钉、WhatsApp
- 提供统一的消息收发接口
- 通过 WebSocket 与服务器通信

### MCP 协议支持
- 完整的 MCP 协议实现
- 支持工具调用和权限管理
- 支持 MCP 服务器发现和连接

### LSP 协议支持
- 语言服务器协议支持
- 代码补全和诊断功能
- 与 CLI 工具集成

### 定时任务 (`cronScheduler`)
- 支持基于时间的任务调度
- 与会话系统集成
- 支持任务状态跟踪

## 部署模式

### 开发模式
```bash
bun install
cp .env.example .env
./bin/claude-haha
```

### 桌面端模式
- Electron 启动时自动启动服务器
- 通过 `preload.ts` 注入全局变量
- 服务器作为 sidecar 进程运行

### H5 远程模式
- 配置公开访问地址
- 生成访问令牌
- 通过浏览器访问
