import { useEffect, useMemo, useRef } from 'react'
import { useSessionStore } from '../../stores/sessionStore'
import { useExpertSessionsStore } from '../../stores/expertSessionsStore'

type Props = {
  open: boolean
  onClose: () => void
  /** 历史按钮在视口中的位置，用于把弹层锚定到按钮左侧附近 */
  anchorRect: { top: number; left: number } | null
  expertId: string
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
}

const POPOVER_WIDTH = 300

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return date.toLocaleDateString()
}

export function ExpertChatHistory({
  open,
  onClose,
  anchorRect,
  expertId,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}: Props) {
  const sessions = useSessionStore((s) => s.sessions)
  const registry = useExpertSessionsStore((s) => s.sessions)
  const popoverRef = useRef<HTMLDivElement>(null)

  const history = useMemo(() => {
    const sessionIds = new Set(
      registry.filter((entry) => entry.expertId === expertId).map((entry) => entry.id),
    )
    return sessions
      .filter((session) => session.mode === 'expert' && sessionIds.has(session.id))
      .sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))
  }, [sessions, registry, expertId])

  // 点击弹层外部或按 Esc 关闭
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open || !anchorRect) return null

  const left = Math.max(8, anchorRect.left - POPOVER_WIDTH - 8)
  const top = anchorRect.top + 6

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="聊天历史"
      className="fixed z-50 flex max-h-[60vh] w-[300px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      style={{ left, top, width: POPOVER_WIDTH }}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border-separator)] px-4 py-2.5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">聊天历史</h3>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-primary)]"
          title="关闭"
          aria-label="关闭聊天历史"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="material-symbols-outlined mb-3 text-[32px] text-[var(--color-text-tertiary)]">
              history
            </span>
            <p className="text-sm text-[var(--color-text-tertiary)]">暂无该专家的聊天记录</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {history.map((session) => {
              const isActive = session.id === activeSessionId
              const title = session.title && session.title !== 'New Session'
                ? session.title
                : '专家对话'
              return (
                <div
                  key={session.id}
                  className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                    isActive
                      ? 'border-[var(--color-brand)]/50 bg-[var(--color-surface-container-low)]'
                      : 'border-transparent hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-container-low)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSession(session.id)}
                    className="min-w-0 flex-1 text-left"
                    title={session.id}
                  >
                    <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                      <span>{formatTime(session.modifiedAt)}</span>
                      {isActive && (
                        <span className="rounded bg-[var(--color-brand)]/10 px-1.5 py-px text-[var(--color-brand)]">
                          当前
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSession(session.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
                    title="删除该聊天记录"
                    aria-label={`删除聊天记录 ${title}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
