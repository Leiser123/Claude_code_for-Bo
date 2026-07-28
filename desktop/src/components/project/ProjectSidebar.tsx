import { useProjectStore, type ProjectSection } from '../../stores/projectStore'

const NAV_ITEMS: { key: ProjectSection; label: string; icon: string }[] = [
  { key: 'project', label: 'Project', icon: 'folder' },
  { key: 'expert', label: 'Ask Expert', icon: 'group' },
  { key: 'meeting', label: 'Meeting', icon: 'groups' },
  { key: 'manufacturing', label: 'Manufacturing', icon: 'precision_manufacturing' },
  { key: 'secretary', label: 'Secretary', icon: 'mail' },
]

export function ProjectSidebar() {
  const activeSection = useProjectStore((s) => s.activeSection)
  const switchSection = useProjectStore((s) => s.switchSection)

  return (
    <aside className="w-[280px] flex flex-col glass-panel border-r border-[var(--color-border-separator)]">
      <header className="flex items-center gap-2 px-4 py-4 border-b border-[var(--color-border-separator)]">
        <h1 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">导航</h1>
      </header>
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="list-none p-0 m-0">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.key
            return (
              <li key={item.key} className="my-0.5">
                <button
                  onClick={() => switchSection(item.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-sm transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--color-brand)]/12 text-[var(--color-brand)] font-medium'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t border-[var(--color-border-separator)] p-3">
        <button
          onClick={() => useProjectStore.getState().switchSection('settings')}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-sm transition-all cursor-pointer ${
            activeSection === 'settings'
              ? 'bg-[var(--color-brand)]/12 text-[var(--color-brand)] font-medium'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">settings</span>
          <span className="truncate">设置</span>
        </button>
      </div>
    </aside>
  )
}
