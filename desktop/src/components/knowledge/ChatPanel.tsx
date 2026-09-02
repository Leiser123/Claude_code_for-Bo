import { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useWikiStore } from '../../stores/wikiStore'
import { useWikiChatStore } from '../../stores/wikiChatStore'
import { useKnowledgeSessionsStore } from '../../stores/knowledgeSessionsStore'
import { useKnowledgeTabStore } from '../../stores/knowledgeTabStore'
import type { UIMessage } from '../../types/chat'
import {
  retrieveKnowledgeContext,
  buildChatMessage,
  buildChatSystemPrompt,
  buildDisplayChatContent,
  buildReferencesMarkdown,
  buildReferencesMarkdownFromEntries,
  parseReferencesSchema,
} from '../../lib/wikiChatPrompt'
import { SlidePanel } from './SlidePanel'
import { ChatPanelSettings } from './ChatPanelSettings'
import { ChatPanelHistory } from './ChatPanelHistory'
import { MessageList } from '../chat/MessageList'

interface ChatPanelProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function ChatPanel({ isCollapsed, onToggle }: ChatPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyAnchorRect, setHistoryAnchorRect] = useState<{ top: number; left: number } | null>(null)
  const [sending, setSending] = useState(false)
  const [retrieving, setRetrieving] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // 只允许一个"新建会话"流程（StrictMode 双调用时防止创建两个会话）；
  // 已存在会话的重新连接不归它管，见下方 effect 里的 reconnect 判断。
  const initStartedRef = useRef(false)
  // 组件是否已卸载。StrictMode 的 mount→cleanup→mount 中，第二次挂载会重置
  // 该标记，因此异步 createSession 完成时仍能正常连接；真正卸载后则丢弃结果。
  const disposedRef = useRef(false)
  const historyButtonRef = useRef<HTMLButtonElement>(null)
  // 当前问题检索到的知识库页面，等待回答结束后追加为论文式"参考依据"
  const pendingRefsRef = useRef<{ paths: string[]; appended: boolean } | null>(null)

  const createSession = useSessionStore((s) => s.createSession)
  const deleteSession = useSessionStore((s) => s.deleteSession)
  const connectToSession = useChatStore((s) => s.connectToSession)
  const disconnectSession = useChatStore((s) => s.disconnectSession)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const appendAssistantText = useChatStore((s) => s.appendAssistantText)
  const replaceAssistantText = useChatStore((s) => s.replaceAssistantText)
  const stopGeneration = useChatStore((s) => s.stopGeneration)
  const loadPage = useWikiStore((s) => s.loadPage)
  const sessionState = useChatStore((s) => (sessionId ? s.sessions[sessionId] : undefined))
  const chatState = sessionState?.chatState ?? 'idle'
  const sessionIdRef = useRef<string | null>(null)

  // 初始化：优先复用最近的知识库会话（历史），否则新建并登记到本地注册表。
  // 知识库会话不再在卸载时删除，作为聊天历史保留，且与 chat 模式会话互相隔离。
  useEffect(() => {
    disposedRef.current = false

    const initSession = async () => {
      // 从 ~/.claude/settings.json 读取已固化的知识库聊天配置
      void useWikiChatStore.getState().loadFromClaude()
      // 从 ~/.claude/cc-haha/knowledge/.chat-history.json 恢复固化的会话历史
      void useKnowledgeSessionsStore.getState().loadFromServer()

      const existing = useSessionStore.getState().sessions
        .filter((s) => s.mode === 'knowledge')
        .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))[0]
      if (existing) {
        sessionIdRef.current = existing.id
        // StrictMode 下开发环境 effect 会跑两遍：mount→cleanup(disconnectSession)→
        // mount。若不重新连接，消息发出后响应的 WS 消息没有 handler 接收，
        // 会话会一直停在"处理中"。这里只在会话已被断开时补连，已连接则复用。
        const live = useChatStore.getState().sessions[existing.id]
        if (!live || live.connectionState === 'disconnected') {
          connectToSession(existing.id)
        }
        setSessionId(existing.id)
        setCreatingSession(false)
        return
      }

      // 新建流程只启动一次：StrictMode 的第二次 effect 直接跳过，
      // 首次 createSession 的异步结果在 disposedRef 重置后照常连接。
      if (initStartedRef.current) return
      initStartedRef.current = true
      try {
        const id = await createSession(undefined, {
          // 纯聊天模式：default 权限下写入类工具需要人工确认，配合系统提示词引导不调用工具
          permissionMode: 'default',
          mode: 'knowledge',
        })
        if (disposedRef.current) return
        useKnowledgeSessionsStore.getState().register(id, '知识库对话')
        sessionIdRef.current = id
        connectToSession(id)
        setSessionId(id)
        setCreatingSession(false)
      } catch (err) {
        if (!disposedRef.current) {
          console.error('Failed to create knowledge chat session:', err)
          setCreatingSession(false)
        }
      }
    }

    void initSession()

    return () => {
      disposedRef.current = true
      const currentId = sessionIdRef.current
      if (currentId) disconnectSession(currentId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSession, connectToSession, disconnectSession])

  // 自动调整 textarea 高度
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [inputValue])

  // 回答结束后处理"参考依据"：
  // 1) 模型按 schema 输出了参考文献 JSON 块 → 解析后渲染成可点击列表，并去掉原始 JSON；
  // 2) 模型没输出 schema → 退回用本次检索到的页面补一份列表（只补一次）。
  useEffect(() => {
    if (chatState !== 'idle' || !sessionId) return
    const session = useChatStore.getState().sessions[sessionId]
    const lastAssistant = session?.messages
      ? [...session.messages]
          .reverse()
          .find(
            (m): m is Extract<UIMessage, { type: 'assistant_text' }> =>
              m.type === 'assistant_text',
          )
      : undefined
    if (!lastAssistant) return

    const appendRetrievedFallback = () => {
      const pending = pendingRefsRef.current
      if (!pending || pending.appended || pending.paths.length === 0) return
      appendAssistantText(sessionId, buildReferencesMarkdown(pending.paths), lastAssistant.transcriptMessageId)
      pending.appended = true
    }

    if (lastAssistant.content.includes('"references"')) {
      const parsed = parseReferencesSchema(lastAssistant.content)
      if (parsed.found) {
        // 无论引用是否为空，schema 块都要从气泡里移除；空引用则不再附加列表
        const rendered = parsed.entries.length > 0
          ? buildReferencesMarkdownFromEntries(parsed.entries)
          : ''
        replaceAssistantText(sessionId, lastAssistant.transcriptMessageId, `${parsed.body}${rendered}`)
        if (pendingRefsRef.current) pendingRefsRef.current.appended = true
        return
      }
    }
    appendRetrievedFallback()
  }, [chatState, sessionId, appendAssistantText, replaceAssistantText])

  const handleSend = useCallback(async () => {
    if (!sessionId || !inputValue.trim() || chatState !== 'idle' || sending) return
    const question = inputValue.trim()
    setSending(true)
    setRetrieving(true)
    try {
      const settings = useWikiChatStore.getState()
      const wikiRootPath = useWikiStore.getState().wikiRootPath
      // 以当前知识库为检索依据：检索相关页面内容一并提供给模型
      let context = ''
      let paths: string[] = []
      if (settings.useKnowledgeContext) {
        const result = await retrieveKnowledgeContext(question)
        context = result.content
        paths = result.paths
      }
      const content = buildChatMessage(
        { systemPrompt: settings.systemPrompt },
        wikiRootPath,
        question,
        context,
      )
      // 模型看到的是系统提示词 + 知识库内容 + 问题；界面上只展示问题。
      // 系统提示仅在会话的第一条消息里以折叠块展示一次（默认收起、点击展开），
      // 避免每条消息都重复贴出整段提示词。
      const systemPrompt = buildChatSystemPrompt({ systemPrompt: settings.systemPrompt }, wikiRootPath)
      const firstTurn = (useChatStore.getState().sessions[sessionId]?.messages.length ?? 0) === 0
      const displayContent = firstTurn ? buildDisplayChatContent(systemPrompt, question) : question
      sendMessage(sessionId, content, undefined, { displayContent })
      // 记录本次检索到的页面，待回答结束后追加为论文式"参考依据"
      pendingRefsRef.current = { paths, appended: false }
      setInputValue('')
    } finally {
      setRetrieving(false)
      setSending(false)
    }
  }, [sessionId, inputValue, chatState, sending, sendMessage])

  const handleStop = useCallback(() => {
    if (!sessionId) return
    stopGeneration(sessionId)
  }, [sessionId, stopGeneration])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }, [handleSend])

  const handleSelectHistory = useCallback(
    (id: string) => {
      const previous = sessionIdRef.current
      if (previous && previous !== id) {
        disconnectSession(previous)
      }
      sessionIdRef.current = id
      setSessionId(id)
      pendingRefsRef.current = null
      connectToSession(id)
      setHistoryOpen(false)
    },
    [connectToSession, disconnectSession],
  )

  const handleDeleteHistory = useCallback(
    async (id: string) => {
      useKnowledgeSessionsStore.getState().unregister(id)
      try {
        await deleteSession(id)
      } catch {
        // 服务端删除失败也继续清理本地状态
      }
      if (id === sessionIdRef.current) {
        disconnectSession(id)
        sessionIdRef.current = null
        setSessionId(null)
        pendingRefsRef.current = null
        const newId = await createSession(undefined, {
          permissionMode: 'default',
          mode: 'knowledge',
        })
        useKnowledgeSessionsStore.getState().register(newId, '知识库对话')
        sessionIdRef.current = newId
        connectToSession(newId)
        setSessionId(newId)
      }
    },
    [createSession, connectToSession, deleteSession, disconnectSession],
  )

  // 新建一个干净的知识库会话（气泡按钮），不删除旧会话，保留为聊天历史
  const handleNewSession = useCallback(async () => {
    const previous = sessionIdRef.current
    if (previous) disconnectSession(previous)
    const id = await createSession(undefined, {
      permissionMode: 'default',
      mode: 'knowledge',
    })
    useKnowledgeSessionsStore.getState().register(id, '知识库对话')
    sessionIdRef.current = id
    setSessionId(id)
    setInputValue('')
    pendingRefsRef.current = null
    connectToSession(id)
  }, [createSession, connectToSession, disconnectSession])

  const handleOpenSourcePage = useCallback(
    (path: string) => {
      const title = path.split('/').pop()?.replace(/\.md$/, '') || path
      useKnowledgeTabStore.getState().openTab(`wiki-${path}`, title, 'wiki', path)
      void loadPage(path)
    },
    [loadPage],
  )

  // 消息区的事件委托：点击回复中"参考依据"里的 wiki 链接时打开知识库对应 md 页面
  const handleWikiRefClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-wiki-path]')
      if (!link) return
      e.preventDefault()
      const path = link.getAttribute('data-wiki-path')
      if (path) handleOpenSourcePage(path)
    },
    [handleOpenSourcePage],
  )

  const isGenerating = chatState !== 'idle'
  const messages = sessionState?.messages ?? []
  const isEmpty = messages.length === 0 && !creatingSession

  return (
    <SlidePanel
      title="聊天"
      isCollapsed={isCollapsed}
      onToggle={onToggle}
      resizable
      persistKey="cc-haha-knowledge-chat-width"
      maxWidth={780}
      actions={
        <>
          <button
            ref={historyButtonRef}
            type="button"
            onClick={() => {
              const rect = historyButtonRef.current?.getBoundingClientRect()
              setHistoryAnchorRect(rect ? { top: rect.bottom, left: rect.left } : null)
              setHistoryOpen(true)
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-primary)]"
            title="聊天历史"
            aria-label="聊天历史"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span>
          </button>
          <button
            type="button"
            onClick={() => void handleNewSession()}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-primary)]"
            title="新建会话"
            aria-label="新建会话"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chat_bubble</span>
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-primary)]"
            title="聊天设置"
            aria-label="聊天设置"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>help</span>
          </button>
        </>
      }
    >
      <ChatPanelSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ChatPanelHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        anchorRect={historyAnchorRect}
        activeSessionId={sessionId}
        onSelectSession={handleSelectHistory}
        onDeleteSession={(id) => void handleDeleteHistory(id)}
      />
      <div className="flex-1 flex flex-col h-full">
        {/* 消息列表区域 */}
        <div className="flex-1 overflow-hidden">
          {creatingSession ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-12 h-12 mb-3 rounded-full bg-[var(--color-surface-container)] flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 text-[var(--color-text-tertiary)]" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <p className="text-[var(--color-text-secondary)] text-sm">正在连接聊天服务...</p>
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-12 h-12 mb-3 rounded-full bg-[var(--color-surface-container)] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-[var(--color-text-secondary)] text-sm mb-1">欢迎使用知识库聊天</p>
              <p className="text-[var(--color-text-tertiary)] text-xs">输入问题，我会为您解答</p>
            </div>
          ) : sessionId ? (
            <div className="h-full overflow-y-auto" onClick={handleWikiRefClick}>
              <MessageListInline sessionId={sessionId} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <p className="text-[var(--color-text-tertiary)] text-xs">聊天会话不可用</p>
            </div>
          )}
        </div>

        {/* 检索中反馈：避免检索知识库期间界面看起来像卡死 */}
        {retrieving && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--color-text-tertiary)]">
            <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
            正在检索知识库内容...
          </div>
        )}

        {/* 输入区域 */}
        <div className="p-4 border-t border-[var(--color-border)]/70 bg-[var(--color-surface)]">
          <div className="relative flex flex-col rounded-xl border border-[var(--color-border)]/70 bg-[var(--color-surface)] shadow-sm transition-colors focus-within:border-[var(--color-brand)]/50">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="输入消息..."
              className="w-full px-4 py-3 bg-transparent border-none rounded-t-xl text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] resize-none focus:outline-none"
              rows={1}
              disabled={isGenerating || sending || creatingSession || !sessionId}
              style={{ minHeight: '44px', maxHeight: '200px' }}
            />
            <div className="flex justify-end items-center px-3 pb-3">
              {isGenerating ? (
                <button
                  onClick={handleStop}
                  className="flex items-center justify-center px-3 py-1.5 rounded-lg bg-[var(--color-error)]/10 text-[var(--color-error)] text-xs font-medium hover:bg-[var(--color-error)]/20 transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <rect x="6" y="6" width="12" height="12" />
                  </svg>
                  停止
                </button>
              ) : (
                <button
                  onClick={() => void handleSend()}
                  disabled={!inputValue.trim() || !sessionId || sending}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                    !inputValue.trim() || !sessionId || sending
                      ? 'text-[var(--color-text-tertiary)] cursor-not-allowed'
                      : 'text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </SlidePanel>
  )
}

function MessageListInline({ sessionId }: { sessionId: string }) {
  return (
    <div className="min-h-full">
      {/* mergeSearchPhase：模型检索阶段（思考 + 工具调用）合并成一条淡化的
          "正在检索"行，不逐条刷屏 */}
      <MessageList sessionId={sessionId} compact mergeSearchPhase />
    </div>
  )
}
