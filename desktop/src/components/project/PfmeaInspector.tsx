import { useState } from 'react'
import {
  useProcessFlowStore,
  rpn,
  riskLevelName,
  riskTone,
  FM_LIBRARY,
  FM_LABELS,
  buildFmeaCsv,
  type FlowNode,
  type FmListKey,
} from './processFlowStore'
import { ScoreGuideModal, type ScoreFactor } from './ScoreGuideModal'

const TONE_TEXT: Record<string, string> = {
  error: 'text-[var(--color-error)]',
  warning: 'text-[#CA8A04]',
  success: 'text-[#087E4F]',
  muted: 'text-[var(--color-text-tertiary)]',
}
const TONE_BG: Record<string, string> = {
  error: 'bg-[var(--color-error)]/10',
  warning: 'bg-[#CA8A04]/12',
  success: 'bg-[#087E4F]/10',
  muted: 'bg-[var(--color-surface-container)]',
}

export function PfmeaInspector({ node }: { node: FlowNode }) {
  const {
    addPfmea,
    updatePfmea,
    removePfmea,
    addPfmeaItem,
    updatePfmeaItem,
    removePfmeaItem,
  } = useProcessFlowStore()
  const locked = useProcessFlowStore((s) => s.modeLockState.pfmea)
  const [showLib, setShowLib] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [guide, setGuide] = useState<{ factor: ScoreFactor; current: number } | null>(null)

  const download = (content: string, name: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          PFMEA · {node.stepNo || node.name}
        </p>
        {locked && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#CA8A04]/12 text-[#CA8A04]">已锁定</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            addPfmea(node.id, { mode: '新失效模式', severity: 0, occurrence: 0, detection: 0, effects: [], causes: [], controls: [], actions: [] })
          }
          disabled={locked}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium text-[var(--color-brand)] bg-[var(--color-brand)]/10 hover:bg-[var(--color-brand)]/15 disabled:opacity-40 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          新增失效模式
        </button>
        <button
          onClick={() => setShowLib((v) => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container)] transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">library_books</span>
          失效模式库
        </button>
      </div>

      <button
        onClick={() => download(buildFmeaCsv(node.pfmeas ? [node] : []), `PFMEA_${node.stepNo || node.id}.csv`)}
        disabled={node.pfmeas.length === 0}
        className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-focus)] disabled:opacity-40 transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">download</span>
        导出当前工序 PFMEA CSV
      </button>

      {/* 失效模式库 */}
      {showLib && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-2 max-h-[220px] overflow-y-auto">
          {FM_LIBRARY.map((cat) => (
            <div key={cat.cat} className="mb-2">
              <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] px-1 mb-1">{cat.cat}</p>
              <div className="flex flex-col gap-1">
                {cat.items.map((it) => (
                  <button
                    key={it.mode}
                    disabled={locked}
                    onClick={() =>
                      addPfmea(node.id, {
                        mode: it.mode,
                        severity: it.s,
                        occurrence: it.o,
                        detection: it.d,
                        effects: [],
                        causes: [],
                        controls: [],
                        actions: [],
                      })
                    }
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors"
                  >
                    <span>{it.mode}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)] shrink-0 ml-2">
                      S{it.s} O{it.o} D{it.d}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 失效模式列表 */}
      {node.pfmeas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] px-3 py-6 text-center">
          <p className="text-xs text-[var(--color-text-tertiary)]">
            该工序暂无失效模式。点击"新增失效模式"或从失效模式库添加。
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {node.pfmeas.map((fm) => {
            const r = rpn(fm)
            const tone = riskTone(r)
            const isCollapsed = collapsed[fm.id] ?? false
            return (
              <div key={fm.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [fm.id]: !isCollapsed }))}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-[var(--color-surface-container-low)] transition-colors"
                >
                  <span className={`material-symbols-outlined text-[16px] text-[var(--color-text-tertiary)] transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>
                    chevron_right
                  </span>
                  <input
                    value={fm.mode}
                    disabled={locked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updatePfmea(node.id, fm.id, { mode: e.target.value })}
                    placeholder="潜在失效模式..."
                    className={`flex-1 min-w-0 bg-transparent text-xs font-semibold outline-none ${fm.mode ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)] italic'}`}
                  />
                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}>
                    RPN {r} · {riskLevelName(r)}
                  </span>
                  <span
                    role="button"
                    aria-label="删除该失效模式"
                    className="shrink-0 p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/5"
                    onClick={(e) => {
                      e.stopPropagation()
                      removePfmea(node.id, fm.id)
                    }}
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="px-2.5 pb-2.5 flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <ScoreInput label="S" value={fm.severity} locked={locked} onChange={(v) => updatePfmea(node.id, fm.id, { severity: v })} onGuide={() => setGuide({ factor: 'severity', current: fm.severity })} />
                      <ScoreInput label="O" value={fm.occurrence} locked={locked} onChange={(v) => updatePfmea(node.id, fm.id, { occurrence: v })} onGuide={() => setGuide({ factor: 'occurrence', current: fm.occurrence })} />
                      <ScoreInput label="D" value={fm.detection} locked={locked} onChange={(v) => updatePfmea(node.id, fm.id, { detection: v })} onGuide={() => setGuide({ factor: 'detection', current: fm.detection })} />
                    </div>
                    <div className="flex flex-col gap-1">
                      {(['effects', 'causes', 'controls', 'actions'] as FmListKey[]).map((k) => (
                        <FmListRows
                          key={k}
                          label={FM_LABELS[k].label}
                          items={fm[k]}
                          locked={locked}
                          onAdd={() => addPfmeaItem(node.id, fm.id, k)}
                          onChange={(itemId, text) => updatePfmeaItem(node.id, fm.id, k, itemId, text)}
                          onRemove={(itemId) => removePfmeaItem(node.id, fm.id, k, itemId)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ScoreGuideModal factor={guide?.factor ?? null} current={guide?.current ?? 0} onClose={() => setGuide(null)} />
    </div>
  )
}

function FmListRows({
  label,
  items,
  locked,
  onAdd,
  onChange,
  onRemove,
}: {
  label: string
  items: { id: string; text: string }[]
  locked: boolean
  onAdd: () => void
  onChange: (id: string, text: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)]">{label}</span>
        <button
          type="button"
          disabled={locked}
          onClick={onAdd}
          className="text-[10px] text-[var(--color-brand)] hover:underline disabled:opacity-40"
        >
          + 添加
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-1">
            <input
              value={it.text}
              disabled={locked}
              onChange={(e) => onChange(it.id, e.target.value)}
              placeholder={`${label}描述...`}
              className="flex-1 min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => onRemove(it.id)}
              disabled={locked}
              className="shrink-0 p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/5 disabled:opacity-40"
              title={`删除该${label}`}
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScoreInput({
  label,
  value,
  locked,
  onChange,
  onGuide,
}: {
  label: string
  value: number
  locked: boolean
  onChange: (v: number) => void
  onGuide: () => void
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5">
        <span className="text-[11px] font-semibold text-[var(--color-text-tertiary)]">{label}</span>
        <button
          type="button"
          onClick={onGuide}
          title={`查看 ${label} 打分标准`}
          className="inline-flex items-center justify-center w-[13px] h-[13px] rounded-full bg-[var(--color-brand)] text-white text-[8px] font-bold hover:scale-110 transition-transform"
        >
          ?
        </button>
      </span>
      <input
        type="number"
        min={0}
        max={10}
        disabled={locked}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
        className="w-[42px] text-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-1 text-xs font-semibold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] disabled:opacity-40"
      />
    </label>
  )
}
