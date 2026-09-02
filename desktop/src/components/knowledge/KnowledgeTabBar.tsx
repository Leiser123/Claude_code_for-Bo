import { useKnowledgeTabStore, type KnowledgeTab } from '../../stores/knowledgeTabStore'

interface KnowledgeTabBarProps {
  onTabContextMenu?: (e: React.MouseEvent, tab: KnowledgeTab) => void
}

export function KnowledgeTabBar({ onTabContextMenu }: KnowledgeTabBarProps) {
  const { tabs, activeTabId, setActiveTab, closeTab } = useKnowledgeTabStore()

  if (tabs.length === 0) return null

  return (
    <div className="flex items-stretch overflow-x-hidden">
      {tabs.map((tab) => (
        <div
          key={tab.sessionId}
          onClick={() => setActiveTab(tab.sessionId)}
          onContextMenu={(e) => onTabContextMenu?.(e, tab)}
          className={`
            flex min-h-11 flex-shrink-0 items-center gap-1.5 px-3
            cursor-pointer transition-[background-color,box-shadow] duration-150 ease-out
            ${
              activeTabId === tab.sessionId
                ? 'bg-[var(--color-surface)] shadow-[inset_0_-2px_0_var(--color-brand)]'
                : 'bg-transparent hover:bg-[var(--color-surface-hover)]'
            }
          `}
        >
          <span className={`flex-1 truncate text-xs ${activeTabId === tab.sessionId ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)]'}`}>
            {tab.title}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeTab(tab.sessionId) }}
            className="flex-shrink-0 -mr-0.5 inline-flex h-4 w-4 items-center justify-center bg-transparent p-0 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-container-low)] rounded transition-colors"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
