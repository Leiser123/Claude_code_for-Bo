import { useUIStore, type AppMode } from '../../stores/uiStore'
import { useTranslation } from '../../i18n'

type ToolbarButtonProps = {
  label: string
  icon: string
  isActive: boolean
  onClick: () => void
}

function ToolbarButton({ label, icon, isActive, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
        isActive
          ? 'bg-[var(--color-brand)] text-[var(--color-btn-primary-fg)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
      }`}
      style={{
        transform: 'scale(0.9)',
        textShadow: isActive
          ? '0 1px 1px rgba(0,0,0,0.15)'
          : 'none',
        boxShadow: isActive
          ? 'inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.1)'
          : 'none',
      }}
      aria-label={label}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '16px', transform: 'scale(0.9)' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function SidebarToggleButton() {
  const t = useTranslation()
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
      style={{ transform: 'scale(0.9)' }}
      aria-label={sidebarOpen ? t('sidebar.collapse') : t('sidebar.expand')}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '16px', transform: 'scale(0.9)' }}>
        {sidebarOpen ? 'chevron_left' : 'chevron_right'}
      </span>
    </button>
  )
}

export function GlobalToolbar() {
  const activeAppMode = useUIStore((s) => s.activeAppMode)
  const setActiveAppMode = useUIStore((s) => s.setActiveAppMode)

  const buttons: { mode: AppMode; label: string; icon: string }[] = [
    { mode: 'chat', label: 'Chat', icon: 'chat' },
    { mode: 'knowledge', label: 'Knowledge', icon: 'book' },
    { mode: 'project', label: 'Project', icon: 'folder' },
  ]

  return (
    <header
      data-testid="global-toolbar"
      className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-container)] px-4 py-2"
      data-desktop-drag-region
    >
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
          style={{
            boxShadow: '0 1px 3px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
        >
          {buttons.map(({ mode, label, icon }) => (
            <ToolbarButton
              key={mode}
              label={label}
              icon={icon}
              isActive={activeAppMode === mode}
              onClick={() => setActiveAppMode(mode)}
            />
          ))}
        </div>
        <SidebarToggleButton />
      </div>
      <div className="flex items-center gap-2" />
    </header>
  )
}
