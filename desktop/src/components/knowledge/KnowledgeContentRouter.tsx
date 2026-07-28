import { useEffect } from 'react'
import { useKnowledgeTabStore } from '../../stores/knowledgeTabStore'
import { useWikiStore } from '../../stores/wikiStore'
import { WikiPage } from './WikiPage'
import { KnowledgeGraph } from './KnowledgeGraph'
import { RepoManagement } from './RepoManagement'
import { ImportPage } from './ImportPage'

export function KnowledgeContentRouter() {
  const { tabs, activeTabId } = useKnowledgeTabStore()
  const { loadPage, currentPath } = useWikiStore()
  const activeTab = tabs.find((t) => t.sessionId === activeTabId)
  const activeTabType = activeTab?.type

  useEffect(() => {
    if (activeTab?.type === 'wiki' && activeTab.path && activeTab.path !== currentPath) {
      loadPage(activeTab.path)
    }
  }, [activeTabId, activeTab?.path, loadPage, currentPath])

  if (!activeTabType) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-tertiary)]">
        <p>选择一个页面开始</p>
      </div>
    )
  }

  if (activeTabType === 'repo') {
    return <RepoManagement />
  }

  if (activeTabType === 'graph') {
    return <KnowledgeGraph />
  }

  if (activeTabType === 'import') {
    return <ImportPage />
  }

  return <WikiPage />
}
