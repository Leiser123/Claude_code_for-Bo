import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'

interface SlidePanelProps {
  title: string
  children: ReactNode
  isCollapsed?: boolean
  onToggle?: () => void
  /** 头部右侧的操作区（如设置按钮） */
  actions?: ReactNode
  /** 面板初始宽度 */
  defaultWidth?: number
  /** 是否允许拖拽调整宽度 */
  resizable?: boolean
  /** 宽度持久化 key（localStorage），提供时宽度跨会话记忆 */
  persistKey?: string
  minWidth?: number
  maxWidth?: number
}

const DEFAULT_MIN_WIDTH = 260
const DEFAULT_MAX_WIDTH = 520

export function SlidePanel({
  title,
  children,
  isCollapsed = false,
  onToggle,
  actions,
  defaultWidth = 320,
  resizable = false,
  persistKey,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
}: SlidePanelProps) {
  const hasToggle = typeof onToggle === 'function'

  const [width, setWidth] = useState(() => {
    if (persistKey) {
      try {
        const raw = localStorage.getItem(persistKey)
        if (raw) {
          const parsed = Number(raw)
          if (Number.isFinite(parsed)) {
            return Math.min(Math.max(parsed, minWidth), maxWidth)
          }
        }
      } catch {
        // 存储不可用时使用默认宽度
      }
    }
    return defaultWidth
  })
  const [isDragging, setIsDragging] = useState(false)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(width)

  useEffect(() => {
    if (!persistKey) return
    try {
      localStorage.setItem(persistKey, String(width))
    } catch {
      // 持久化失败不影响使用
    }
  }, [width, persistKey])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      draggingRef.current = true
      startXRef.current = e.clientX
      startWidthRef.current = width
      setIsDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [width],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return
      // 面板位于右侧：向左拖拽（clientX 减小）时加宽
      const delta = startXRef.current - e.clientX
      const next = Math.min(Math.max(startWidthRef.current + delta, minWidth), maxWidth)
      setWidth(next)
    },
    [minWidth, maxWidth],
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false
    setIsDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  return (
    <div
      className={`relative flex flex-col h-full glass-panel flex-shrink-0 border-l border-[var(--color-border-separator)] transition-all duration-300 ease-out ${
        hasToggle && isCollapsed ? 'w-8' : ''
      }`}
      style={!isCollapsed ? { width, ...(isDragging ? { transition: 'none' } : {}) } : undefined}
    >
      {resizable && !isCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute left-0 top-0 h-full w-1 z-10 cursor-col-resize hover:bg-[var(--color-brand)]/30 active:bg-[var(--color-brand)]/40"
          title="拖拽调整宽度"
        />
      )}
      {hasToggle && isCollapsed ? (
        /* 折叠状态：顶部按钮用于重新展开，箭头指向左（展开方向） */
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center py-3 border-b border-[var(--color-border-separator)]">
            <button
              onClick={onToggle}
              className="w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-[var(--color-surface-container-low)] rounded-md transition-colors"
              title="展开面板"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--color-text-tertiary)]"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden transition-opacity duration-300">
          <header className="flex items-center px-4 py-4 border-b border-[var(--color-border-separator)]">
            {hasToggle && (
              <button
                className="w-6 h-6 flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--color-surface-container-low)] rounded-md transition-colors mr-2"
                onClick={onToggle}
                title="折叠面板"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[var(--color-text-tertiary)]"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {title}
            </h2>
            {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
          </header>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      )}
    </div>
  )
}
