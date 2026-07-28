import { useEffect } from 'react'
import { useWikiStore } from '../../stores/wikiStore'
import { useKnowledgeTabStore } from '../../stores/knowledgeTabStore'
import { usePanelStore } from '../../stores/panelStore'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { KnowledgeContentRouter } from './KnowledgeContentRouter'
import { AuditPanel } from './AuditPanel'
import { ChatPanel } from './ChatPanel'

let knowledgeTabsInitialized = false

export function KnowledgeApp() {
  const { initialize, repos } = useWikiStore()
  const { openTab, tabs, activeTabId } = useKnowledgeTabStore()
  const { isAuditOpen, isOutlineOpen, isAuditCollapsed, isChatCollapsed, toggleAuditPanel, toggleChatPanel } = usePanelStore()

  const activeTab = tabs.find((t) => t.sessionId === activeTabId)
  const isWikiPage = activeTab?.type === 'wiki'

  useEffect(() => {
    if (repos.length === 0) {
      void initialize()
    }
  }, [initialize, repos.length])

  useEffect(() => {
    if (!knowledgeTabsInitialized) {
      knowledgeTabsInitialized = true
      if (tabs.length === 0) {
        openTab('wiki-index', 'Index', 'wiki', 'index.md')
      }
    }
  }, [openTab])

  return (
    <div className="h-full flex flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <div className="flex-1 flex overflow-hidden">
          <KnowledgeContentRouter />
        </div>
      </div>
      <div className="flex flex-row h-full flex-shrink-0">
        {isOutlineOpen && (
          <ChatPanel isCollapsed={isChatCollapsed} onToggle={toggleChatPanel} />
        )}
        {isWikiPage && isAuditOpen && (
          <AuditPanel isCollapsed={isAuditCollapsed} onToggle={toggleAuditPanel} />
        )}
      </div>
    </div>
  )
}
