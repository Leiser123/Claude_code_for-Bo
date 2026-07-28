import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslateStore } from '../../stores/translateStore'
import { useKnowledgeTabStore, type KnowledgeTab } from '../../stores/knowledgeTabStore'
import { KnowledgeTabBar } from './KnowledgeTabBar'
import { useWikiStore } from '../../stores/wikiStore'
import { usePanelStore } from '../../stores/panelStore'

export function Topbar() {
  const { currentPath } = useWikiStore()
  const { toLang, isTranslated, translating: isTranslating, setToLang, toggleTranslate, translatePage, cancelTranslate } = useTranslateStore()
  const { openTab, closeTab, tabs } = useKnowledgeTabStore()
  const { isAuditOpen, toggleAudit } = usePanelStore()

  const [contextMenu, setContextMenu] = useState<{ tab: KnowledgeTab; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  const handleTranslate = () => {
    if (isTranslating) {
      cancelTranslate()
    } else if (isTranslated) {
      toggleTranslate()
    } else {
      void translatePage(currentPath)
    }
  }

  const handleGraph = () => {
    const graphTab = tabs.find((t) => t.type === 'graph')
    if (graphTab) {
      closeTab(graphTab.sessionId)
    } else {
      openTab('__graph__', '知识图谱', 'graph')
    }
  }

  const handleTabContextMenu = (e: React.MouseEvent, tab: KnowledgeTab) => {
    e.preventDefault()
    setContextMenu({ tab, x: e.clientX, y: e.clientY })
  }

  const handleCloseTab = (sessionId: string) => {
    setContextMenu(null)
    closeTab(sessionId)
  }

  const handleCloseOthers = (sessionId: string) => {
    setContextMenu(null)
    const otherTabs = tabs.filter((t) => t.sessionId !== sessionId)
    otherTabs.forEach((t) => closeTab(t.sessionId))
  }

  const handleCloseLeft = (sessionId: string) => {
    setContextMenu(null)
    const idx = tabs.findIndex((t) => t.sessionId === sessionId)
    const leftTabs = tabs.slice(0, idx)
    leftTabs.forEach((t) => closeTab(t.sessionId))
  }

  const handleCloseRight = (sessionId: string) => {
    setContextMenu(null)
    const idx = tabs.findIndex((t) => t.sessionId === sessionId)
    const rightTabs = tabs.slice(idx + 1)
    rightTabs.forEach((t) => closeTab(t.sessionId))
  }

  const handleCloseAll = () => {
    setContextMenu(null)
    tabs.forEach((t) => closeTab(t.sessionId))
  }

  const hasGraphTab = tabs.some((t) => t.type === 'graph')

  return (
    <header className="h-[56px] flex items-center px-5 glass-panel">
      <div className="flex items-center gap-2">
        <button
          onClick={handleGraph}
          className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-all ${
            hasGraphTab
              ? 'bg-[var(--color-surface-container)] border border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'bg-[var(--color-surface-container)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-brand)]'
          }`}
          title="Knowledge graph (G)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="2" />
            <circle cx="19" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <line x1="12" y1="5" x2="19" y2="12" />
            <line x1="19" y1="12" x2="12" y2="19" />
            <line x1="12" y1="19" x2="5" y2="12" />
            <line x1="5" y1="12" x2="12" y2="5" />
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

      </div>

      <div className="w-px h-8 bg-[var(--color-border-separator)] mx-3" />

      <div className="flex-1 flex items-stretch overflow-x-hidden">
        <KnowledgeTabBar onTabContextMenu={handleTabContextMenu} />
      </div>

      <div className="w-px h-8 bg-[var(--color-border-separator)] mx-3" />

      <div className="flex items-center gap-2">
        <span className="text-[var(--color-text-secondary)] text-xs font-medium">To</span>
        <select
          className="bg-[var(--color-surface-glass)] border border-[var(--color-border-separator)] rounded-sm text-xs px-1.5 py-1 text-[var(--color-text-primary)] cursor-pointer outline-none transition-colors hover:border-[var(--color-outline)]"
          value={toLang}
          onChange={(e) => setToLang(e.target.value)}
        >
          <option value="zh">中文</option>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="fr">Français</option>
          <option value="es">Español</option>
          <option value="pt">Português</option>
          <option value="ru">Русский</option>
          <option value="ar">العربية</option>
          <option value="hi">हिन्दी</option>
          <option value="th">ไทย</option>
          <option value="vi">Tiếng Việt</option>
          <option value="id">Indonesia</option>
          <option value="ms">Melayu</option>
          <option value="nl">Nederlands</option>
          <option value="pl">Polski</option>
          <option value="tr">Türkçe</option>
          <option value="it">Italiano</option>
          <option value="sv">Svenska</option>
          <option value="da">Dansk</option>
          <option value="no">Norsk</option>
          <option value="fi">Suomi</option>
          <option value="cs">Čeština</option>
          <option value="hu">Magyar</option>
          <option value="el">Ελληνικά</option>
          <option value="he">עברית</option>
          <option value="bn">বাংলা</option>
          <option value="ur">اردو</option>
          <option value="ro">Română</option>
          <option value="sk">Slovenčina</option>
          <option value="uk">Українська</option>
          <option value="bg">Български</option>
        </select>

        <button
          onClick={handleTranslate}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            isTranslating
              ? 'bg-[var(--color-error)]/20 border border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)]/30'
              : isTranslated
              ? 'bg-[var(--color-brand)]/20 border border-[var(--color-brand)] text-[var(--color-brand)] hover:bg-[var(--color-brand)]/30'
              : 'bg-[var(--color-surface-container)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-container-high)] hover:border-[var(--color-brand)]'
          }`}
          title={isTranslating ? '点击停止翻译' : 'Translate'}
        >
          <span className="font-bold">T</span>
          {isTranslating ? '停止' : isTranslated ? '还原' : '翻译'}
        </button>

        <button
          onClick={toggleAudit}
          className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-all ${
            isAuditOpen
              ? 'bg-[var(--color-surface-container)] border border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'bg-[var(--color-surface-container)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-brand)]'
          }`}
          title="Toggle audit panel"
        >
          <span className="font-bold text-xs">A</span>
        </button>
      </div>

      {contextMenu && createPortal(
        <div
          className="fixed z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y, boxShadow: 'var(--shadow-dropdown)' }}
        >
          <button
            onClick={() => handleCloseTab(contextMenu.tab.sessionId)}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            关闭
          </button>
          <button
            onClick={() => handleCloseOthers(contextMenu.tab.sessionId)}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            关闭其他
          </button>
          <button
            onClick={() => handleCloseLeft(contextMenu.tab.sessionId)}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            关闭左侧
          </button>
          <button
            onClick={() => handleCloseRight(contextMenu.tab.sessionId)}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            关闭右侧
          </button>
          <div className="my-1 border-t border-[var(--color-border)]" />
          <button
            onClick={handleCloseAll}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            关闭所有
          </button>
        </div>,
        document.body
      )}
    </header>
  )
}
