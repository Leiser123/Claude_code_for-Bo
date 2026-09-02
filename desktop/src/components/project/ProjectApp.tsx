import { useEffect } from 'react'
import { ProjectSidebar } from './ProjectSidebar'
import { ProjectContentRouter } from './ProjectContentRouter'
import { useProjectStore } from '../../stores/projectStore'

export function ProjectApp() {
  // 挂载时从 ~/.claude/cc-haha/expert-settings/ 恢复专家/项目经理/会议模板配置
  useEffect(() => {
    void useProjectStore.getState().loadFromClaude()
  }, [])

  return (
    <div className="h-full flex flex-row">
      <ProjectSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ProjectContentRouter />
      </div>
    </div>
  )
}
