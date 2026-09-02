import { useProjectStore, type ProjectSection } from '../../stores/projectStore'

const SECTION_CONFIG: Record<ProjectSection, { label: string; icon: string }> = {
  project: { label: 'Project', icon: 'folder' },
  expert: { label: 'Ask Expert', icon: 'group' },
  meeting: { label: 'Meeting', icon: 'groups' },
  processDevelopment: { label: 'Process Development', icon: 'construction' },
  manufacturing: { label: 'Manufacturing', icon: 'precision_manufacturing' },
  secretary: { label: 'Secretary', icon: 'mail' },
  settings: { label: '设置', icon: 'settings' },
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

export function ProjectTopbar() {
  const activeSection = useProjectStore((s) => s.activeSection)
  const experts = useProjectStore((s) => s.experts)
  const selectedExpertId = useProjectStore((s) => s.selectedExpertId)
  const showExpertSelector = useProjectStore((s) => s.showExpertSelector)
  const setShowExpertSelector = useProjectStore((s) => s.setShowExpertSelector)

  const config = activeSection ? SECTION_CONFIG[activeSection] : null
  const selectedExpert = experts.find((e) => e.id === selectedExpertId)

  return (
    <header className="h-[56px] flex items-center justify-between px-5 glass-panel">
      {/* Left: section label */}
      <div className="flex items-center gap-2">
        {config && (
          <>
            <span className="material-symbols-outlined text-[18px] text-[var(--color-text-secondary)]">
              {config.icon}
            </span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {config.label}
            </span>
          </>
        )}
      </div>

      {/* Right: expert tag + ask expert button */}
      <div className="flex items-center gap-2">
        {selectedExpert && activeSection === 'expert' && !showExpertSelector && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{
              backgroundColor: (selectedExpert.color && AGENT_COLORS[selectedExpert.color]
                ? AGENT_COLORS[selectedExpert.color]
                : 'var(--color-brand)') + '12',
              color: selectedExpert.color && AGENT_COLORS[selectedExpert.color]
                ? AGENT_COLORS[selectedExpert.color]
                : 'var(--color-brand)',
            }}
          >
            <span>{selectedExpert.avatar}</span>
            <span>{selectedExpert.name}</span>
          </div>
        )}

        {activeSection === 'expert' && !showExpertSelector && (
          <button
            onClick={() => setShowExpertSelector(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
              bg-[var(--color-surface-container)] hover:bg-[var(--color-surface-hover)]
              border border-[var(--color-border)] transition-all"
          >
            <span className="material-symbols-outlined text-[14px]">group</span>
            Ask Expert
          </button>
        )}
      </div>
    </header>
  )
}
