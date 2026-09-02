import { useState } from 'react'
import { useProjectStore, type ProjectSection } from '../../stores/projectStore'
import { ProjectTopbar } from './ProjectTopbar'
import { ProjectSettings } from './ProjectSettings'
import { ExpertSelector } from './ExpertSelector'
import { ExpertChat } from './ExpertChat'
import { MeetingPanel } from './MeetingPanel'
import { ProjectBoard } from './ProjectBoard'
import { ProjectBoardDetail } from './ProjectBoardDetail'
import { ProcessDevelopmentPage } from './ProcessDevelopmentPage'

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

// 项目看板：列表 ↔ 详情 两态切换（对应参考页 Project List 与 Project Information Sharing）
function ProjectBoardView() {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)
  if (openProjectId) {
    return <ProjectBoardDetail projectId={openProjectId} onBack={() => setOpenProjectId(null)} />
  }
  return <ProjectBoard onOpen={(id) => setOpenProjectId(id)} />
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
      return <ProjectBoardView />
    case 'expert':
      return showExpertSelector ? <ExpertSelector /> : <ExpertChat />
    case 'meeting':
      return <MeetingPanel />
    case 'processDevelopment':
      return <ProcessDevelopmentPage />
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
