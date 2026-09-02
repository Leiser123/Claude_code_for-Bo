import { useEffect, useState } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { useTabStore } from '@/stores/tabStore'
import { useGraphStore } from '@/stores/graphStore'
import { BookOpen, Share2, Upload, GitBranch, FileText, Loader2 } from 'lucide-react'

export function KnowledgeHome() {
  const { currentRepo, currentPage, loading, initialize, fetchPage } = useWikiStore()
  const openTab = useTabStore((s) => s.openTab)
  const loadGraph = useGraphStore((s) => s.loadGraph)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized) {
      setInitialized(true)
      void initialize()
    }
  }, [initialize, initialized])

  const handleOpenRepo = () => {
    openTab('__repo__', '知识库管理')
  }

  const handleOpenGraph = async () => {
    await loadGraph()
    openTab('__graph__', '知识图谱')
  }

  const handleImport = () => {
    openTab('__import__', '导入文件')
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)]/10 flex items-center justify-center">
            <BookOpen size={20} className="text-[var(--color-brand)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Knowledge</h1>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {currentRepo
                ? `Current: ${currentRepo.name}`
                : 'Wiki knowledge base manager'}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <button
            onClick={handleOpenRepo}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-container)] transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-container)] flex items-center justify-center group-hover:bg-[var(--color-brand)]/10 transition-colors">
              <GitBranch size={20} className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-brand)]" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Repositories</span>
            <span className="text-[10px] text-[var(--color-text-tertiary)] text-center">
              Open or create wiki repos
            </span>
          </button>

          <button
            onClick={handleOpenGraph}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-container)] transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-container)] flex items-center justify-center group-hover:bg-[var(--color-brand)]/10 transition-colors">
              <Share2 size={20} className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-brand)]" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Knowledge Graph</span>
            <span className="text-[10px] text-[var(--color-text-tertiary)] text-center">
              Visualize wiki connections
            </span>
          </button>

          <button
            onClick={handleImport}
            className="flex flex-col items-center gap-3 p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] hover:border-[var(--color-brand)] hover:bg-[var(--color-surface-container)] transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-container)] flex items-center justify-center group-hover:bg-[var(--color-brand)]/10 transition-colors">
              <Upload size={20} className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-brand)]" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Import Files</span>
            <span className="text-[10px] text-[var(--color-text-tertiary)] text-center">
              Import docs into wiki
            </span>
          </button>
        </div>

        {/* Recent wiki content */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-4">
            {currentRepo ? 'Wiki Pages' : 'Getting Started'}
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[var(--color-text-tertiary)]" />
            </div>
          ) : currentRepo ? (
            <div className="space-y-1">
              {currentPage ? (
                <button
                  onClick={() => fetchPage(currentPage.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[var(--color-surface-container-low)] transition-colors text-left"
                >
                  <FileText size={14} className="shrink-0 text-[var(--color-text-tertiary)]" />
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--color-text-primary)] truncate">
                      {currentPage.title}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">
                      {currentPage.path}
                    </p>
                  </div>
                </button>
              ) : (
                <p className="text-sm text-[var(--color-text-tertiary)] px-4 py-3">
                  No wiki pages loaded. Open a repository to browse content.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-8 text-center">
              <BookOpen size={32} className="mx-auto mb-3 text-[var(--color-text-tertiary)]" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                Welcome to Knowledge
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                Manage your wiki documentation and knowledge base.
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
                Start by opening a repository or creating a new one.
              </p>
              <button
                onClick={handleOpenRepo}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--color-brand)] text-[var(--color-on-primary)] hover:opacity-90 transition-opacity"
              >
                <GitBranch size={14} />
                Open Repository
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
