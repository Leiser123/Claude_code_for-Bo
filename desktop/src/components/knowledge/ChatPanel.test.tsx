import { StrictMode } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  wsConnect: vi.fn(),
  wsDisconnect: vi.fn(),
  wsOnMessage: vi.fn(() => () => {}),
  wsClearHandlers: vi.fn(),
  wsOnConnectionState: vi.fn((_sessionId: string, handler: (state: string) => void) => {
    handler('connected')
    return () => {}
  }),
  wsSend: vi.fn(),
  getMessages: vi.fn(async () => ({ messages: [] })),
  getSlashCommands: vi.fn(async () => ({ commands: [] })),
  createSession: vi.fn(async () => ({ sessionId: 'new-knowledge-session' })),
  getTasksForSession: vi.fn(async () => ({ tasks: [] })),
  sendSubagentMessage: vi.fn(async () => ({ ok: true })),
  notifyDesktop: vi.fn(),
  getMemberBySessionId: vi.fn(() => null),
  loadFromClaude: vi.fn(async () => {}),
  loadFromServer: vi.fn(async () => {}),
  register: vi.fn(),
  retrieveKnowledgeContext: vi.fn(async () => ({ content: '', paths: [] })),
  buildChatMessage: vi.fn(() => 'message'),
  buildChatSystemPrompt: vi.fn(() => 'system prompt'),
  buildDisplayChatContent: vi.fn(() => 'question'),
  buildReferencesMarkdown: vi.fn(() => ''),
  buildReferencesMarkdownFromEntries: vi.fn(() => ''),
  parseReferencesSchema: vi.fn(() => ({ body: '', found: false, entries: [] })),
}))

vi.mock('../../api/websocket', () => ({
  wsManager: {
    connect: mocks.wsConnect,
    disconnect: mocks.wsDisconnect,
    onMessage: mocks.wsOnMessage,
    clearHandlers: mocks.wsClearHandlers,
    onConnectionState: mocks.wsOnConnectionState,
    send: mocks.wsSend,
  },
}))

vi.mock('../../api/sessions', () => ({
  sessionsApi: {
    getMessages: mocks.getMessages,
    getSlashCommands: mocks.getSlashCommands,
    create: mocks.createSession,
  },
}))

vi.mock('../../api/cliTasks', () => ({
  cliTasksApi: {
    getTasksForSession: mocks.getTasksForSession,
  },
}))

vi.mock('../../api/subagents', () => ({
  subagentsApi: {
    sendMessage: mocks.sendSubagentMessage,
  },
}))

vi.mock('../../lib/desktopNotifications', () => ({
  notifyDesktop: mocks.notifyDesktop,
}))

vi.mock('../teamStore', () => ({
  useTeamStore: {
    getState: () => ({
      getMemberBySessionId: mocks.getMemberBySessionId,
    }),
  },
}))

vi.mock('../../lib/wikiChatPrompt', () => ({
  retrieveKnowledgeContext: mocks.retrieveKnowledgeContext,
  buildChatMessage: mocks.buildChatMessage,
  buildReferencesMarkdown: mocks.buildReferencesMarkdown,
}))

vi.mock('../../stores/wikiChatStore', () => ({
  useWikiChatStore: {
    getState: () => ({
      loadFromClaude: mocks.loadFromClaude,
      useKnowledgeContext: false,
      systemPrompt: '',
      skillName: null,
    }),
  },
}))

vi.mock('../../stores/knowledgeSessionsStore', () => ({
  useKnowledgeSessionsStore: {
    getState: () => ({
      loadFromServer: mocks.loadFromServer,
      register: mocks.register,
    }),
  },
}))

vi.mock('../../stores/skillStore', () => ({
  useSkillStore: {
    getState: () => ({ skills: [] }),
  },
}))

vi.mock('../chat/MessageList', () => ({
  MessageList: () => <div data-testid="message-list" />,
}))

vi.mock('./SlidePanel', () => ({
  SlidePanel: ({ children }: { children: ReactNode }) => (
    <div data-testid="slide-panel">{children}</div>
  ),
}))

vi.mock('./ChatPanelSettings', () => ({
  ChatPanelSettings: () => null,
}))

vi.mock('./ChatPanelHistory', () => ({
  ChatPanelHistory: () => null,
}))

import { ChatPanel } from './ChatPanel'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useWikiStore } from '../../stores/wikiStore'

const EXISTING_SESSION_ID = 'knowledge-session-1'

describe('ChatPanel knowledge session lifecycle', () => {
  const initialChatState = useChatStore.getState()
  const initialSessionState = useSessionStore.getState()
  const initialWikiState = useWikiStore.getState()

  beforeEach(() => {
    vi.clearAllMocks()
    useChatStore.setState(initialChatState, true)
    useSessionStore.setState(initialSessionState, true)
    useWikiStore.setState(initialWikiState, true)
    // 固化一个最近的知识库会话：优先复用历史而不是新建
    useSessionStore.setState({
      sessions: [{
        id: EXISTING_SESSION_ID,
        title: '知识库对话',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        messageCount: 0,
        projectPath: '',
        workDir: null,
        workDirExists: true,
        permissionMode: 'default',
        mode: 'knowledge',
      }],
    })
  })

  afterEach(() => {
    cleanup()
    useChatStore.setState(initialChatState, true)
    useSessionStore.setState(initialSessionState, true)
    useWikiStore.setState(initialWikiState, true)
  })

  it('reconnects the existing session after StrictMode mount→cleanup→mount', async () => {
    render(
      <StrictMode>
        <ChatPanel isCollapsed={false} onToggle={() => {}} />
      </StrictMode>,
    )

    // StrictMode 下 effect 执行两遍：第一次 connect，cleanup 里 disconnect，
    // 第二次必须重新 connect，否则 WS 消息没有任何 handler 接收，
    // 会话会一直停在"处理中"。
    await waitFor(() => {
      expect(mocks.wsConnect).toHaveBeenCalledTimes(2)
    })
    expect(mocks.wsDisconnect).toHaveBeenCalledTimes(1)
    expect(mocks.wsOnMessage).toHaveBeenCalledTimes(2)
    expect(mocks.createSession).not.toHaveBeenCalled()

    // 断线后重连的是同一个历史会话，而不是新建
    expect(mocks.wsConnect).toHaveBeenCalledWith(EXISTING_SESSION_ID)
    expect(useChatStore.getState().sessions[EXISTING_SESSION_ID]).toBeDefined()
  })

  it('creates exactly one new session when no knowledge history exists', async () => {
    useSessionStore.setState({ sessions: [] })

    render(
      <StrictMode>
        <ChatPanel isCollapsed={false} onToggle={() => {}} />
      </StrictMode>,
    )

    // StrictMode 双调用不能创建两个会话；首次 createSession 完成后连接一次。
    await waitFor(() => {
      expect(mocks.createSession).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(mocks.wsConnect).toHaveBeenCalledTimes(1)
    })
    expect(mocks.wsConnect).toHaveBeenCalledWith('new-knowledge-session')
    expect(useChatStore.getState().sessions['new-knowledge-session']).toBeDefined()
  })
})
