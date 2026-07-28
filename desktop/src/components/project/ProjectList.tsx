import { useState } from 'react'
import { useProjectStore, type ProjectData, type ProcessStatus } from '../../stores/projectStore'

const STATUS_DOT: Record<ProcessStatus, string> = {
  completed:   '#22c55e',
  in_progress: '#3b82f6',
  not_started: '#9ca3af',
  blocked:     '#ef4444',
  at_risk:     '#eab308',
}

function ProjectItem({ project }: { project: ProjectData }) {
  const [expanded, setExpanded] = useState(true)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const activeProcessId = useProjectStore((s) => s.activeProcessId)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const setActiveProcess = useProjectStore((s) => s.setActiveProcess)
  const isSelected = activeProjectId === project.id

  const total = project.processes.length
  const done = project.processes.filter((p) => p.status === 'completed').length

  return (
    <div>
      {/* Project header */}
      <button
        onClick={() => {
          setActiveProject(project.id)
          setExpanded((v) => !v)
        }}
        className={`
          w-full flex items-center gap-2 px-3 py-2.5 rounded-[8px] text-sm transition-all cursor-pointer
          ${isSelected
            ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)] font-medium'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-primary)]'
          }
        `}
      >
        <span className="material-symbols-outlined text-[16px] transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          chevron_right
        </span>
        <span className="material-symbols-outlined text-[18px]">folder</span>
        <span className="truncate flex-1 text-left">{project.name}</span>
        <span className="text-[10px] text-[var(--color-text-tertiary)] whitespace-nowrap">{done}/{total}</span>
      </button>

      {/* Process list */}
      {expanded && project.processes.length > 0 && (
        <div className="ml-3 mt-0.5 space-y-0.5">
          {project.processes
            .sort((a, b) => a.order - b.order)
            .map((proc) => {
              const isProcActive = activeProjectId === project.id && activeProcessId === proc.id
              return (
                <button
                  key={proc.id}
                  onClick={() => {
                    setActiveProject(project.id)
                    setActiveProcess(proc.id)
                  }}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2 rounded-[6px] text-xs transition-all cursor-pointer
                    ${isProcActive
                      ? 'bg-[var(--color-brand)]/8 text-[var(--color-brand)] font-medium'
                      : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-secondary)]'
                    }
                  `}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_DOT[proc.status] }}
                  />
                  <span className="truncate">{proc.name}</span>
                </button>
              )
            })}
        </div>
      )}

      {/* Empty state */}
      {expanded && project.processes.length === 0 && (
        <p className="ml-3 px-3 py-2 text-[10px] text-[var(--color-text-tertiary)]">暂无工艺</p>
      )}
    </div>
  )
}

export function ProjectList() {
  const projects = useProjectStore((s) => s.projects)

  return (
    <aside className="w-[260px] shrink-0 flex flex-col border-r border-[var(--color-border-separator)] overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-separator)] shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          项目列表
        </h3>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">{projects.length} 个项目</span>
      </header>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {projects.map((p) => (
          <ProjectItem key={p.id} project={p} />
        ))}
        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <span className="material-symbols-outlined text-3xl text-[var(--color-text-tertiary)] mb-2">folder_off</span>
            <p className="text-xs text-[var(--color-text-tertiary)]">暂无项目</p>
          </div>
        )}
      </nav>
    </aside>
  )
}