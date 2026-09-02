import { useMemo, useState } from 'react'
import { useProjectStore, type ProcessNode } from '../../stores/projectStore'
import { CATEGORY_META, DOC_META, LIFECYCLE_META, initials } from './projectBoardMeta'

function ProgressDonut({ value, size = 120 }: { value: number; size?: number }) {
  const r = 45
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="-rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-surface-container-high)" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
      />
    </svg>
  )
}

const PROC_STATUS: Record<ProcessNode['status'], { label: string; color: string; bg: string }> = {
  completed: { label: 'Completed', color: '#15803d', bg: '#dcfce7' },
  in_progress: { label: 'In Progress', color: '#1d4ed8', bg: '#dbeafe' },
  not_started: { label: 'Not Started', color: '#64748b', bg: '#e2e8f0' },
  blocked: { label: 'Blocked', color: '#b91c1c', bg: '#fee2e2' },
  at_risk: { label: 'At Risk', color: '#a16207', bg: '#fef9c3' },
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="material-symbols-outlined text-[18px] text-[var(--color-brand)]">{icon}</span>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">{children}</section>
}

export function ProjectBoardDetail({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId))
  const updateProject = useProjectStore((s) => s.updateProject)
  const [copied, setCopied] = useState(false)

  const taskStats = useMemo(() => {
    if (project?.taskStats) return project.taskStats
    const steps = project?.processes ?? []
    const completed = steps.filter((p) => p.status === 'completed').length
    const inProgress = steps.filter((p) => p.status === 'in_progress').length
    const notStarted = steps.filter((p) => p.status === 'not_started').length
    const planned = Math.max(1, steps.length)
    return { planned, completed, inProgress, notStarted, delayed: 0 }
  }, [project])

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">项目不存在或已被删除</p>
        <button type="button" onClick={onBack} className="mt-3 text-xs text-[var(--color-brand)] hover:underline">
          返回项目列表
        </button>
      </div>
    )
  }

  const cat = CATEGORY_META[project.category]
  const life = LIFECYCLE_META[project.state]
  const steps = [...project.processes].sort((a, b) => a.order - b.order)
  const budgetRows: { label: string; node: React.ReactNode }[] = [
    { label: 'Project ID', node: <span className="font-mono text-xs">{project.projectCode}</span> },
    {
      label: 'Project Manager',
      node: (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{project.manager?.name ?? '—'}</span>
          {project.manager && (
            <>
              <span className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                <span className="material-symbols-outlined text-[12px]">mail</span>
                {project.manager.email}
              </span>
              <span className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                <span className="material-symbols-outlined text-[12px]">call</span>
                {project.manager.phone}
              </span>
            </>
          )}
        </div>
      ),
    },
  ]
  if (project.budgetCode) budgetRows.push({ label: 'Budget Code', node: <span className="font-mono text-xs">{project.budgetCode}</span> })
  if (project.totalBudget) budgetRows.push({ label: 'Total Budget', node: <span className="text-lg font-bold text-[var(--color-text-primary)]">{project.totalBudget}</span> })
  budgetRows.push({
    label: 'Project Status',
    node: (
      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: life.bg, color: life.color }}>
        {life.label}
      </span>
    ),
  })
  budgetRows.push({
    label: 'Project Priority',
    node: (
      <span className="flex items-center gap-0.5 text-[#eab308]">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="material-symbols-outlined text-[16px]"
            style={{ fontVariationSettings: "'FILL' 1", color: (project.priority ?? 0) >= i ? '#eab308' : 'var(--color-surface-container-high)' }}
          >
            star
          </span>
        ))}
      </span>
    ),
  })

  const shareText = [
    `${project.name} (${project.projectCode})`,
    `类别：${project.category} · 状态：${life.label}`,
    `时间线：${project.timeline}`,
    `总体进度：${project.completion}%`,
    project.description,
    `负责人：${project.manager?.name ?? '—'}`,
  ]
    .filter(Boolean)
    .join('\n')

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard 不可用时静默
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      {/* 返回 + 操作 */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          返回项目列表
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors hover:brightness-105"
          style={{ backgroundColor: 'var(--color-brand)' }}
        >
          <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'share'}</span>
          {copied ? '已复制摘要' : '分享项目信息'}
        </button>
      </div>

      {/* Hero */}
      <div className="text-center mb-6">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-3" style={{ backgroundColor: life.bg, color: life.color }}>
          {life.label}
        </span>
        <h2 className="text-[clamp(1.4rem,2.6vw,1.9rem)] font-bold text-[var(--color-text-primary)]">{project.name}</h2>
        <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-[var(--color-text-tertiary)]">
          {project.startDate && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">calendar_today</span>Start Date: {project.startDate}
            </span>
          )}
          {project.expectedCompletion && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">flag</span>Expected Completion: {project.expectedCompletion}
            </span>
          )}
          {project.location && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">location_on</span>Location: {project.location}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* 左栏 2/3 */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card>
            <SectionTitle icon="description" title="Project Description" />
            <p className="text-sm text-[var(--color-text-secondary)] leading-6">{project.description}</p>
            {project.objectives && project.objectives.length > 0 && (
              <>
                <p className="text-xs font-semibold text-[var(--color-text-primary)] mt-3 mb-1">Key project objectives include:</p>
                <ul className="flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
                  {project.objectives.map((o) => (
                    <li key={o} className="flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-[14px] mt-0.5 text-[var(--color-brand)]">arrow_right_alt</span>
                      {o}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <SectionTitle icon="group" title="Project Team" />
            {project.team.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">暂无团队成员</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {project.team.map((member) => (
                  <div
                    key={member.id}
                    className="relative flex flex-col items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-3.5 text-center hover:shadow-sm transition-shadow"
                  >
                    {member.lead && (
                      <span className="absolute top-2 right-2 material-symbols-outlined text-[15px] text-[#eab308]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        star
                      </span>
                    )}
                    <span
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: member.lead ? 'var(--color-brand)' : cat.color }}
                    >
                      {initials(member.name)}
                    </span>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">{member.name}</div>
                    <div className="text-[10px] text-[var(--color-text-tertiary)]">{member.role}</div>
                    <div className="text-[10px] text-[var(--color-text-tertiary)]">{member.degree}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[var(--color-text-tertiary)]">
                      <a href={`mailto:${member.email}`} className="hover:text-[var(--color-brand)]" title={member.email}>
                        <span className="material-symbols-outlined text-[14px]">mail</span>
                      </a>
                      <a href={`tel:${member.phone}`} className="hover:text-[var(--color-brand)]" title={member.phone}>
                        <span className="material-symbols-outlined text-[14px]">call</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle icon="account_tree" title="Manufacturing Process Steps" />
            {steps.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">该项目暂无工艺步骤</p>
            ) : (
              <div className="flex flex-col gap-3">
                {steps.map((step) => {
                  const meta = PROC_STATUS[step.status]
                  const label = step.status === 'in_progress' ? `In Progress (${step.progress}%)` : meta.label
                  return (
                    <div key={step.id} className="pl-4" style={{ borderLeft: `4px solid var(--color-brand)` }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{step.name}</span>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: meta.bg, color: meta.color }}>
                          {label}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                        负责人：{step.assignee || '—'}
                        {step.startDate ? ` · Start: ${step.startDate}` : ''}
                        {step.dueDate ? ` · Expected: ${step.dueDate}` : ''}
                      </p>
                      <div className="mt-1.5 h-1.5 w-full rounded-full bg-[var(--color-surface-container)] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${step.progress}%`,
                            background: step.status === 'completed' ? '#16a34a' : 'var(--color-brand)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* 右栏 1/3 */}
        <div className="flex flex-col gap-4">
          <Card>
            <SectionTitle icon="info" title="Project Basic Information" />
            <div className="flex flex-col divide-y divide-[var(--color-border-separator)]">
              {budgetRows.map((row) => (
                <div key={row.label} className="py-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">{row.label}</div>
                  {row.node}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon="task_alt" title="Overall Project Progress" />
            <div className="flex items-center justify-center py-1">
              <div className="relative flex items-center justify-center">
                <ProgressDonut value={project.completion} />
                <span className="absolute text-2xl font-bold text-[var(--color-text-primary)]">{project.completion}%</span>
              </div>
            </div>
            <p className="text-center text-[11px] text-[var(--color-text-tertiary)] mt-1">
              {project.completion >= 100 ? 'all tasks completed' : project.state === 'on_hold' ? 'paused, waiting for decision' : 'on schedule'}
            </p>
            <div className="mt-3 flex flex-col gap-1.5 text-xs">
              {[
                { label: 'Planned Tasks', value: taskStats.planned, color: 'var(--color-text-secondary)' },
                { label: 'Completed Tasks', value: taskStats.completed, color: '#15803d' },
                { label: 'In Progress Tasks', value: taskStats.inProgress, color: '#a16207' },
                { label: 'Not Started Tasks', value: taskStats.notStarted, color: 'var(--color-text-tertiary)' },
                { label: 'Delayed Tasks', value: taskStats.delayed, color: '#b91c1c' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[var(--color-text-tertiary)]">{row.label}</span>
                  <span className="font-bold" style={{ color: row.color }}>
                    {row.value} items
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle icon="folder_open" title="Project Documents" />
            {project.docs.length === 0 ? (
              <p className="text-xs text-[var(--color-text-tertiary)]">暂无文档</p>
            ) : (
              <div className="flex flex-col gap-2">
                {project.docs.map((doc) => {
                  const meta = DOC_META[doc.kind] ?? { icon: 'description', color: 'var(--color-text-tertiary)' }
                  return (
                    <div key={doc.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-2.5 py-2 hover:border-[var(--color-border-focus)] transition-colors">
                      <span className="material-symbols-outlined text-[18px]" style={{ color: meta.color }}>
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-[var(--color-text-primary)] truncate">{doc.name}</div>
                        <div className="text-[10px] text-[var(--color-text-tertiary)]">
                          {doc.size} · {doc.date}
                        </div>
                      </div>
                      <button
                        type="button"
                        title={`下载 ${doc.name}`}
                        className="p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-brand)]"
                        onClick={() => {
                          const blob = new Blob([`文档占位：${doc.name}`], { type: 'text/plain' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = doc.name
                          a.click()
                          URL.revokeObjectURL(url)
                        }}
                      >
                        <span className="material-symbols-outlined text-[15px]">download</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* 进度微调 */}
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">手动更新完成度</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-brand)' }}>
                {project.completion}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={project.completion}
              onChange={(e) => updateProject(project.id, { completion: Number(e.target.value) })}
              className="w-full accent-[var(--color-brand)] mt-2"
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
