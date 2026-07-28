import { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { sessionsApi } from '../../api/sessions'
import { SlidePanel } from './SlidePanel'
import { MessageList } from '../chat/MessageList'

interface ChatPanelProps {
  isCollapsed: boolean
  onToggle: () => void
}

let sessionCounter = 0

export function ChatPanel({ isCollapsed, onToggle }: ChatPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [creatingSession, setCreatingSession] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sessionCreatedRef = useRef(false)

  const createSession = useSessionStore((s) => s.createSession)
  const connectToSession = useChatStore((s) => s.connectToSession)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const stopGeneration = useChatStore((s) => s.stopGeneration)
  const sessionState = useChatStore((s) => sessionId ? s.sessions[sessionId] : undefined)
  const chatState = sessionState?.chatState ?? 'idle'
  const sessionIdRef = useRef<string | null>(null)

  // 创建知识库专属 session，标记 mode='knowledge' 实现自动隔离
  useEffect(() => {
    if (sessionCreatedRef.current) return
    sessionCreatedRef.current = true

    const initSession = async () => {
      try {
        sessionCounter++
        const id = await createSession(undefined, {
          permissionMode: 'acceptEdits',
          mode: 'knowledge',
        })
        sessionIdRef.current = id
        connectToSession(id)
        setSessionId(id)
        setCreatingSession(false)
      } catch (err) {
        console.error('Failed to create knowledge chat session:', err)
        setCreatingSession(false)
      }
    }

    void initSession()

    // Cleanup: 断开 session 连接并删除服务端会话
    return () => {
      const currentId = sessionIdRef.current
      if (currentId) {
        useChatStore.getState().disconnectSession(currentId)
        sessionsApi.delete(currentId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createSession])

  // 自动调整 textarea 高度
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [inputValue])

  const handleSend = useCallback(() => {
    if (!sessionId || !inputValue.trim() || chatState !== 'idle') return
    sendMessage(sessionId, inputValue.trim())
    setInputValue('')
  }, [sessionId, inputValue, chatState, sendMessage])

  const handleStop = useCallback(() => {
    if (!sessionId) return
    stopGeneration(sessionId)
  }, [sessionId, stopGeneration])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const isGenerating = chatState !== 'idle'
  const messages = sessionState?.messages ?? []
  const isEmpty = messages.length === 0 && !creatingSession

  return (
    <SlidePanel title="聊天" isCollapsed={isCollapsed} onToggle={onToggle}>
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
            <div className="h-full overflow-y-auto">
              {/* 直接使用 MessageList 组件 */}
              <MessageListInline sessionId={sessionId} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <p className="text-[var(--color-text-tertiary)] text-xs">聊天会话不可用</p>
            </div>
          )}
        </div>

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
              disabled={isGenerating || creatingSession || !sessionId}
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
                  onClick={handleSend}
                  disabled={!inputValue.trim() || !sessionId}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                    !inputValue.trim() || !sessionId
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
      <MessageList sessionId={sessionId} compact />
    </div>
  )
}
