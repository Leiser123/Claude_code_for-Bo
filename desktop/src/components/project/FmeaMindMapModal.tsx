import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  useProcessFlowStore,
  type FmListKey,
  FM_LABELS,
  NODE_META,
  rpn,
  rpnLevel,
  riskLevelName,
  buildFmeaCsv,
} from './processFlowStore'
import { ScoreGuideModal, type ScoreFactor } from './ScoreGuideModal'

// 画布卡片几何（世界坐标）
const CENTER_W = 340
const CENTER_H = 210
const FM_W = 300
const FM_H = 150
const CHILD_W = 252
const CHILD_H = 96
const V_GAP = 26
const GAP_CF = 120 // 中心 → 失效模式
const GAP_FC = 120 // 失效模式 → 子节点

const FM_KEYS: FmListKey[] = ['effects', 'causes', 'controls', 'actions']
const FM_STYLE: Record<FmListKey, { leftColor: string }> = {
  effects: { leftColor: '#BA1A1A' },
  causes: { leftColor: '#CA8A04' },
  controls: { leftColor: '#2D628F' },
  actions: { leftColor: '#087E4F' },
}

type Pos = { x: number; y: number }
type CardKey = string

type Props = {
  nodeId: string | null
  onClose: (saved: boolean) => void
}

export function FmeaMindMapModal({ nodeId, onClose }: Props) {
  const nodes = useProcessFlowStore((s) => s.nodes)
  const node = nodes.find((n) => n.id === nodeId)
  const {
    addPfmea,
    updatePfmea,
    removePfmea,
    updatePfmeaItem,
    removePfmeaItem,
    addPfmeaItem,
  } = useProcessFlowStore()

  const viewRef = useRef<{ panX: number; panY: number; zoom: number }>({ panX: 0, panY: 0, zoom: 1 })
  const [, force] = useReducerState()
  const [manual, setManual] = useState<Record<CardKey, Pos>>({})
  const [guide, setGuide] = useState<{ factor: ScoreFactor; current: number } | null>(null)
  const [menuFm, setMenuFm] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const panningRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)
  const dragRef = useRef<{ key: CardKey; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)

  const fms = node?.pfmeas ?? []
  const pfmeaLocked = useProcessFlowStore((s) => s.modeLockState.pfmea)

  // —— 布局：由数据计算每张卡片的初始位置（未手动拖拽过的卡片使用计算位置）——
  const layout = useMemo(() => {
    const pos: Record<CardKey, Pos> = { c: { x: 0, y: -CENTER_H / 2 } }
    const kidHeights: Record<string, number> = {}
    for (const fm of fms) {
      let n = 0
      for (const k of FM_KEYS) n += (fm[k]?.length ?? 0)
      kidHeights[fm.id] = n > 0 ? n * (CHILD_H + V_GAP) - V_GAP : 0
    }
    const slot = (fmId: string) => Math.max(kidHeights[fmId] ?? 0, FM_H)
    const totalH = fms.reduce((s, f) => s + slot(f.id), 0) + Math.max(0, fms.length - 1) * V_GAP
    const totalSlot = Math.max(totalH, CENTER_H)
    let cursor = -totalSlot / 2
    const fmLeft = CENTER_W + GAP_CF
    const childLeft = fmLeft + FM_W + GAP_FC
    for (const fm of fms) {
      const s = slot(fm.id)
      const fmY = cursor + (s - FM_H) / 2
      const kids = FM_KEYS.flatMap((k) => (fm[k] ?? []).map((it) => ({ k, it })))
      const kidsStart = cursor + (s - (kidHeights[fm.id] || 0)) / 2
      pos[`fm:${fm.id}`] = { x: fmLeft, y: fmY }
      kids.forEach(({ k, it }, i) => {
        const y = kidsStart + i * (CHILD_H + V_GAP)
        pos[`ch:${fm.id}:${k}:${it.id}`] = { x: childLeft, y }
      })
      cursor += s + V_GAP
    }
    return pos
  }, [fms])

  const posOf = useCallback((key: CardKey): Pos => manual[key] ?? layout[key] ?? { x: 0, y: 0 }, [manual, layout])

  // —— 视图变换 ——
  const applyView = () => {
    const el = viewportRef.current
    if (!el) return
    const stage = el.querySelector<HTMLElement>('[data-mm-stage]')
    if (stage) {
      const v = viewRef.current
      stage.style.transform = `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})`
    }
    // 背景点阵固定贴屏，不随缩放/平移变化疏密
    const grid = el.querySelector<HTMLElement>('[data-mm-grid]')
    if (grid) {
      grid.style.backgroundSize = '24px 24px'
      grid.style.backgroundPosition = '0 0'
    }
  }
  useEffect(applyView)

  const fitView = useCallback(() => {
    const keys = ['c', ...fms.map((f) => `fm:${f.id}`)]
    for (const f of fms) for (const k of FM_KEYS) for (const it of f[k] ?? []) keys.push(`ch:${f.id}:${k}:${it.id}`)
    const pts = keys.map((k) => posOf(k))
    if (pts.length === 0) return
    const wOf = (k: string) => (k === 'c' ? CENTER_W : k.startsWith('fm:') ? FM_W : CHILD_W)
    const hOf = (k: string) => (k === 'c' ? CENTER_H : k.startsWith('fm:') ? FM_H : CHILD_H)
    const minX = Math.min(...pts.map((p) => p.x)) - 90
    const minY = Math.min(...pts.map((p) => p.y)) - 90
    const maxX = Math.max(...keys.map((k, i) => pts[i]!.x + wOf(k))) + 90
    const maxY = Math.max(...keys.map((k, i) => pts[i]!.y + hOf(k))) + 90
    const vp = viewportRef.current
    if (!vp) return
    const cw = vp.clientWidth
    const ch = vp.clientHeight
    const w = maxX - minX
    const h = maxY - minY
    const z = Math.max(0.15, Math.min(1.2, Math.min((cw - 160) / Math.max(1, w), (ch - 160) / Math.max(1, h))))
    viewRef.current = { zoom: z, panX: 60 - minX * z, panY: 60 - minY * z }
    force()
  }, [fms, posOf])

  useEffect(() => {
    if (nodeId) {
      requestAnimationFrame(() => fitView())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  const zoomBy = (factor: number) => {
    const v = viewRef.current
    const nz = Math.max(0.15, Math.min(3, v.zoom * factor))
    const ratio = nz / v.zoom
    const vp = viewportRef.current
    if (!vp) return
    const mx = vp.clientWidth / 2
    const my = vp.clientHeight / 2
    viewRef.current = { zoom: nz, panX: mx - (mx - v.panX) * ratio, panY: my - (my - v.panY) * ratio }
    force()
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const v = viewRef.current
    const vp = viewportRef.current!
    const rect = vp.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const nz = Math.max(0.15, Math.min(3, v.zoom * factor))
    const ratio = nz / v.zoom
    viewRef.current = { zoom: nz, panX: mx - (mx - v.panX) * ratio, panY: my - (my - v.panY) * ratio }
    force()
  }

  // —— 画布平移 / 卡片拖拽 ——
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const t = e.target as HTMLElement
    if (t.closest('[data-mm-card]') || t.closest('button') || t.closest('input') || t.closest('textarea')) return
    panningRef.current = { sx: e.clientX, sy: e.clientY, px: viewRef.current.panX, py: viewRef.current.panY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const pan = panningRef.current
    if (pan) {
      viewRef.current = { ...viewRef.current, panX: pan.px + (e.clientX - pan.sx), panY: pan.py + (e.clientY - pan.sy) }
      force()
    }
    const drag = dragRef.current
    if (drag) {
      const v = viewRef.current
      const dx = (e.clientX - drag.sx) / v.zoom
      const dy = (e.clientY - drag.sy) / v.zoom
      setManual((m) => ({ ...m, [drag.key]: { x: drag.ox + dx, y: drag.oy + dy } }))
    }
  }
  const endPointer = () => {
    panningRef.current = null
    dragRef.current = null
  }

  const cardPointerDown = (e: React.PointerEvent, key: CardKey) => {
    const t = e.target as HTMLElement
    if (t.closest('input') || t.closest('textarea') || t.closest('button')) return
    e.stopPropagation()
    dragRef.current = { key, sx: e.clientX, sy: e.clientY, ox: posOf(key).x, oy: posOf(key).y, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const v = viewRef.current

  // 曲线数据
  const curves = useMemo(() => {
    const list: { d: string; cls: string; key: string }[] = []
    const c = posOf('c')
    for (const fm of fms) {
      const p = posOf(`fm:${fm.id}`)
      if (!p) continue
      const x1 = c.x + CENTER_W
      const y1 = c.y + CENTER_H / 2
      const x2 = p.x
      const y2 = p.y + FM_H / 2
      const dx = Math.max(50, Math.abs(x2 - x1) * 0.5)
      list.push({ d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`, cls: 'center', key: `cf:${fm.id}` })
      for (const k of FM_KEYS) {
        for (const it of fm[k] ?? []) {
          const q = posOf(`ch:${fm.id}:${k}:${it.id}`)
          if (!q) continue
          const x3 = p.x + FM_W
          const y3 = p.y + FM_H / 2
          const x4 = q.x
          const y4 = q.y + CHILD_H / 2
          const ddx = Math.max(40, Math.abs(x4 - x3) * 0.5)
          list.push({ d: `M ${x3} ${y3} C ${x3 + ddx} ${y3}, ${x4 - ddx} ${y4}, ${x4} ${y4}`, cls: 'sub', key: `fc:${fm.id}:${k}:${it.id}` })
        }
      }
    }
    return list
  }, [fms, posOf])

  if (!node) return null
  if (nodeId === null) return null

  const download = (content: string, name: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const meta = NODE_META[node.type]

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-dialog)] bg-[var(--color-modal-scrim)] backdrop-blur-[2px] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 h-14 bg-[var(--color-surface)] border-b border-[var(--color-border-separator)] shrink-0">
        <span className="material-symbols-outlined text-[20px] text-[var(--color-brand)]">account_tree</span>
        <span className="text-[15px] font-semibold text-[var(--color-text-primary)]">FMEA 思维导图分析</span>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--color-brand)]/10 text-[var(--color-brand)]">IATF 16949</span>
        <div className="mx-1 h-5 w-px bg-[var(--color-border-separator)]" />
        <ToolbarBtn icon="zoom_in" label="放大" onClick={() => zoomBy(1.25)} />
        <span className="text-[11px] text-[var(--color-text-tertiary)] tabular-nums min-w-[40px] text-center">{Math.round(v.zoom * 100)}%</span>
        <ToolbarBtn icon="zoom_out" label="缩小" onClick={() => zoomBy(0.8)} />
        <ToolbarBtn icon="fit_screen" label="适应视图" onClick={fitView} />
        <ToolbarBtn
          icon="auto_awesome"
          label="自动布局"
          onClick={() => {
            setManual({})
            force()
            requestAnimationFrame(fitView)
          }}
        />
        <ToolbarBtn
          icon="center_focus_strong"
          label="重置视图"
          onClick={() => {
            viewRef.current = { panX: 80, panY: 40, zoom: 1 }
            force()
          }}
        />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            if (!node) return
            addPfmea(node.id, { mode: '', severity: 0, occurrence: 0, detection: 0, effects: [], causes: [], controls: [], actions: [] })
          }}
          disabled={pfmeaLocked}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-brand)] bg-[var(--color-brand)]/10 hover:bg-[var(--color-brand)]/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          添加失效模式
        </button>
        <button
          type="button"
          onClick={() => download(buildFmeaCsv(nodes), 'PFMEA_export.csv')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-focus)] transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">download</span>
          导出 CSV
        </button>
        <button
          type="button"
          onClick={() => onClose(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">save</span>
          保存并关闭
        </button>
        <button
          type="button"
          onClick={() => onClose(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-container)] transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
          取消
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={viewportRef}
        className="flex-1 relative overflow-hidden bg-[var(--color-surface-container-low)] cursor-grab active:cursor-grabbing"
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={handleWheel}
      >
        <div data-mm-grid className="pf-mm-grid" />
        <div data-mm-stage className="pf-mm-stage absolute top-0 left-0" style={{ transform: `translate(${v.panX}px, ${v.panY}px) scale(${v.zoom})`, transformOrigin: '0 0' }}>
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            style={{ overflow: 'visible' }}
            width={2400}
            height={2400}
            x={-1200}
            y={-1200}
            viewBox="-1200 -1200 2400 2400"
          >
            {curves.map((cu) => (
              <path key={cu.key} d={cu.d} className={`pf-mm-curve ${cu.cls}`} stroke={cu.cls === 'center' ? 'var(--color-outline)' : 'var(--color-brand)'} />
            ))}
          </svg>

          {/* 中心工艺卡 */}
          <div
            data-mm-card
            onPointerDown={(e) => cardPointerDown(e, 'c')}
            className="pf-mm-card cursor-grab active:cursor-grabbing select-none"
            style={{ left: posOf('c').x, top: posOf('c').y, width: CENTER_W, minHeight: CENTER_H }}
          >
            <div className="w-full h-full rounded-2xl p-4 flex flex-col text-white shadow-lg"
              style={{ background: 'linear-gradient(160deg, var(--color-brand) 0%, var(--color-brand-hover) 100%)' }}
            >
              <div className="text-[10px] tracking-wider uppercase opacity-90 mb-2">工艺信息 · Process Info</div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold bg-white/15">{meta.symbol}</span>
                <span className="text-[15px] font-bold">{node.stepNo}</span>
              </div>
              <div className="text-[15px] font-semibold leading-snug">{node.name}</div>
              <div className="text-[11px] opacity-85 mt-0.5">{meta.label}{node.equipment ? ` · ${node.equipment}` : ''}</div>
              {node.productChars.length > 0 && (
                <div className="text-[11px] leading-5 mt-2"><b className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] mr-1">PC</b>{node.productChars.join(' / ')}</div>
              )}
              {node.processParams.length > 0 && (
                <div className="text-[11px] leading-5 mt-1"><b className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] mr-1">PP</b>{node.processParams.join(' / ')}</div>
              )}
              <div className="mt-auto pt-2 border-t border-white/25 text-[10px] opacity-75 leading-5">
                思维导图向右发散构建 PFMEA · 双击画布任意处关闭
              </div>
            </div>
          </div>

          {/* 失效模式卡 + 子节点 */}
          {fms.length === 0 ? (
            <div className="absolute select-none" style={{ left: CENTER_W + GAP_CF - 60, top: 120, width: 380 }}>
              <div className="text-center text-[var(--color-text-tertiary)] text-[13px] leading-7">
                暂无失效模式。
                <br />
                点击右上角 <b className="text-[var(--color-brand)]">＋ 添加失效模式</b>，
                <br />
                或从左侧"失效模式库"选择常用失效模式。
              </div>
            </div>
          ) : (
            fms.map((fm) => {
              const r = rpn(fm)
              const level = rpnLevel(r)
              const p = posOf(`fm:${fm.id}`)
              const tone =
                level === 'high' ? { bg: '#FFDAD6', color: '#BA1A1A' } :
                level === 'mid' ? { bg: '#FEF9C3', color: '#CA8A04' } :
                level === 'low' ? { bg: '#E8F5E2', color: '#087E4F' } :
                { bg: 'var(--color-surface-container)', color: 'var(--color-text-tertiary)' }
              return (
                <FmCard
                  key={fm.id}
                  fmId={fm.id}
                  readOnly={pfmeaLocked}
                  mode={fm.mode}
                  severity={fm.severity}
                  occurrence={fm.occurrence}
                  detection={fm.detection}
                  rpn={r}
                  tone={tone}
                  pos={p}
                  fmW={FM_W}
                  onMode={(val) => updatePfmea(node.id, fm.id, { mode: val })}
                  onScore={(k, val) => updatePfmea(node.id, fm.id, { [k]: val })}
                  onDelete={() => removePfmea(node.id, fm.id)}
                  onOpenGuide={(factor, current) => setGuide({ factor, current })}
                  onAddMenu={() => setMenuFm(menuFm === fm.id ? null : fm.id)}
                  onPointerDownCard={(e) => cardPointerDown(e, `fm:${fm.id}`)}
                />
              )
            })
          )}

          {/* 子节点列 */}
          {fms.map((fm) =>
            FM_KEYS.map((k) =>
              (fm[k] ?? []).map((it) => {
                const q = posOf(`ch:${fm.id}:${k}:${it.id}`)
                return (
                  <div
                    key={`ch:${fm.id}:${k}:${it.id}`}
                    data-mm-card
                    onPointerDown={(e) => cardPointerDown(e, `ch:${fm.id}:${k}:${it.id}`)}
                    className="pf-mm-card cursor-grab active:cursor-grabbing select-none"
                    style={{ left: q.x, top: q.y, width: CHILD_W }}
                  >
                    <div
                      className="w-full rounded-xl border-[1.5px] border-[var(--color-border-separator)] bg-[var(--color-surface)] shadow-sm p-2 flex flex-col"
                      style={{ borderLeft: `4px solid ${FM_STYLE[k].leftColor}` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: FM_STYLE[k].leftColor }}>
                          {FM_LABELS[k].label} · {FM_LABELS[k].en}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePfmeaItem(node.id, fm.id, k, it.id)}
                          disabled={pfmeaLocked}
                          title="删除该节点"
                          className="w-5 h-5 flex items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-error)] disabled:opacity-30"
                        >
                          <span className="material-symbols-outlined text-[13px]">close</span>
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={it.text}
                        disabled={pfmeaLocked}
                        onChange={(e) => updatePfmeaItem(node.id, fm.id, k, it.id, e.target.value)}
                        placeholder={`${FM_LABELS[k].label}描述...`}
                        className="w-full bg-transparent text-xs leading-5 text-[var(--color-text-primary)] outline-none resize-none placeholder:text-[var(--color-text-tertiary)] disabled:cursor-default"
                      />
                    </div>
                  </div>
                )
              }),
            ),
          )}

          {/* ＋ 添加失效模式（中心卡右侧） */}
          {!pfmeaLocked && (
            <GhostAdd
              pos={posOf('c')}
              w={CENTER_W}
              onAdd={() => addPfmea(node.id, { mode: '', severity: 0, occurrence: 0, detection: 0, effects: [], causes: [], controls: [], actions: [] })}
              title="添加失效模式"
            />
          )}
          {/* ＋ 添加子节点（每张 FM 右侧） */}
          {!pfmeaLocked && fms.map((fm) => (
            <GhostAdd
              key={`g${fm.id}`}
              pos={posOf(`fm:${fm.id}`)}
              w={FM_W}
              onAdd={() => setMenuFm(menuFm === fm.id ? null : fm.id)}
              title="添加分支节点"
            />
          ))}
        </div>

        {/* 子节点类型小菜单 */}
        {menuFm && (
          <ChildMenu
            view={v}
            fmPos={posOf(`fm:${menuFm}`)}
            onPick={(k) => {
              addPfmeaItem(node.id, menuFm, k)
              setMenuFm(null)
            }}
            onClose={() => setMenuFm(null)}
          />
        )}
      </div>

      <ScoreGuideModal factor={guide?.factor ?? null} current={guide?.current ?? 0} onClose={() => setGuide(null)} />
    </div>,
    document.body,
  )
}

function FmCard(props: {
  fmId: string
  readOnly: boolean
  mode: string
  severity: number
  occurrence: number
  detection: number
  rpn: number
  tone: { bg: string; color: string }
  pos: Pos
  fmW: number
  onMode: (v: string) => void
  onScore: (k: 'severity' | 'occurrence' | 'detection', v: number) => void
  onDelete: () => void
  onOpenGuide: (f: ScoreFactor, current: number) => void
  onAddMenu: () => void
  onPointerDownCard: (e: React.PointerEvent) => void
}) {
  return (
    <div
      data-mm-card
      onPointerDown={props.onPointerDownCard}
      className="pf-mm-card cursor-grab active:cursor-grabbing select-none"
      style={{ left: props.pos.x, top: props.pos.y, width: props.fmW }}
    >
      <div className="w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] shadow-md p-2.5 flex flex-col">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">失效模式</span>
          <input
            value={props.mode}
            disabled={props.readOnly}
            onChange={(e) => props.onMode(e.target.value)}
            placeholder="潜在失效模式..."
            className="flex-1 min-w-0 bg-transparent text-[13px] font-semibold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] disabled:cursor-default"
          />
          <button type="button" onClick={props.onDelete} disabled={props.readOnly} title="删除失效模式" className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-error)] disabled:opacity-30">
            <span className="material-symbols-outlined text-[15px]">close</span>
          </button>
        </div>
        <div className="flex gap-2 mb-1.5">
          {(['severity', 'occurrence', 'detection'] as const).map((k) => {
            const val = props[k]
            const label = k === 'severity' ? 'S' : k === 'occurrence' ? 'O' : 'D'
            return (
              <div key={k} className="flex-1 text-center">
                <label className="block text-[10px] font-bold text-[var(--color-text-tertiary)] mb-0.5">
                  {label}{' '}
                  <span
                    className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-[var(--color-brand)] text-white text-[8px] font-bold cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => props.onOpenGuide(k, val)}
                    title={`查看 ${label} 打分标准`}
                  >
                    ?
                  </span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={val || ''}
                  disabled={props.readOnly}
                  placeholder="1-10"
                  onChange={(e) => props.onScore(k, Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                  className="w-full text-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-0.5 text-[12px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] disabled:cursor-default disabled:opacity-70"
                />
              </div>
            )
          })}
        </div>
        <div
          className="text-center text-[11px] font-bold py-1 rounded-lg"
          style={{ backgroundColor: props.tone.bg, color: props.tone.color }}
        >
          RPN {props.rpn} · {riskLevelName(props.rpn)}
        </div>
      </div>
    </div>
  )
}

function GhostAdd({ pos, w, onAdd, title }: { pos: Pos; w: number; onAdd: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      title={title}
      className="absolute flex items-center justify-center w-[30px] h-[30px] rounded-full text-white font-bold shadow-md transition-transform hover:scale-110"
      style={{
        left: pos.x + w - 15,
        top: pos.y + 60,
        backgroundColor: 'var(--color-brand)',
        fontSize: 18,
      }}
    >
      +
    </button>
  )
}

function ChildMenu({
  view,
  fmPos,
  onPick,
  onClose,
}: {
  view: { panX: number; panY: number; zoom: number }
  fmPos: Pos
  onPick: (k: FmListKey) => void
  onClose: () => void
}) {
  const screenX = view.panX + (fmPos.x + FM_W + 8) * view.zoom
  const screenY = view.panY + (fmPos.y + 10) * view.zoom
  const colors: Record<FmListKey, string> = { effects: '#BA1A1A', causes: '#CA8A04', controls: '#2D628F', actions: '#087E4F' }
  return createPortal(
    <div className="fixed z-[var(--z-popover)]" style={{ left: screenX, top: screenY }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg p-1 flex flex-col min-w-[140px]">
        {FM_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs hover:bg-[var(--color-surface-container)] transition-colors"
            style={{ color: colors[k] }}
          >
            + {FM_LABELS[k].label}
          </button>
        ))}
      </div>
      <div className="fixed inset-0 z-[-1]" onClick={onClose} />
    </div>,
    document.body,
  )
}

function ToolbarBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-container)] hover:text-[var(--color-brand)]"
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </button>
  )
}

function useReducerState(): [number, () => void] {
  const [v, setV] = useState(0)
  return [v, () => setV((x) => x + 1)]
}
