import { ProjectSidebar } from './ProjectSidebar'
import { ProjectContentRouter } from './ProjectContentRouter'

export function ProjectApp() {
  return (
    <div className="h-full flex flex-row">
      <ProjectSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ProjectContentRouter />
      </div>
    </div>
  )
}
