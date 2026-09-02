import { useEffect } from 'react'
import { useKnowledgeTabStore } from '../../stores/knowledgeTabStore'
import { useWikiStore } from '../../stores/wikiStore'
import { WikiPage } from './WikiPage'
import { KnowledgeGraph } from './KnowledgeGraph'
import { RepoManagement } from './RepoManagement'
import { ImportPage } from './ImportPage'
import { KnowledgeHome } from './KnowledgeHome'

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
    return <KnowledgeHome />
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
