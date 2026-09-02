import { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useProjectStore, type ExpertConfig, type MeetingTemplate } from '../../stores/projectStore'
import { useExpertSessionsStore } from '../../stores/expertSessionsStore'
import { MarkdownRenderer } from '../markdown/MarkdownRenderer'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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

const WAIT_TIMEOUT_MS = 120_000

export function MeetingPanel() {
  const {
    experts,
    projectManagerId,
    meetingParticipants,
    addMeetingParticipant,
    removeMeetingParticipant,
    meetingTopic,
    setMeetingTopic,
    meetingMessages,
    addMeetingMessage,
    clearMeetingMessages,
    meetingTemplates,
    addMeetingTemplate,
    removeMeetingTemplate,
  } = useProjectStore()
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [roundBusy, setRoundBusy] = useState(false)
  const [templateId, setTemplateId] = useState<string>('')
  const [progressIndex, setProgressIndex] = useState(0)
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const createSession = useSessionStore((s) => s.createSession)
  const connectToSession = useChatStore((s) => s.connectToSession)
  const disconnectSession = useChatStore((s) => s.disconnectSession)
  const sendMessage = useChatStore((s) => s.sendMessage)

  const manager = experts.find((e) => e.id === projectManagerId)
  const activeExperts = experts.filter((e) => e.enabled)
  const selectedTemplate = meetingTemplates.find((t) => t.id === templateId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [meetingMessages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  // 项目经理自动参会
  useEffect(() => {
    if (projectManagerId && !meetingParticipants.includes(projectManagerId)) {
      addMeetingParticipant(projectManagerId)
    }
  }, [projectManagerId, meetingParticipants, addMeetingParticipant])

  // 卸载时断开所有会议会话
  useEffect(() => {
    return () => {
      for (const id of meetingParticipants) {
        const latest = useExpertSessionsStore.getState().latestForExpert(id)
        if (latest) disconnectSession(latest)
      }
    }
  }, [meetingParticipants, disconnectSession])

  const toggleParticipant = (id: string) => {
    if (meetingParticipants.includes(id)) {
      // 项目经理不可被移出会议
      if (id === projectManagerId) return
      removeMeetingParticipant(id)
    } else {
      addMeetingParticipant(id)
    }
  }

  /** 为专家确保一个真实会话（mode='expert'，复用其最近会话或新建） */
  const ensureSession = useCallback(
    async (expert: ExpertConfig): Promise<string> => {
      const latest = useExpertSessionsStore.getState().latestForExpert(expert.id)
      if (latest) {
        // 必须建立连接并注册消息处理器，否则 sendMessage 后收不到回复
        connectToSession(latest)
        return latest
      }
      const id = await createSession(undefined, { permissionMode: 'default', mode: 'expert' })
      useExpertSessionsStore.getState().register(id, expert.id, `与 ${expert.name} 的对话`)
      connectToSession(id)
      return id
    },
    [createSession, connectToSession],
  )

  /** 等待某会话本轮回答结束并返回新增的回复文本 */
  const waitForReply = useCallback(
    (sessionId: string, beforeCount: number): Promise<string> => {
      return new Promise((resolve) => {
        const startedAt = Date.now()
        const check = () => {
          const session = useChatStore.getState().sessions[sessionId]
          const lastAssistant = session?.messages
            ? [...session.messages].reverse().find((m) => m.type === 'assistant_text')
            : undefined
          if (session?.chatState === 'idle') {
            resolve(
              lastAssistant && session.messages.length > beforeCount ? lastAssistant.content : '',
            )
            return
          }
          if (Date.now() - startedAt > WAIT_TIMEOUT_MS) {
            resolve(lastAssistant?.content ?? '')
            return
          }
          setTimeout(check, 500)
        }
        check()
      })
    },
    [],
  )

  const buildMeetingMessage = (
    expert: ExpertConfig,
    question: string,
  ): string => {
    const role = expert.systemPrompt?.trim()
      ? expert.systemPrompt.trim()
      : '请结合你的专业领域给出专业、可操作的建议。'
    const blocks = [`[系统提示]\n你是「${expert.name}」专家。${role}`]
    const agenda = selectedTemplate?.agenda ?? []
    blocks.push(
      `[会议信息]\n会议主题：${meetingTopic || '(未指定)'}${
        agenda.length > 0 ? `\n会议议程：\n${agenda.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : ''
      }${agenda[progressIndex] ? `\n当前议程步骤：${agenda[progressIndex]}` : ''}`,
    )
    if (meetingMessages.length > 0) {
      const transcript = meetingMessages
        .slice(-12)
        .map((m) => `${m.expertName}：${m.content.slice(0, 800)}`)
        .join('\n')
      blocks.push(`[会议记录]\n${transcript}`)
    }
    blocks.push(`[用户问题]\n${question}`)
    return blocks.join('\n\n')
  }

  /** 让每位参会专家基于会议上下文依次真实回答 */
  const runRound = useCallback(
    async (question: string) => {
      setRoundBusy(true)
      try {
        for (const id of meetingParticipants) {
          const expert = activeExperts.find((e) => e.id === id)
          if (!expert) continue
          const sessionId = await ensureSession(expert)
          const beforeCount = useChatStore.getState().sessions[sessionId]?.messages.length ?? 0
          sendMessage(sessionId, buildMeetingMessage(expert, question), undefined)
          const reply = await waitForReply(sessionId, beforeCount)
          if (reply.trim()) {
            addMeetingMessage({
              expertId: expert.id,
              expertName: expert.name,
              expertAvatar: expert.avatar,
              content: reply,
              timestamp: Date.now(),
            })
          }
        }
      } finally {
        setRoundBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meetingParticipants, activeExperts, ensureSession, waitForReply, sendMessage, addMeetingMessage, meetingTopic, meetingMessages, selectedTemplate, progressIndex],
  )

  const handleSend = () => {
    const text = input.trim()
    if (!text || roundBusy) return
    addMeetingMessage({
      expertId: 'user',
      expertName: '我',
      expertAvatar: '👤',
      content: text,
      timestamp: Date.now(),
    })
    setInput('')
    void runRound(text)
  }

  const handleStartDiscussion = () => {
    if (!meetingTopic.trim() || meetingParticipants.length < 2) return
    clearMeetingMessages()
    setProgressIndex(0)
    setIsRunning(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isRunning) handleSend()
    }
  }

  const getExpertColor = (expertId: string) => {
    if (expertId === 'user') return 'var(--color-text-tertiary)'
    const expert = experts.find((e) => e.id === expertId)
    return expert?.color && AGENT_COLORS[expert.color] ? AGENT_COLORS[expert.color] : '#a855f7'
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* === LEFT: 参会专家 / 模板 / 进度 === */}
      <div className="w-[320px] shrink-0 flex flex-col border-r border-[var(--color-border-separator)]">
        <div className="px-4 py-3 border-b border-[var(--color-border-separator)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">参会专家</h3>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
            选择 2-4 位专家参与讨论，项目经理自动参会
          </p>
        </div>

        {/* Expert list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {manager && (
            <button
              onClick={() => toggleParticipant(manager.id)}
              disabled={isRunning}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                'bg-[var(--color-brand)]/8 ring-1 ring-[var(--color-brand)]/30'
              } ${isRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{
                  backgroundColor: (AGENT_COLORS[manager.color] || '#a855f7') + '18',
                  border: `2px solid ${(AGENT_COLORS[manager.color] || '#a855f7')}25`,
                }}
              >
                {manager.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {manager.name}
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                    PM
                  </span>
                </div>
                <div className="text-[10px] text-[var(--color-text-tertiary)] truncate">项目经理 · 管理模板与进度</div>
              </div>
              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center bg-[var(--color-brand)] border-[var(--color-brand)] shrink-0">
                <span className="material-symbols-outlined text-[12px] text-white">check</span>
              </div>
            </button>
          )}
          {activeExperts.filter((e) => e.id !== projectManagerId).map((expert) => {
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
                  style={{ backgroundColor: color + '18', border: `2px solid ${color}25` }}
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
                    isSelected ? 'bg-[var(--color-brand)] border-[var(--color-brand)]' : 'border-[var(--color-border)]'
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

        {/* 会议模板 + 进度 */}
        <div className="border-t border-[var(--color-border-separator)] p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-[var(--color-text-tertiary)]">会议模板</label>
              {manager && (
                <button
                  onClick={() => setTemplateModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-[var(--color-brand)] hover:underline"
                >
                  <span className="material-symbols-outlined text-[12px]">settings</span>
                  管理
                </button>
              )}
            </div>
            <select
              value={templateId}
              onChange={(e) => { setTemplateId(e.target.value); setProgressIndex(0) }}
              className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="">不使用模板</option>
              {meetingTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {selectedTemplate && selectedTemplate.agenda.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-[var(--color-text-tertiary)]">
                  会议进度 {Math.min(progressIndex + 1, selectedTemplate.agenda.length)}/{selectedTemplate.agenda.length}
                </label>
                {manager && isRunning && (
                  <button
                    onClick={() => setProgressIndex((i) => Math.min(i + 1, selectedTemplate.agenda.length - 1))}
                    disabled={progressIndex >= selectedTemplate.agenda.length - 1}
                    className="flex items-center gap-1 text-[11px] text-[var(--color-brand)] disabled:opacity-30 hover:underline"
                  >
                    <span className="material-symbols-outlined text-[12px]">skip_next</span>
                    下一步
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {selectedTemplate.agenda.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                      i === progressIndex
                        ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                        : i < progressIndex
                          ? 'text-[var(--color-text-tertiary)] line-through opacity-60'
                          : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px]">
                      {i < progressIndex ? 'check_circle' : i === progressIndex ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </span>
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 主题 + 开始 */}
        {!isRunning ? (
          <div className="border-t border-[var(--color-border-separator)] p-4 space-y-3">
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] mb-1 block">讨论主题</label>
              <textarea
                value={meetingTopic}
                onChange={(e) => setMeetingTopic(e.target.value)}
                placeholder="输入讨论主题..."
                rows={2}
                className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-3 py-2 text-sm text-[var(--color-text-primary)] leading-relaxed outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)] transition-colors"
              />
            </div>
            <button
              onClick={handleStartDiscussion}
              disabled={!meetingTopic.trim() || meetingParticipants.length < 2}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold disabled:opacity-30 hover:brightness-105 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              开始会议
            </button>
            {meetingParticipants.length < 2 && (
              <p className="text-[10px] text-[var(--color-text-tertiary)] text-center">至少选择 2 位专家</p>
            )}
          </div>
        ) : (
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
                    style={{ backgroundColor: color + '15', color }}
                  >
                    <span>{expert.avatar}</span>
                    <span>{expert.name}</span>
                    {expert.id === projectManagerId && <span className="text-[9px]">PM</span>}
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-[var(--color-text-tertiary)] text-center">
              {roundBusy ? '专家们正在讨论中...' : '讨论进行中 · 在右侧输入您的问题'}
            </p>
          </div>
        )}
      </div>

      {/* === RIGHT: 会议讨论区 === */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-separator)] shrink-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {isRunning ? (
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${roundBusy ? 'bg-[var(--color-brand)] animate-pulse' : 'bg-[var(--color-success)]'} `} />
                {roundBusy ? '讨论中' : '会议中'}
              </span>
            ) : '会议室'}
          </h3>
          {meetingMessages.length > 0 && (
            <button
              onClick={() => { clearMeetingMessages(); setIsRunning(false); setProgressIndex(0) }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              新会议
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {meetingMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-5xl text-[var(--color-text-tertiary)] mb-4">groups</span>
              <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">选择左侧专家并开始会议</h4>
              <p className="text-xs text-[var(--color-text-tertiary)] max-w-sm leading-relaxed">
                邀请 2-4 位专家（含项目经理）就一个主题召开会议。您的提问会依次送达每位专家，由各专家基于其系统提示词与会议上下文真实回答。
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {SAMPLE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setMeetingTopic(s)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-focus)] hover:text-[var(--color-text-primary)] transition-all"
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
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 mt-0.5"
                      style={
                        isUser
                          ? { backgroundColor: 'var(--color-surface-container)', border: '2px solid var(--color-border)' }
                          : { backgroundColor: color + '18', border: `2px solid ${color}25` }
                      }
                    >
                      {msg.expertAvatar}
                    </div>
                    <div
                      className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed text-[var(--color-text-primary)] shadow-sm ${
                        isUser
                          ? 'bg-[var(--color-brand)]/10 rounded-[18px] rounded-tr-[4px]'
                          : 'bg-[var(--color-surface)] border border-[var(--color-border)]/60 rounded-[18px] rounded-tl-[4px]'
                      }`}
                    >
                      {!isUser && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color, backgroundColor: color + '12' }}>
                            {msg.expertName}
                            {msg.expertId === projectManagerId ? ' · PM' : ''}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
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
                          {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {roundBusy && (
                <div className="flex items-center gap-2 px-2 text-xs text-[var(--color-text-tertiary)]">
                  <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                  专家正在依次回答...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

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
                  className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] leading-relaxed outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)] transition-colors"
                  style={{ minHeight: '42px', maxHeight: '120px' }}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || roundBusy}
                className="flex items-center justify-center w-[42px] h-[42px] rounded-xl bg-[var(--color-brand)] text-white disabled:opacity-30 hover:brightness-105 transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 模板管理弹窗（仅 PM） */}
      <TemplateManagerModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        templates={meetingTemplates}
        onAdd={(name, agenda) =>
          addMeetingTemplate({ id: `template-${Date.now()}`, name, agenda, createdAt: Date.now() })
        }
        onRemove={removeMeetingTemplate}
      />
    </div>
  )
}

function TemplateManagerModal({
  open,
  onClose,
  templates,
  onAdd,
  onRemove,
}: {
  open: boolean
  onClose: () => void
  templates: MeetingTemplate[]
  onAdd: (name: string, agenda: string[]) => void
  onRemove: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [agendaText, setAgendaText] = useState('')

  const handleAdd = () => {
    if (!name.trim()) return
    const agenda = agendaText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    onAdd(name.trim(), agenda)
    setName('')
    setAgendaText('')
  }

  return (
    <Modal open={open} onClose={onClose} title="会议模板管理" width={480}>
      <div className="flex flex-col gap-4">
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">已有模板</h4>
          {templates.length === 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)]">暂无模板</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">{t.name}</div>
                    <div className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                      {t.agenda.join(' · ')}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(t.id)}
                    className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/5"
                    title="删除模板"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">新增模板</h4>
          <Input label="模板名称" value={name} placeholder="例如：设计评审" onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">议程（每行一项）</span>
            <textarea
              value={agendaText}
              onChange={(e) => setAgendaText(e.target.value)}
              rows={4}
              placeholder={'需求澄清\n方案评审\n风险评估\n行动项确认'}
              className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
            />
          </div>
          <Button variant="primary" size="sm" onClick={handleAdd}>添加模板</Button>
        </div>
      </div>
    </Modal>
  )
}
