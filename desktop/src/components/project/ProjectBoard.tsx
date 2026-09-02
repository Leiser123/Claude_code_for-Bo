import { useMemo, useState } from 'react'
import { useProjectStore, type ProjectCategory, type ProjectData, type ProjectLifecycle } from '../../stores/projectStore'
import { ProjectEditModal } from './ProjectEditModal'
import { CATEGORIES, CATEGORY_META, LIFECYCLE_META, initials } from './projectBoardMeta'

const ALL_STATUSES: { value: ProjectLifecycle | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'in_development', label: 'In Development' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
]

function ProjectCard({ project, onOpen }: { project: ProjectData; onOpen: () => void }) {
  const cat = CATEGORY_META[project.category]
  const state = LIFECYCLE_META[project.state]
  const specRows: { label: string; value: string }[] = [
    { label: 'Project ID', value: project.projectCode },
    { label: 'Timeline', value: project.timeline },
    { label: project.specLabel, value: project.specValue },
    { label: 'Voltage', value: project.voltage },
  ]
  return (
    <div
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer transition-all hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5"
    >
      {/* 顶部渐变横幅 + 徽章 */}
      <div className="relative h-16 shrink-0" style={{ background: `linear-gradient(120deg, ${cat.gradient[0]} 0%, ${cat.gradient[1]} 100%)` }}>
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white/95" style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}>
          {project.category}
        </span>
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: state.bg, color: state.color }}>
          {state.label}
        </span>
        <span className="absolute bottom-2 left-3 text-[15px] font-bold text-white drop-shadow">{project.name}</span>
      </div>

      <div className="flex flex-1 flex-col p-3.5 gap-2.5">
        <p className="text-xs text-[var(--color-text-secondary)] leading-5 line-clamp-2 min-h-[40px]">{project.description}</p>

        {/* 完成度 */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-[var(--color-text-tertiary)]">Completion Status</span>
            <span className="font-bold" style={{ color: project.state === 'completed' ? '#15803d' : project.state === 'on_hold' ? '#b91c1c' : cat.color }}>
              {project.completion}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-container)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${project.completion}%`,
                background: project.state === 'completed' ? '#16a34a' : project.state === 'on_hold' ? '#dc2626' : cat.gradient[0],
              }}
            />
          </div>
        </div>

        {/* 规格 2x2 */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {specRows.map((row) => (
            <div key={row.label}>
              <div className="text-[10px] text-[var(--color-text-tertiary)]">{row.label}</div>
              <div className="font-medium text-[var(--color-text-primary)] truncate">{row.value || '—'}</div>
            </div>
          ))}
        </div>

        {project.keyFeatures.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide">Key Features</div>
            <ul className="flex flex-col gap-0.5">
              {project.keyFeatures.slice(0, 3).map((f) => (
                <li key={f} className="flex items-start gap-1 text-[11px] text-[var(--color-text-secondary)]">
                  <span className="material-symbols-outlined text-[12px] mt-px" style={{ color: cat.color, fontVariationSettings: "'FILL' 1" }}>
                    check
                  </span>
                  <span className="truncate">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-auto pt-1 flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {(project.team.length > 0 ? project.team : []).slice(0, 4).map((member) => (
              <span
                key={member.id}
                title={`${member.name} · ${member.role}`}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-[var(--color-surface)]"
                style={{ backgroundColor: cat.color }}
              >
                {initials(member.name)}
              </span>
            ))}
            {project.team.length === 0 && <span className="text-[10px] text-[var(--color-text-tertiary)]">暂无团队</span>}
          </div>
          <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: cat.color }}>
            查看详情
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </span>
        </div>
      </div>
    </div>
  )
}

export function ProjectBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const projects = useProjectStore((s) => s.projects)
  const [category, setCategory] = useState<ProjectCategory | 'all'>('all')
  const [status, setStatus] = useState<ProjectLifecycle | 'all'>('all')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const stats = useMemo(() => {
    const total = projects.length
    const inDev = projects.filter((p) => p.state === 'in_development').length
    const completed = projects.filter((p) => p.state === 'completed').length
    const onHold = projects.filter((p) => p.state === 'on_hold').length
    return { total, inDev, completed, onHold }
  }, [projects])

  const filtered = projects.filter((p) => {
    if (category !== 'all' && p.category !== category) return false
    if (status !== 'all' && p.state !== status) return false
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      const hay = [p.name, p.projectCode, p.description, p.category].join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const statCards = [
    { label: 'Total Projects', value: stats.total, sub: '全部项目', color: 'var(--color-text-primary)' },
    { label: 'In Progress', value: stats.inDev, sub: '进行中项目', color: '#1d4ed8' },
    { label: 'Completed', value: stats.completed, sub: '已完成项目', color: '#15803d' },
    { label: 'On Hold', value: stats.onHold, sub: '挂起项目', color: '#b91c1c' },
  ]

  const selectCls =
    'h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* 页头 */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[clamp(1.3rem,2.4vw,1.7rem)] font-bold text-[var(--color-text-primary)]">
                Automotive Small Motor Development
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1 leading-5">
                车窗升降（WS）、尾门（TS）、座椅调节（PA）、空调（CA）、全景天窗双电机（2WP）等平台项目看板。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex shrink-0 items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white transition-colors hover:brightness-105"
              style={{ backgroundColor: 'var(--color-brand)' }}
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              新建项目
            </button>
          </div>

          {/* 类别胶囊 */}
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
            {(['all', ...CATEGORIES] as (ProjectCategory | 'all')[]).map((c) => {
              const active = category === c
              const meta = c === 'all' ? null : CATEGORY_META[c]
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    active ? 'text-white' : 'text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-focus)]'
                  }`}
                  style={active && meta ? { backgroundColor: meta.color } : active ? { backgroundColor: 'var(--color-brand)' } : undefined}
                >
                  {c === 'all' ? 'All Projects' : c}
                </button>
              )
            })}
          </div>
        </div>

        {/* 统计卡 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">{s.label}</div>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>
                  {s.value}
                </span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] pb-0.5">{s.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 搜索筛选 */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 mb-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[var(--color-text-tertiary)]">search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, part numbers or descriptions..."
                className="w-full h-9 pl-8 pr-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] text-xs text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
              />
            </div>
            <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as ProjectLifecycle | 'all')}>
              {ALL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setStatus('all')
                setCategory('all')
              }}
              className="flex items-center gap-1 px-3 h-9 rounded-lg text-xs font-medium text-white transition-colors hover:brightness-105"
              style={{ backgroundColor: 'var(--color-brand)' }}
            >
              <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
              重置筛选
            </button>
          </div>
        </div>

        {/* 卡片网格 */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-[var(--color-text-tertiary)] opacity-40">folder_off</span>
            <p className="text-sm text-[var(--color-text-secondary)] mt-3">没有匹配的项目</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">调整搜索词或筛选条件后再试</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} onOpen={() => onOpen(project.id)} />
            ))}
          </div>
        )}
      </div>
      <ProjectEditModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
