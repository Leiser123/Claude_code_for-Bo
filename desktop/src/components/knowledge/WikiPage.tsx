import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'
import { useWikiStore } from '../../stores/wikiStore'
import { useTranslateStore } from '../../stores/translateStore'
import { useKnowledgeTabStore } from '../../stores/knowledgeTabStore'
import { FeedbackDialog } from './FeedbackDialog'
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
  themeVariables: {
    background: '#131313',
    primaryColor: '#353534',
    primaryTextColor: '#E5E2E1',
    primaryBorderColor: '#FFB59F',
    secondaryColor: '#2A2929',
    secondaryTextColor: '#E5E2E1',
    secondaryBorderColor: '#CDBDFF',
    tertiaryColor: '#252120',
    tertiaryTextColor: '#E5E2E1',
    tertiaryBorderColor: '#00DAF3',
    lineColor: '#8D7F7A',
    textColor: '#E5E2E1',
    mainBkg: '#353534',
    nodeBorder: '#FFB59F',
    clusterBkg: '#1C1B1B',
    clusterBorder: '#2A2929',
    titleColor: '#E5E2E1',
    edgeLabelBackground: '#1C1B1B',
    actorBkg: '#353534',
    actorBorder: '#FFB59F',
    actorTextColor: '#E5E2E1',
    actorLineColor: '#8D7F7A',
    signalColor: '#E5E2E1',
    signalTextColor: '#E5E2E1',
    labelBoxBkgColor: '#353534',
    labelBoxBorderColor: '#FFB59F',
    labelTextColor: '#E5E2E1',
    loopTextColor: '#E5E2E1',
    noteBkgColor: '#F7C46C',
    noteTextColor: '#1B1C1A',
    noteBorderColor: '#F7C46C',
    activationBkgColor: '#2A2929',
    activationBorderColor: '#FFB59F',
    stateBkg: '#353534',
    stateBorder: '#FFB59F',
    specialStateColor: '#FFB59F',
  },
})

export function WikiPage() {
  const { pageContent, isLoading, currentPath, loadPage, wikiRootPath } = useWikiStore()
  const { isTranslated, translating: isTranslating, translatedHTML, translateError, resetTranslate } = useTranslateStore()
  const articleRef = useRef<HTMLDivElement>(null)

  const handleArticleClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
    if (!target) return

    const href = target.getAttribute('href') ?? ''

    // Skip external URLs, anchors, and special protocols
    if (href.includes('://') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('#')) {
      return
    }

    e.preventDefault()

    // 打开对应的 wiki 标签页并加载页面，保持标签与内容同步
    const page = href
    if (page) {
      const title = page.split('/').pop()?.replace('.md', '') || page
      useKnowledgeTabStore.getState().openTab(`wiki-${page}`, title, 'wiki', page)
      void loadPage(page)
      history.pushState({ page }, '', `/?page=${encodeURIComponent(page)}`)
    }
  }

  useEffect(() => {
    resetTranslate()
  }, [currentPath, resetTranslate])

  useEffect(() => {
    const renderMermaid = async () => {
      if (!articleRef.current) return
      const mermaidNodes = articleRef.current.querySelectorAll('pre.mermaid-block code.language-mermaid')
      for (let i = 0; i < mermaidNodes.length; i++) {
        const code = mermaidNodes[i] as HTMLElement
        const pre = code.parentElement as HTMLElement
        const source = code.textContent ?? ''
        const id = `mermaid-${Date.now()}-${i}`
        try {
          const { svg } = await mermaid.render(id, source)
          const container = document.createElement('div')
          container.className = 'mermaid-block'
          container.innerHTML = svg
          const srcLine = pre.getAttribute('data-source-line')
          if (srcLine) container.setAttribute('data-source-line', srcLine)
          pre.replaceWith(container)
        } catch (err) {
          console.error('mermaid render failed', err)
        }
      }
    }

    void renderMermaid()
  }, [pageContent])

  useEffect(() => {
    const handlePopstate = (e: PopStateEvent) => {
      const p = (e.state && e.state.page) || new URL(window.location.href).searchParams.get('page') || 'wiki/index.md'
      void loadPage(p)
    }

    window.addEventListener('popstate', handlePopstate)
    return () => window.removeEventListener('popstate', handlePopstate)
  }, [loadPage])

  if (isLoading) {
    return (
      <main className="flex-1 overflow-y-auto rounded-lg glass-panel">
        <article className="max-w-[76ch] mx-auto py-16 px-16 animate-fade-up">
          <p className="text-[var(--color-text-tertiary)] text-base text-center py-15">Loading</p>
        </article>
      </main>
    )
  }

  if (!wikiRootPath) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-8">
          <div className="mb-6 text-6xl">📚</div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">欢迎使用 LLM Wiki</h2>
          <p className="text-[var(--color-text-secondary)] mb-8">
            还没有选择知识库。请点击左侧的「知识库管理」按钮，打开或创建一个知识库。
          </p>
          <button
            onClick={() => {
              const { openTab } = useKnowledgeTabStore.getState()
              openTab('__repo__', '知识库管理', 'repo')
            }}
            className="px-6 py-3 bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-primary-container)] transition-colors font-medium"
          >
            打开知识库管理
          </button>
        </div>
      </main>
    )
  }

  if (!pageContent) {
    return (
      <main className="flex-1 overflow-y-auto rounded-lg glass-panel">
        <article className="max-w-[76ch] mx-auto py-16 px-16 animate-fade-up">
          <p className="text-[var(--color-text-tertiary)] text-base">Error loading page.</p>
        </article>
      </main>
    )
  }

  const contentType = (pageContent as any).contentType || 'markdown'
  const fileUrl = (pageContent as any).fileUrl || ''

  const renderContent = () => {
    if (contentType === 'image') {
      return (
        <main className="flex-1 overflow-y-auto rounded-lg glass-panel flex items-center justify-center p-8">
          <div className="max-w-full max-h-full">
            <img 
              src={fileUrl} 
              alt={pageContent.title || pageContent.fileName} 
              className="max-w-full max-h-[calc(100vh-200px)] object-contain rounded-lg shadow-lg"
            />
          </div>
        </main>
      )
    }

    if (contentType === 'pdf') {
      return (
        <main className="flex-1 overflow-y-auto rounded-lg glass-panel">
          <div className="w-full h-full min-h-[calc(100vh-150px)] flex items-center justify-center p-8">
            <object 
              data={fileUrl} 
              type="application/pdf" 
              className="w-full h-[calc(100vh-200px)] min-h-[600px]"
            >
              <div className="text-center">
                <p className="text-[var(--color-text-secondary)] mb-4">无法在浏览器中显示 PDF，请下载查看</p>
                <a 
                  href={fileUrl} 
                  download={pageContent.fileName}
                  className="inline-block px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-primary-container)] transition-colors"
                >
                  下载 PDF
                </a>
              </div>
            </object>
          </div>
        </main>
      )
    }

    if (contentType === 'pptx') {
      return (
        <main className="flex-1 overflow-y-auto rounded-lg glass-panel">
          <div className="w-full h-full min-h-[calc(100vh-150px)] flex items-center justify-center p-8">
            <div className="text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                {pageContent.title}
              </h3>
              <p className="text-[var(--color-text-secondary)] mb-6">
                PPTX 文件无法直接在浏览器中预览
              </p>
              <a 
                href={fileUrl} 
                download={pageContent.fileName}
                className="inline-block px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-primary-container)] transition-colors"
              >
                下载 PPTX
              </a>
            </div>
          </div>
        </main>
      )
    }

    const contentHtml = isTranslated && translatedHTML ? translatedHTML : pageContent.html
    return (
      <main className="flex-1 overflow-y-auto rounded-lg glass-panel">
        {isTranslating && (
          <div className="flex items-center justify-center gap-2 py-3 border-b border-[var(--color-border-separator)] bg-[var(--color-surface-container-low)]">
            <div className="w-3 h-3 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--color-text-secondary)]">正在翻译...</span>
          </div>
        )}
        {translateError && (
          <div className="flex items-center gap-2 py-2 px-4 border-b border-[var(--color-border-separator)] bg-[var(--color-error)]/10">
            <span className="text-xs text-[var(--color-error)]">{translateError}</span>
          </div>
        )}
        <article
          ref={articleRef}
          onClick={handleArticleClick}
          className={`max-w-[76ch] mx-auto py-12 px-16 leading-[1.72] text-base text-[var(--color-text-primary)] animate-fade-up ${isTranslated ? '' : ''}`}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
        <FeedbackDialog />
      </main>
    )
  }

  return renderContent()
}
