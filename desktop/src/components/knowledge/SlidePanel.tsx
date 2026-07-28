import { ReactNode } from 'react'

interface SlidePanelProps {
  title: string
  children: ReactNode
  isCollapsed?: boolean
  onToggle?: () => void
}

export function SlidePanel({ title, children, isCollapsed = false, onToggle }: SlidePanelProps) {
  const hasToggle = typeof onToggle === 'function'

  return (
    <div className={`flex flex-col h-full glass-panel flex-shrink-0 transition-all duration-300 ease-out border-l border-[var(--color-border-separator)] ${
      hasToggle && isCollapsed ? 'w-8' : 'w-[320px]'
    }`}>
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
          </header>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      )}
    </div>
  )
}
