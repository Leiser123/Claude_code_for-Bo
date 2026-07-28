import { type ProcessNode, type ProcessStatus } from '../../stores/projectStore'

const STATUS_CONFIG: Record<ProcessStatus, { color: string; bg: string; label: string; icon: string }> = {
  completed:   { color: '#22c55e', bg: '#22c55e18', label: '已完成', icon: 'check_circle' },
  in_progress: { color: '#3b82f6', bg: '#3b82f618', label: '进行中', icon: 'radio_button_checked' },
  not_started: { color: '#9ca3af', bg: '#9ca3af10', label: '未开始', icon: 'radio_button_unchecked' },
  blocked:     { color: '#ef4444', bg: '#ef444418', label: '受阻',   icon: 'block' },
  at_risk:     { color: '#eab308', bg: '#eab30818', label: '有风险', icon: 'warning' },
}

export function ProcessFlowChart({
  processes,
  activeProcessId,
  onSelect,
}: {
  processes: ProcessNode[]
  activeProcessId: string | null
  onSelect: (id: string) => void
}) {
  if (processes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-tertiary)]">
        该项目暂无工艺
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0 px-4 py-3 overflow-x-auto">
      {processes.map((p, idx) => {
        const cfg = STATUS_CONFIG[p.status]
        const isActive = p.id === activeProcessId
        const isLast = idx === processes.length - 1

        return (
          <div key={p.id} className="flex items-center gap-0 shrink-0">
            {/* Node */}
            <button
              onClick={() => onSelect(p.id)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer
                ${isActive
                  ? 'bg-[var(--color-brand)]/10 ring-2 ring-[var(--color-brand)]/40 shadow-sm'
                  : 'hover:bg-[var(--color-surface-container-low)] hover:ring-1 hover:ring-[var(--color-border)]'
                }
              `}
            >
              {/* Status icon */}
              <span
                className="material-symbols-outlined text-[18px]"
                style={{
                  color: cfg.color,
                  fontVariationSettings: p.status === 'completed' ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {cfg.icon}
              </span>

              {/* Label */}
              <div className="flex flex-col items-start">
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isActive
                      ? 'text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  {p.name}
                </span>
                {p.assignee && (
                  <span className="text-[10px] text-[var(--color-text-tertiary)] whitespace-nowrap">
                    {p.assignee}
                  </span>
                )}
              </div>

              {/* Progress badge */}
              {p.status === 'in_progress' && (
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{ color: cfg.color, backgroundColor: cfg.bg }}
                >
                  {p.progress}%
                </span>
              )}
            </button>

            {/* Arrow connector */}
            {!isLast && (
              <div className="flex items-center mx-1">
                <svg width="28" height="2" viewBox="0 0 28 2" fill="none">
                  <line
                    x1="0" y1="1" x2="26" y2="1"
                    stroke={p.status === 'completed' ? '#22c55e' : 'var(--color-border)'}
                    strokeWidth="2"
                    strokeDasharray={p.status === 'completed' ? 'none' : '4 3'}
                  />
                  <polygon
                    points="24,0 28,1 24,2"
                    fill={p.status === 'completed' ? '#22c55e' : 'var(--color-border)'}
                  />
                </svg>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}