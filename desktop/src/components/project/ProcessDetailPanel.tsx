import { useProjectStore, type ProcessNode, type ProcessStatus } from '../../stores/projectStore'

const STATUS_OPTIONS: { value: ProcessStatus; label: string; icon: string; color: string }[] = [
  { value: 'not_started', label: '未开始', icon: 'radio_button_unchecked', color: '#9ca3af' },
  { value: 'in_progress', label: '进行中', icon: 'radio_button_checked', color: '#3b82f6' },
  { value: 'completed',   label: '已完成', icon: 'check_circle', color: '#22c55e' },
  { value: 'blocked',     label: '受阻',   icon: 'block', color: '#ef4444' },
  { value: 'at_risk',     label: '有风险', icon: 'warning', color: '#eab308' },
]

function StatusSelector({
  value,
  onChange,
}: {
  value: ProcessStatus
  onChange: (v: ProcessStatus) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_OPTIONS.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${isActive
                ? 'ring-2 ring-offset-1 ring-offset-[var(--color-surface)]'
                : 'opacity-60 hover:opacity-100 border border-[var(--color-border)]'
              }
            `}
            style={{
              backgroundColor: isActive ? opt.color + '18' : 'transparent',
              color: isActive ? opt.color : 'var(--color-text-secondary)',
              boxShadow: isActive ? `0 0 0 2px ${opt.color}` : undefined,
            }}
          >
            <span
              className="material-symbols-outlined text-[14px]"
              style={{
                fontVariationSettings: opt.value === 'completed' ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              {opt.icon}
            </span>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function ProcessDetailPanel({
  process,
  projectId,
}: {
  process: ProcessNode
  projectId: string
}) {
  const updateProcess = useProjectStore((s) => s.updateProcess)
  const setActiveProcess = useProjectStore((s) => s.setActiveProcess)

  const handleChange = (data: Partial<ProcessNode>) => {
    updateProcess(projectId, process.id, data)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-separator)] shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveProcess(null)}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          </button>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{process.name}</h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="max-w-xl space-y-6">
          {/* Status */}
          <section>
            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-2">状态</label>
            <StatusSelector
              value={process.status}
              onChange={(v) => handleChange({ status: v })}
            />
          </section>

          {/* Progress bar */}
          <section>
            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-2">
              完成度
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={process.progress}
                onChange={(e) => handleChange({ progress: Number(e.target.value) })}
                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  accentColor: process.status === 'completed' ? '#22c55e' : '#3b82f6',
                }}
              />
              <span className="text-xs font-medium text-[var(--color-text-secondary)] w-8 text-right">
                {process.progress}%
              </span>
            </div>
          </section>

          {/* Assignee */}
          <section>
            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1.5">
              负责人
            </label>
            <input
              type="text"
              value={process.assignee}
              onChange={(e) => handleChange({ assignee: e.target.value })}
              placeholder="输入负责人姓名"
              className="w-full h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)] transition-colors"
            />
          </section>

          {/* Due date */}
          <section>
            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1.5">
              计划完成日期
            </label>
            <input
              type="date"
              value={process.dueDate}
              onChange={(e) => handleChange({ dueDate: e.target.value })}
              className="w-full h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] transition-colors"
            />
          </section>

          {/* Notes */}
          <section>
            <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1.5">
              备注 / 风险说明
            </label>
            <textarea
              value={process.notes}
              onChange={(e) => handleChange({ notes: e.target.value })}
              placeholder="输入备注..."
              rows={4}
              className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)] transition-colors"
              style={{ minHeight: '80px' }}
            />
          </section>
        </div>
      </div>
    </div>
  )
}