import { createPortal } from 'react-dom'
import { SCORING_GUIDES, type ScoreFactor } from './scoreGuides'

export type { ScoreFactor }

export type Props = {
  factor: ScoreFactor | null
  current: number
  onClose: () => void
}

export function ScoreGuideModal({ factor, current, onClose }: Props) {
  if (!factor) return null
  const guide = SCORING_GUIDES[factor]
  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-[var(--color-modal-scrim)]" />
      <div className="relative w-[min(880px,94vw)] max-h-[84vh] flex flex-col overflow-hidden rounded-[var(--radius-3xl)] dialog-panel">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border-separator)] shrink-0">
          <div className="text-[15px] font-bold text-[var(--color-brand)]">{guide.title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-container)] hover:text-[var(--color-error)]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="overflow-auto px-5 py-4">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 sticky top-0 z-[1] bg-[var(--color-surface-container)] text-[var(--color-text-secondary)] text-[11px]">分值</th>
                <th className="text-left px-3 py-2 sticky top-0 z-[1] bg-[var(--color-surface-container)] text-[var(--color-text-secondary)] text-[11px]">等级</th>
                <th className="text-left px-3 py-2 sticky top-0 z-[1] bg-[var(--color-surface-container)] text-[var(--color-text-secondary)] text-[11px]">说明</th>
              </tr>
            </thead>
            <tbody>
              {guide.rows.map((row) => {
                const isCurrent = row.value === current
                return (
                  <tr
                    key={row.value}
                    className={isCurrent ? 'outline outline-[1.5px] outline-[var(--color-brand)]' : ''}
                    style={isCurrent ? { backgroundColor: 'var(--color-brand-soft)' } : undefined}
                  >
                    <td className="px-3 py-2 border-b border-[var(--color-border-separator)] font-bold text-[var(--color-brand)]">
                      {isCurrent ? `当前 → ${row.value}` : row.value}
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--color-border-separator)] font-semibold whitespace-nowrap text-[var(--color-text-primary)]">
                      {row.level}
                    </td>
                    <td className="px-3 py-2 border-b border-[var(--color-border-separator)] text-[var(--color-text-secondary)]">{row.desc}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 border-t border-[var(--color-border-separator)] text-[11px] text-[var(--color-text-tertiary)] shrink-0">
          评分准则参考 AIAG-VDA FMEA 手册，实际分值请结合企业 FMEA 手册。
        </div>
      </div>
    </div>,
    document.body,
  )
}
