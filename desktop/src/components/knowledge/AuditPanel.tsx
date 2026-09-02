import { useWikiStore } from '../../stores/wikiStore'
import { auditApi } from '../../api/wikiClient'
import { SlidePanel } from './SlidePanel'

interface AuditPanelProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function AuditPanel({ isCollapsed, onToggle }: AuditPanelProps) {
  const { audits, loadAudits, currentPath } = useWikiStore()

  const handleResolve = async (id: string) => {
    const note = window.prompt('Resolution note (optional):', '') ?? ''
    try {
      await auditApi.resolveAudit(id, note)
      await loadAudits(currentPath)
    } catch {
      alert('Failed to resolve.')
    }
  }

  const getSeverityPillColor = (severity: string) => {
    switch (severity) {
      case 'info': return 'bg-[var(--color-info-container)] text-[var(--color-info)] border-[var(--color-info)]/30'
      case 'suggest': return 'bg-[var(--color-secondary-container)]/15 text-[var(--color-secondary)] border-[var(--color-secondary)]/30'
      case 'warn': return 'bg-[var(--color-warning-container)] text-[var(--color-warning)] border-[var(--color-warning)]/30'
      case 'error': return 'bg-[var(--color-error-container)]/15 text-[var(--color-error)] border-[var(--color-error)]/30'
      default: return 'bg-[var(--color-text-tertiary)]/15 text-[var(--color-text-tertiary)] border-[var(--color-text-tertiary)]/30'
    }
  }

  return (
    <SlidePanel title="Open audits" isCollapsed={isCollapsed} onToggle={onToggle}>
      <div className="p-3">
        {audits.length === 0 ? (
          <p className="text-[var(--color-text-tertiary)] text-xs" style={{ padding: '4px 6px' }}>No open audits for this page.</p>
        ) : (
          <div className="space-y-2.5">
            {audits.map((audit) => {
              const body = audit.body
                .replace(/^#\s*Comment\s*/i, '')
                .split(/^#\s*Resolution/im)[0]!
                .replace(/<!--[\s\S]*?-->/g, '')
                .trim()
              const when = new Date(audit.created).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div
                  key={audit.id}
                  className={`bg-[var(--color-surface-container-low)]/35 border border-[var(--color-border-separator)] rounded-md p-3 text-[12.5px] transition-all hover:bg-[var(--color-surface-container-low)]/55 hover:border-[var(--color-border)] hover:-translate-y-0.5`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5 ml-2">
                    <span className={`text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.75 rounded-full border ${getSeverityPillColor(audit.severity)}`}>
                      {audit.severity}
                    </span>
                    <span className="font-semibold text-[var(--color-text-primary)] text-sm">{audit.author}</span>
                  </div>
                  <div className="text-[var(--color-text-secondary)] whitespace-pre-wrap break-words leading-relaxed ml-2">{body}</div>
                  <div className="text-[var(--color-text-tertiary)] text-xs mt-1.5 ml-2 font-mono">{audit.id} · {when}</div>
                  <div className="flex gap-1.5 mt-2 ml-2">
                    <button
                      onClick={() => handleResolve(audit.id)}
                      className="text-xs px-2.5 py-1 rounded-[6px] bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border)] cursor-pointer transition-all hover:text-[var(--color-success)] hover:border-[var(--color-success)] hover:bg-[var(--color-success-container)]"
                    >
                      mark resolved
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SlidePanel>
  )
}
