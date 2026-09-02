import { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useProjectStore } from '../../stores/projectStore'
import { useExpertSessionsStore } from '../../stores/expertSessionsStore'
import { retrieveExpertContext, buildExpertChatMessage } from '../../lib/expertChatPrompt'
import { localFileUrl } from '../../lib/handlePreviewLink'
import { getServerBaseUrl } from '../../lib/desktopRuntime'
import { MessageList } from '../chat/MessageList'
import { ExpertChatHistory } from './ExpertChatHistory'
import { ExpertChatSettings } from './ExpertChatSettings'

const AGENT_COLORS: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
  cyan: '#06b6d4',
}

export function ExpertChat() {
  const { experts, selectedExpertId, setShowExpertSelector } = useProjectStore()
  const expert = experts.find((e) => e.id === selectedExpertId)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyAnchorRect, setHistoryAnchorRect] = useState<{ top: number; left: number } | null>(null)
  const [sending, setSending] = useState(false)
  const [retrieving, setRetrieving] = useState(false)
  const sessionIdRef = useRef<string | null>(null)
  const initRef = useRef<string | null>(null)
  const historyButtonRef = useRef<HTMLButtonElement>(null)

  const createSession = useSessionStore((s) => s.createSession)
  const deleteSession = useSessionStore((s) => s.deleteSession)
  const connectToSession = useChatStore((s) => s.connectToSession)
  const disconnectSession = useChatStore((s) => s.disconnectSession)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const sessionState = useChatStore((s) => (sessionId ? s.sessions[sessionId] : undefined))
  const chatState = sessionState?.chatState ?? 'idle'

  // 初始化/切换专家：优先复用该专家的最近会话，否则新建（保留为历史）
  useEffect(() => {
    if (!expert) return
    if (initRef.current === expert.id) return
    initRef.current = expert.id

    const init = async () => {
      const previous = sessionIdRef.current
      if (previous) disconnectSession(previous)

      const latest = useExpertSessionsStore.getState().latestForExpert(expert.id)
      if (latest) {
        sessionIdRef.current = latest
        connectToSession(latest)
        setSessionId(latest)
        setCreatingSession(false)
        return
      }
      try {
        const id = await createSession(undefined, {
          permissionMode: 'default',
          mode: 'expert',
        })
        useExpertSessionsStore.getState().register(id, expert.id, `与 ${expert.name} 的对话`)
        sessionIdRef.current = id
        connectToSession(id)
        setSessionId(id)
        setCreatingSession(false)
      } catch (err) {
        console.error('Failed to create expert chat session:', err)
        setCreatingSession(false)
      }
    }
    void init()
  }, [expert, createSession, connectToSession, disconnectSession])

  useEffect(() => {
    return () => {
      const currentId = sessionIdRef.current
      if (currentId) disconnectSession(currentId)
    }
  }, [disconnectSession])

  const handleSend = useCallback(async () => {
    if (!sessionId || !inputValue.trim() || chatState !== 'idle' || sending || !expert) return
    const question = inputValue.trim()
    setSending(true)
    setRetrieving(true)
    try {
      // 专家配置了知识库时自动检索相关内容一并提供给模型
      const { content } = await retrieveExpertContext(expert, question)
      const message = buildExpertChatMessage(expert, question, content)
      sendMessage(sessionId, message, undefined, { displayContent: question })
      setInputValue('')
    } finally {
      setRetrieving(false)
      setSending(false)
    }
  }, [sessionId, inputValue, chatState, sending, expert, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleSelectHistory = useCallback(
    (id: string) => {
      const previous = sessionIdRef.current
      if (previous && previous !== id) {
        disconnectSession(previous)
      }
      sessionIdRef.current = id
      setSessionId(id)
      connectToSession(id)
      setHistoryOpen(false)
    },
    [connectToSession, disconnectSession],
  )

  const handleDeleteHistory = useCallback(
    async (id: string) => {
      useExpertSessionsStore.getState().unregister(id)
      try {
        await deleteSession(id)
      } catch {
        // 服务端删除失败也继续清理本地状态
      }
      if (id === sessionIdRef.current) {
        disconnectSession(id)
        sessionIdRef.current = null
        setSessionId(null)
        if (expert) {
          const newId = await createSession(undefined, {
            permissionMode: 'default',
            mode: 'expert',
          })
          useExpertSessionsStore.getState().register(newId, expert.id, `与 ${expert.name} 的对话`)
          sessionIdRef.current = newId
          connectToSession(newId)
          setSessionId(newId)
        }
      }
    },
    [createSession, connectToSession, deleteSession, disconnectSession, expert],
  )

  const handleNewSession = useCallback(async () => {
    if (!expert) return
    const previous = sessionIdRef.current
    if (previous) disconnectSession(previous)
    const id = await createSession(undefined, {
      permissionMode: 'default',
      mode: 'expert',
    })
    useExpertSessionsStore.getState().register(id, expert.id, `与 ${expert.name} 的对话`)
    sessionIdRef.current = id
    setSessionId(id)
    setInputValue('')
    connectToSession(id)
  }, [createSession, connectToSession, disconnectSession, expert])

  if (!expert) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-tertiary)]">
        <p>未选择专家</p>
      </div>
    )
  }

  const dotColor = expert.color && AGENT_COLORS[expert.color]
    ? AGENT_COLORS[expert.color]
    : 'var(--color-text-tertiary)'
  const avatarUrl = expert.avatarPath ? localFileUrl(getServerBaseUrl(), expert.avatarPath) : null
  const messages = sessionState?.messages ?? []
  const isEmpty = messages.length === 0 && !creatingSession
  const isGenerating = chatState !== 'idle'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border-separator)] shrink-0">
        <button
          onClick={() => setShowExpertSelector(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
            hover:bg-[var(--color-surface-hover)] transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          返回
        </button>

        {/* Expert avatar + name */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-xl shrink-0"
            style={{
              backgroundColor: dotColor + '18',
              border: `2px solid ${dotColor}30`,
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={expert.name} className="w-full h-full object-cover" />
            ) : (
              expert.avatar
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {expert.name}
              {expert.isManager && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                  PM
                </span>
              )}
            </div>
            <div className="text-[11px] text-[var(--color-text-tertiary)] truncate">
              {expert.description?.slice(0, 40)}...
            </div>
          </div>
        </div>

        {/* Actions: 设置 + 历史 + 新建会话 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-primary)]"
            title="聊天设置"
            aria-label="聊天设置"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>settings</span>
          </button>
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
        </div>
      </div>

      <ExpertChatHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        anchorRect={historyAnchorRect}
        expertId={expert.id}
        activeSessionId={sessionId}
        onSelectSession={handleSelectHistory}
        onDeleteSession={(id) => void handleDeleteHistory(id)}
      />

      <ExpertChatSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Messages area */}
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
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div
              className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-4xl mb-4"
              style={{
                backgroundColor: dotColor + '15',
                border: `2px solid ${dotColor}25`,
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={expert.name} className="w-full h-full object-cover" />
              ) : (
                expert.avatar
              )}
            </div>
            <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">
              {expert.name}
            </h3>
            <p className="text-xs text-[var(--color-text-tertiary)] max-w-md mb-6 leading-relaxed">
              {expert.description}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { label: '请教设计建议', icon: 'build' },
                { label: '分析公差方案', icon: 'straighten' },
                { label: '材料选型咨询', icon: 'science' },
              ].map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => setInputValue(suggestion.label)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                    border border-[var(--color-border)] text-[var(--color-text-secondary)]
                    hover:border-[var(--color-border-focus)] hover:text-[var(--color-text-primary)]
                    hover:bg-[var(--color-surface-hover)] transition-all"
                >
                  <span className="material-symbols-outlined text-[14px]">{suggestion.icon}</span>
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        ) : sessionId ? (
          <div className="h-full overflow-y-auto">
            <div className="min-h-full">
              <MessageList sessionId={sessionId} compact />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <p className="text-[var(--color-text-tertiary)] text-xs">聊天会话不可用</p>
          </div>
        )}
      </div>

      {/* 检索知识库反馈 */}
      {retrieving && (
        <div className="flex items-center gap-2 px-5 py-2 text-xs text-[var(--color-text-tertiary)]">
          <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
          正在检索知识库内容...
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-[var(--color-border-separator)] px-5 py-3">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`向 ${expert.name} 提问...`}
              rows={1}
              disabled={isGenerating || sending || creatingSession || !sessionId}
              className="w-full resize-none rounded-xl border border-[var(--color-border)]
                bg-[var(--color-surface-container-lowest)] px-4 py-2.5
                text-sm text-[var(--color-text-primary)] leading-relaxed
                outline-none placeholder:text-[var(--color-text-tertiary)]
                focus:border-[var(--color-border-focus)] transition-colors"
              style={{ minHeight: '42px', maxHeight: '200px' }}
            />
          </div>
          <button
            onClick={() => void handleSend()}
            disabled={!inputValue.trim() || !sessionId || sending}
            className="flex items-center justify-center w-[42px] h-[42px] rounded-xl
              bg-[var(--color-brand)] text-white disabled:opacity-30
              hover:brightness-105 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </div>
    </div>
  )
}
