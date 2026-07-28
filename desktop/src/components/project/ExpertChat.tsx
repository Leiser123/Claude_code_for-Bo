import { useState, useRef, useEffect, useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

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
  const {
    experts,
    selectedExpertId,
    setShowExpertSelector,
  } = useProjectStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const expert = experts.find((e) => e.id === selectedExpertId)
  const dotColor = expert?.color && AGENT_COLORS[expert.color]
    ? AGENT_COLORS[expert.color]
    : 'var(--color-text-tertiary)'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    // Simulate expert reply
    const expertMsg: ChatMessage = {
      role: 'assistant',
      content: `感谢您的咨询。作为 **${expert?.name || '专家'}**，我已收到您的问题。\n\n> ${text}\n\n系统正在准备专业回复，此功能将在后续版本中接入实际 AI 模型。`,
      timestamp: Date.now(),
    }
    setTimeout(() => {
      setMessages((prev) => [...prev, expertMsg])
    }, 600)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!expert) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-tertiary)]">
        <p>未选择专家</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with back button */}
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
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
            style={{
              backgroundColor: dotColor + '18',
              border: `2px solid ${dotColor}30`,
            }}
          >
            {expert.avatar}
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
              {expert.name}
            </div>
            <div className="text-[11px] text-[var(--color-text-tertiary)]">
              {expert.description?.slice(0, 40)}...
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl mb-4"
              style={{
                backgroundColor: dotColor + '15',
                border: `2px solid ${dotColor}25`,
              }}
            >
              {expert.avatar}
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
                  onClick={() => {
                    setInput(suggestion.label)
                  }}
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
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar column */}
                {msg.role === 'assistant' && (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 mt-0.5"
                    style={{
                      backgroundColor: dotColor + '18',
                      border: `2px solid ${dotColor}25`,
                    }}
                  >
                    {expert.avatar}
                  </div>
                )}

                {msg.role === 'user' && (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 mt-0.5"
                    style={{
                      backgroundColor: 'var(--color-surface-container)',
                      border: '2px solid var(--color-border)',
                    }}
                  >
                    👤
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`max-w-[75%] ${
                    msg.role === 'user'
                      ? 'bg-[var(--color-brand)]/10 rounded-[18px] rounded-tr-[4px]'
                      : 'bg-[var(--color-surface)] border border-[var(--color-border)]/60 rounded-[18px] rounded-tl-[4px]'
                  } px-4 py-3 text-sm leading-relaxed text-[var(--color-text-primary)] shadow-sm`}
                >
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} variant="default" />
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  )}
                  <div className={`text-[10px] text-[var(--color-text-tertiary)] mt-1.5 ${
                    msg.role === 'user' ? 'text-right' : ''
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-[var(--color-border-separator)] px-5 py-3">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`向 ${expert.name} 提问...`}
              rows={1}
              className="w-full resize-none rounded-xl border border-[var(--color-border)]
                bg-[var(--color-surface-container-lowest)] px-4 py-2.5
                text-sm text-[var(--color-text-primary)] leading-relaxed
                outline-none placeholder:text-[var(--color-text-tertiary)]
                focus:border-[var(--color-border-focus)] transition-colors"
              style={{ minHeight: '42px', maxHeight: '200px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim()}
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