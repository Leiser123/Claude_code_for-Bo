import { useState, useRef, useEffect } from 'react'
import { useProjectStore, type MeetingMessage } from '../../stores/projectStore'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'

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

const SAMPLE_SUGGESTIONS = [
  '这个零件采用注塑还是机加更合适？',
  '分析该设计的公差累积风险',
  '评估这种材料选择对成本的影响',
  '该结构能否满足振动耐久要求？',
]

export function MeetingPanel() {
  const {
    experts,
    meetingParticipants,
    addMeetingParticipant,
    removeMeetingParticipant,
    meetingTopic,
    setMeetingTopic,
    meetingMessages,
    addMeetingMessage,
    clearMeetingMessages,
  } = useProjectStore()
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [meetingMessages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  const toggleParticipant = (id: string) => {
    if (meetingParticipants.includes(id)) {
      removeMeetingParticipant(id)
    } else {
      addMeetingParticipant(id)
    }
  }

  const handleStartDiscussion = () => {
    if (!meetingTopic.trim() || meetingParticipants.length < 2) return
    setIsRunning(true)
    clearMeetingMessages()

    // Simulate multi-expert discussion
    const participants = meetingParticipants
      .map((id) => experts.find((e) => e.id === id))
      .filter(Boolean) as typeof experts

    const topic = meetingTopic.trim()

    // Expert 1 speaks
    setTimeout(() => {
      const e1 = participants[0]
      if (!e1) return
      addMeetingMessage({
        expertId: e1.id,
        expertName: e1.name,
        expertAvatar: e1.avatar,
        content: `关于"${topic}"，从我的专业角度看：\n\n1. **关键考量因素**：\n   - 需要先明确设计边界条件\n   - 建议进行初步的可行性评估\n\n2. **初步建议**：\n   建议从以下三个方面入手分析：功能需求、制造约束、成本目标。`,
        timestamp: Date.now(),
      })
    }, 800)

    // Expert 2 replies after a delay
    setTimeout(() => {
      const e2 = participants[1 % participants.length]
      if (!e2) return
      addMeetingMessage({
        expertId: e2.id,
        expertName: e2.name,
        expertAvatar: e2.avatar,
        content: `我补充几点${participants[0]?.name || ''}的观点：\n\n> 需要先明确设计边界条件\n\n完全同意。在实际项目中，边界条件的定义往往决定了后续分析的准确性。\n\n另外我建议增加一个**DFM评估**步骤，这可以在早期发现潜在的制造风险。`,
        timestamp: Date.now(),
      })
    }, 2200)

    // Expert 3 chimes in
    if (participants.length >= 3) {
      setTimeout(() => {
        const e3 = participants[2]
        if (!e3) return
        addMeetingMessage({
          expertId: e3.id,
          expertName: e3.name,
          expertAvatar: e3.avatar,
          content: `从我的经验来看，这个问题还需要关注以下几点：\n\n- **标准符合性**：检查相关行业标准要求\n- **历史数据**：类似项目的经验和教训\n- **验证方案**：如何验证最终方案的可行性\n\n建议将讨论结果整理成一份**行动清单**，明确每个环节的责任人和时间节点。`,
          timestamp: Date.now(),
        })
      }, 3800)
    }
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text) return

    addMeetingMessage({
      expertId: 'user',
      expertName: '我',
      expertAvatar: '👤',
      content: text,
      timestamp: Date.now(),
    })
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isRunning) handleSend()
    }
  }

  const getExpertColor = (expertId: string) => {
    const expert = experts.find((e) => e.id === expertId)
    return expert?.color && AGENT_COLORS[expert.color] ? AGENT_COLORS[expert.color] : '#a855f7'
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* === LEFT: Participant selection (when not running) === */}
      <div className="w-[300px] shrink-0 flex flex-col border-r border-[var(--color-border-separator)]">
        <div className="px-4 py-3 border-b border-[var(--color-border-separator)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            参会专家
          </h3>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
            选择 2-4 位专家参与讨论
          </p>
        </div>

        {/* Expert list for selection */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {experts.map((expert) => {
            const isSelected = meetingParticipants.includes(expert.id)
            const color = expert.color && AGENT_COLORS[expert.color]
              ? AGENT_COLORS[expert.color]
              : '#a855f7'

            return (
              <button
                key={expert.id}
                onClick={() => toggleParticipant(expert.id)}
                disabled={isRunning}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                  isSelected
                    ? 'bg-[var(--color-brand)]/8 ring-1 ring-[var(--color-brand)]/30'
                    : 'hover:bg-[var(--color-surface-container-low)] border border-transparent'
                } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{
                    backgroundColor: color + '18',
                    border: `2px solid ${color}25`,
                  }}
                >
                  {expert.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {expert.name}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-tertiary)] truncate">
                    {expert.description?.slice(0, 30)}...
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? 'bg-[var(--color-brand)] border-[var(--color-brand)]'
                      : 'border-[var(--color-border)]'
                  }`}
                >
                  {isSelected && (
                    <span className="material-symbols-outlined text-[12px] text-white">check</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Topic input + start button */}
        {!isRunning && (
          <div className="border-t border-[var(--color-border-separator)] p-4 space-y-3">
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] mb-1 block">
                讨论主题
              </label>
              <textarea
                value={meetingTopic}
                onChange={(e) => setMeetingTopic(e.target.value)}
                placeholder="输入讨论主题..."
                rows={2}
                className="w-full resize-none rounded-lg border border-[var(--color-border)]
                  bg-[var(--color-surface-container-lowest)] px-3 py-2
                  text-sm text-[var(--color-text-primary)] leading-relaxed
                  outline-none placeholder:text-[var(--color-text-tertiary)]
                  focus:border-[var(--color-border-focus)] transition-colors"
              />
            </div>
            <button
              onClick={handleStartDiscussion}
              disabled={!meetingTopic.trim() || meetingParticipants.length < 2}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                bg-[var(--color-brand)] text-white text-sm font-semibold
                disabled:opacity-30 hover:brightness-105 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              开始讨论
            </button>
            {meetingParticipants.length < 2 && (
              <p className="text-[10px] text-[var(--color-text-tertiary)] text-center">
                至少选择 2 位专家
              </p>
            )}
          </div>
        )}

        {isRunning && (
          <div className="border-t border-[var(--color-border-separator)] p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {meetingParticipants.map((id) => {
                const expert = experts.find((e) => e.id === id)
                if (!expert) return null
                const color = getExpertColor(id)
                return (
                  <div
                    key={id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
                    style={{
                      backgroundColor: color + '15',
                      color: color,
                    }}
                  >
                    <span>{expert.avatar}</span>
                    <span>{expert.name}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-[var(--color-text-tertiary)] text-center">
              讨论进行中 · 在右侧输入您的问题
            </p>
          </div>
        )}
      </div>

      {/* === RIGHT: Discussion chat area === */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-separator)] shrink-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {isRunning ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                讨论中
              </span>
            ) : '讨论区'}
          </h3>
          {meetingMessages.length > 0 && (
            <button
              onClick={() => { clearMeetingMessages(); setIsRunning(false) }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]
                hover:bg-[var(--color-surface-hover)] transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              新讨论
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {meetingMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-5xl text-[var(--color-text-tertiary)] mb-4">
                groups
              </span>
              <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                选择左侧专家并开始讨论
              </h4>
              <p className="text-xs text-[var(--color-text-tertiary)] max-w-sm leading-relaxed">
                邀请 2-4 位不同领域的专家，输入一个讨论主题，系统将模拟多专家辩论场景，从各自专业角度分析问题。
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {SAMPLE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setMeetingTopic(s)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium
                      border border-[var(--color-border)] text-[var(--color-text-secondary)]
                      hover:border-[var(--color-border-focus)] hover:text-[var(--color-text-primary)] transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto flex flex-col gap-4">
              {meetingMessages.map((msg, idx) => {
                const isUser = msg.expertId === 'user'
                const color = getExpertColor(msg.expertId)

                return (
                  <div key={idx} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 mt-0.5"
                      style={
                        isUser
                          ? {
                              backgroundColor: 'var(--color-surface-container)',
                              border: '2px solid var(--color-border)',
                            }
                          : {
                              backgroundColor: color + '18',
                              border: `2px solid ${color}25`,
                            }
                      }
                    >
                      {msg.expertAvatar}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed text-[var(--color-text-primary)] shadow-sm ${
                        isUser
                          ? 'bg-[var(--color-brand)]/10 rounded-[18px] rounded-tr-[4px]'
                          : 'bg-[var(--color-surface)] border border-[var(--color-border)]/60 rounded-[18px] rounded-tl-[4px]'
                      }`}
                    >
                      {/* Expert name tag */}
                      {!isUser && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ color, backgroundColor: color + '12' }}
                          >
                            {msg.expertName}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}

                      {isUser ? (
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      ) : (
                        <MarkdownRenderer content={msg.content} variant="default" />
                      )}

                      {isUser && (
                        <div className="text-[10px] text-[var(--color-text-tertiary)] mt-1 text-right">
                          {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input (only when discussion is running) */}
        {isRunning && (
          <div className="shrink-0 border-t border-[var(--color-border-separator)] px-5 py-3">
            <div className="max-w-3xl mx-auto flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="向专家们提问..."
                  rows={1}
                  className="w-full resize-none rounded-xl border border-[var(--color-border)]
                    bg-[var(--color-surface-container-lowest)] px-4 py-2.5
                    text-sm text-[var(--color-text-primary)] leading-relaxed
                    outline-none placeholder:text-[var(--color-text-tertiary)]
                    focus:border-[var(--color-border-focus)] transition-colors"
                  style={{ minHeight: '42px', maxHeight: '120px' }}
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
        )}
      </div>
    </div>
  )
}