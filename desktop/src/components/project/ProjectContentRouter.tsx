import { useProjectStore, type ProjectSection } from '../../stores/projectStore'
import { ProjectTopbar } from './ProjectTopbar'
import { ProjectSettings } from './ProjectSettings'
import { ExpertSelector } from './ExpertSelector'
import { ExpertChat } from './ExpertChat'
import { MeetingPanel } from './MeetingPanel'
import { ProjectList } from './ProjectList'
import { ProcessFlowChart } from './ProcessFlowChart'
import { ProcessDetailPanel } from './ProcessDetailPanel'

export function ProjectContentRouter() {
  const activeSection = useProjectStore((s) => s.activeSection)
  const showExpertSelector = useProjectStore((s) => s.showExpertSelector)

  if (!activeSection) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <ProjectTopbar />
        <div className="flex-1 flex items-center justify-center text-[var(--color-text-tertiary)]">
          <p>选择一个页面开始</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ProjectTopbar />
      <div className="flex-1 flex overflow-hidden">
        <SectionContent section={activeSection} showExpertSelector={showExpertSelector} />
      </div>
    </div>
  )
}

function ProjectContentView() {
  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const activeProcessId = useProjectStore((s) => s.activeProcessId)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const setActiveProcess = useProjectStore((s) => s.setActiveProcess)

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const activeProcess = activeProject?.processes.find((p) => p.id === activeProcessId)

  // Auto-select first project if none selected
  if (!activeProjectId && projects.length > 0) {
    const first = projects[0]
    if (first) setActiveProject(first.id)
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: Project list */}
      <ProjectList />

      {/* Right: Flow chart + detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Flow chart at top */}
        <div className="shrink-0 border-b border-[var(--color-border-separator)]">
          {activeProject && (
            <ProcessFlowChart
              processes={activeProject.processes}
              activeProcessId={activeProcessId}
              onSelect={(id) => setActiveProcess(id)}
            />
          )}
        </div>

        {/* Detail or empty state */}
        <div className="flex-1 flex overflow-hidden">
          {activeProcess && activeProject ? (
            <ProcessDetailPanel process={activeProcess} projectId={activeProject.id} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <span className="material-symbols-outlined text-5xl text-[var(--color-text-tertiary)] mb-3">touch_app</span>
              <p className="text-sm text-[var(--color-text-secondary)]">选择一个工艺查看详情</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                点击左侧项目列表中的工艺节点，或上方流程图的节点
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionContent({
  section,
  showExpertSelector,
}: {
  section: ProjectSection
  showExpertSelector: boolean
}) {
  switch (section) {
    case 'project':
      return <ProjectContentView />
    case 'expert':
      return showExpertSelector ? <ExpertSelector /> : <ExpertChat />
    case 'meeting':
      return <MeetingPanel />
    case 'manufacturing':
      return (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <span className="material-symbols-outlined text-5xl text-[var(--color-text-tertiary)]">precision_manufacturing</span>
          <h2 className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">Manufacturing</h2>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">制造管理（待实现）</p>
        </div>
      )
    case 'secretary':
      return (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <span className="material-symbols-outlined text-5xl text-[var(--color-text-tertiary)]">mail</span>
          <h2 className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">Secretary</h2>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">秘书服务（待实现）</p>
        </div>
      )
    case 'settings':
      return <ProjectSettings />
  }
}