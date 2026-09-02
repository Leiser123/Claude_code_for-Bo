import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  useProcessFlowStore,
  NODE_META,
  NODE_COLORS,
  PALETTE_CATEGORIES,
  MODE_LABELS,
  validateFlow,
  isOverlapping,
  NODE_W,
  NODE_H,
  MIN_EDGE_LEN,
  buildFlowCsv,
  type FlowNode,
  type FlowNodeType,
  type FlowEdge,
} from './processFlowStore'
import { PfmeaInspector } from './PfmeaInspector'
import { FmeaMindMapModal } from './FmeaMindMapModal'

const ARROW_LEN = 14

type DragState =
  | { kind: 'pan'; sx: number; sy: number; px: number; py: number }
  | {
      kind: 'node'
      ids: string[]
      start: Record<string, { x: number; y: number }>
      primary: string
      primaryStart: { x: number; y: number }
      dx: number
      dy: number
      pushed?: boolean
      moved?: boolean
    }
  | { kind: 'connect'; from: string; x: number; y: number }
  | { kind: 'marquee'; sx: number; sy: number; cx: number; cy: number }
  | { kind: 'palette'; type: FlowNodeType; x: number; y: number }
  | null

type EditingField = { nodeId: string; field: 'stepNo' | 'name' } | null

export function ProcessFlowEditor() {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedNodeIds,
    selectedEdgeId,
    panX,
    panY,
    zoom,
    mode,
    modeLockState,
    addNode,
    duplicateNode,
    toggleSpecialChar,
    togglePfmeaLinked,
    removeEdge,
    removeNode,
    removeSelected,
    updateEdgeLabel,
    connect,
    selectNode,
    selectEdge,
    selectNodes,
    moveNode,
    setView,
    undo,
    redo,
    canUndo,
    canRedo,
    beginInteraction,
    endInteraction,
    enforceEdgeGaps,
    autoLayout,
    renumberAll,
    clearCanvas,
    resetView,
    toggleLock,
    generatePfmeaFromFlow,
  } = useProcessFlowStore()

  const viewportRef = useRef<HTMLDivElement>(null)
  const [canvasMode, setCanvasMode] = useState<'select' | 'pan'>('select')
  const dragRef = useRef<DragState>(null)
  const [, forceRender] = useReducerState()
  const setDrag = useCallback((d: DragState) => {
    dragRef.current = d
    forceRender()
  }, [])

  const [editingField, setEditingField] = useState<EditingField>(null)
  const [labelEdit, setLabelEdit] = useState<{ edgeId: string; x: number; y: number } | null>(null)
  const [labelDraft, setLabelDraft] = useState('')
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [addMenu, setAddMenu] = useState<{ x: number; y: number; wx: number; wy: number; from: string } | null>(null)
  const [issuesOpen, setIssuesOpen] = useState(false)
  const [mmNodeId, setMmNodeId] = useState<string | null>(null)

  const isPfmea = mode === 'pfmea'
  const locked = modeLockState[mode]
  const flowLocked = modeLockState.process
  const pfmeaLocked = modeLockState.pfmea

  // 当前流程的完整性校验结果
  const issues = useMemo(() => validateFlow(nodes, edges), [nodes, edges])

  const toScreen = useCallback(
    (x: number, y: number) => ({ x: panX + x * zoom, y: panY + y * zoom }),
    [panX, panY, zoom],
  )
  const toWorld = useCallback(
    (sx: number, sy: number) => ({ x: (sx - panX) / zoom, y: (sy - panY) / zoom }),
    [panX, panY, zoom],
  )

  // 选中连线删除等操作由 removeSelected 处理；点外部清空选择
  useEffect(() => {
    const onGlobalClick = () => {
      setCtxMenu(null)
      setAddMenu(null)
    }
    const onGlobalKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input') || t.closest('textarea') || t.closest('[contenteditable]')) return
      if (t.closest('[data-panel]')) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && !flowLocked) {
        e.preventDefault()
        removeSelected()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('pointerdown', onGlobalClick)
    window.addEventListener('keydown', onGlobalKey)
    return () => {
      window.removeEventListener('pointerdown', onGlobalClick)
      window.removeEventListener('keydown', onGlobalKey)
    }
  }, [flowLocked, removeSelected, undo, redo])

  // 初次挂载自动适应视图
  useEffect(() => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) resetView(rect.width, rect.height)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const nz = Math.max(0.15, Math.min(3, zoom * factor))
      const ratio = nz / zoom
      setView(mx - (mx - panX) * ratio, my - (my - panY) * ratio, nz)
    },
    [zoom, panX, panY, setView],
  )

  const handleViewportPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const el = e.target as HTMLElement
      if (el.closest('[data-node]') || el.closest('[data-port]') || el.closest('svg')) return
      const rect = viewportRef.current!.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      if (canvasMode === 'pan' || e.shiftKey) {
        setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, px: panX, py: panY })
      } else {
        selectNode(null)
        selectEdge(null)
        setDrag({ kind: 'marquee', sx: cx, sy: cy, cx, cy })
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [canvasMode, panX, panY, selectNode, selectEdge, setDrag],
  )

  const handleViewportPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const rect = viewportRef.current!.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      if (drag.kind === 'pan') {
        setView(drag.px + (e.clientX - drag.sx), drag.py + (e.clientY - drag.sy), zoom)
      } else if (drag.kind === 'marquee') {
        setDrag({ ...drag, cx, cy })
      } else if (drag.kind === 'node') {
        const w = toWorld(cx, cy)
        const ddx = w.x - drag.dx - drag.primaryStart.x
        const ddy = w.y - drag.dy - drag.primaryStart.y
        // 点击/极小抖动不作为拖动，避免点一下卡片就跳动
        if (Math.hypot(ddx, ddy) <= 0.5) return
        const state = useProcessFlowStore.getState()
        const draggedSet = new Set(drag.ids)
        const others = state.nodes.filter((n) => !draggedSet.has(n.id))
        // 先整组计算候选位置，任一与其它卡片重叠则整组不落位（只标红提示）
        let blocked = false
        const candidates = drag.ids.map((id) => {
          const s = drag.start[id]
          if (!s) return null
          return { id, x: Math.round(s.x + ddx), y: Math.round(s.y + ddy) }
        })
        for (const c of candidates) {
          if (!c) continue
          const self = state.nodes.find((n) => n.id === c.id)
          if (self && isOverlapping(others, self, c.x, c.y)) {
            blocked = true
            document.querySelector(`[data-node="${c.id}"]`)?.classList.add('pf-node-overlap')
          } else {
            document.querySelector(`[data-node="${c.id}"]`)?.classList.remove('pf-node-overlap')
          }
        }
        if (blocked) return
        if (!drag.pushed) {
          setDrag({ ...drag, pushed: true, moved: true })
          beginInteraction()
        }
        for (const c of candidates) {
          if (c) moveNode(c.id, c.x, c.y)
        }
      } else if (drag.kind === 'connect') {
        setDrag({ ...drag, x: cx, y: cy })
      } else if (drag.kind === 'palette') {
        setDrag({ ...drag, x: cx, y: cy })
      }
    },
    [setView, zoom, moveNode, toWorld, beginInteraction, setDrag],
  )

  const handleViewportPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      setDrag(null)
      if (!drag) return
      const rect = viewportRef.current!.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top

      if (drag.kind === 'marquee') {
        const x1 = Math.min(drag.sx, drag.cx)
        const y1 = Math.min(drag.sy, drag.cy)
        const x2 = Math.max(drag.sx, drag.cx)
        const y2 = Math.max(drag.sy, drag.cy)
        if (x2 - x1 < 4 && y2 - y1 < 4) return
        const hits = useProcessFlowStore.getState().nodes.filter((n) => {
          const p = toScreen(n.x, n.y)
          return (
            p.x + NODE_W / 2 >= x1 && p.x + NODE_W / 2 <= x2 &&
            p.y + NODE_H / 2 >= y1 && p.y + NODE_H / 2 <= y2
          )
        })
        if (hits.length > 0) selectNodes(hits.map((n) => n.id))
      } else if (drag.kind === 'node') {
        // 只有真正移动过才结束交互 + 间距约束；单纯点击不触发任何位移
        if (drag.moved) {
          endInteraction()
          enforceEdgeGaps()
        }
      } else if (drag.kind === 'connect') {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        const targetNode = el?.closest<HTMLElement>('[data-node]')
        if (targetNode) {
          connect(drag.from, targetNode.dataset.node!)
          enforceEdgeGaps()
        } else if (!flowLocked) {
          // 松开在空白处：像 ComfyUI 一样弹出节点选择，选中后新建并自动连线
          const w = toWorld(cx, cy)
          setAddMenu({ x: e.clientX, y: e.clientY, wx: w.x, wy: w.y, from: drag.from })
        }
      } else if (drag.kind === 'palette') {
        const w = toWorld(cx, cy)
        const nodesNow = useProcessFlowStore.getState().nodes
        // 放置点若与已有卡片重叠，向下寻找最近的空位，保证卡片不允许重叠
        let px = Math.round(w.x - NODE_W / 2)
        let py = Math.round(w.y - NODE_H / 2)
        for (let i = 0; i < 30 && isOverlapping(nodesNow, { id: '__palette__' } as FlowNode, px, py); i++) {
          py += NODE_H + 12
        }
        addNode(drag.type, px, py)
      }
    },
    [toScreen, toWorld, selectNodes, connect, addNode, endInteraction, enforceEdgeGaps, setDrag],
  )

  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent, node: FlowNode) => {
      if (e.button !== 0 || flowLocked) return
      e.stopPropagation()
      const rect = viewportRef.current!.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const w = toWorld(cx, cy)
      const current = useProcessFlowStore.getState()
      const isSelected = current.selectedNodeIds.includes(node.id)
      if (!isSelected) selectNode(node.id)
      const ids = isSelected && current.selectedNodeIds.length > 0 ? [...current.selectedNodeIds] : [node.id]
      const start: Record<string, { x: number; y: number }> = {}
      for (const id of ids) {
        const n = current.nodes.find((nn) => nn.id === id)
        if (n) start[id] = { x: n.x, y: n.y }
      }
      setDrag({
        kind: 'node',
        ids,
        start,
        primary: node.id,
        primaryStart: { x: node.x, y: node.y },
        dx: w.x - node.x,
        dy: w.y - node.y,
      })
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [selectNode, toWorld, flowLocked, setDrag],
  )

  // 画布锁定（进入 PFMEA/CP/WI）后点击节点仍可选中
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: FlowNode) => {
      if (!flowLocked) return
      e.stopPropagation()
      selectNode(node.id)
    },
    [flowLocked, selectNode],
  )

  const handleNodeDoubleClick = useCallback(
    (e: React.MouseEvent, node: FlowNode) => {
      if (mode !== 'pfmea') return
      e.stopPropagation()
      setMmNodeId(node.id)
    },
    [mode],
  )

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: FlowNode) => {
      e.preventDefault()
      e.stopPropagation()
      selectNode(node.id)
      setCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id })
    },
    [selectNode],
  )

  // 从端口拖出连线：底部端口单出约束（先清空旧出边），顶部端口仅作为终点
  const handlePortPointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string, side: 'top' | 'bottom') => {
      if (e.button !== 0 || flowLocked) return
      e.stopPropagation()
      if (side === 'bottom') useProcessFlowStore.getState().removeOutgoingEdges(nodeId)
      const rect = viewportRef.current!.getBoundingClientRect()
      setDrag({ kind: 'connect', from: nodeId, x: e.clientX - rect.left, y: e.clientY - rect.top })
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [flowLocked, setDrag],
  )

  const handleEdgeClick = useCallback(
    (e: React.MouseEvent, edge: FlowEdge) => {
      if (flowLocked) return
      e.stopPropagation()
      selectEdge(edge.id)
    },
    [flowLocked, selectEdge],
  )

  const handleEdgeDoubleClick = useCallback(
    (e: React.MouseEvent, edge: FlowEdge) => {
      if (flowLocked) return
      e.stopPropagation()
      const rect = viewportRef.current!.getBoundingClientRect()
      setLabelDraft(edge.label)
      setLabelEdit({ edgeId: edge.id, x: e.clientX - rect.left, y: e.clientY - rect.top })
    },
    [flowLocked],
  )

  const commitLabel = () => {
    if (labelEdit) updateEdgeLabel(labelEdit.edgeId, labelDraft.trim())
    setLabelEdit(null)
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const drag = dragRef.current

  const startPaletteDrag = (type: FlowNodeType) => (e: React.PointerEvent) => {
    if (locked) return
    e.preventDefault()
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const startX = e.clientX
    const startY = e.clientY
    setDrag({ kind: 'palette', type, x: e.clientX - rect.left, y: e.clientY - rect.top })
    const onMove = (ev: PointerEvent) => {
      const r = viewportRef.current?.getBoundingClientRect()
      if (!r) return
      setDrag({ kind: 'palette', type, x: ev.clientX - r.left, y: ev.clientY - r.top })
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const r = viewportRef.current?.getBoundingClientRect()
      if (!r) return
      setDrag(null)
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) return
      const inViewport =
        ev.clientX >= r.left && ev.clientX <= r.right &&
        ev.clientY >= r.top && ev.clientY <= r.bottom
      if (!inViewport) return
      const d = dragRef.current
      if (!d || d.kind !== 'palette') return
      const w = toWorld(ev.clientX - r.left, ev.clientY - r.top)
      addNode(d.type, Math.round(w.x - NODE_W / 2), Math.round(w.y - NODE_H / 2))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const copyNode = () => {
    if (ctxMenu) {
      duplicateNode(ctxMenu.nodeId)
      setCtxMenu(null)
    }
  }
  const deleteNodeCtx = () => {
    if (ctxMenu) {
      removeNode(ctxMenu.nodeId)
      setCtxMenu(null)
    }
  }
  const renumberCtx = () => {
    if (ctxMenu) {
      const node = nodes.find((n) => n.id === ctxMenu.nodeId)
      setEditingField({ nodeId: ctxMenu.nodeId, field: 'stepNo' })
      void node
      setCtxMenu(null)
    }
  }
  const toggleSCCtx = () => {
    if (ctxMenu) {
      toggleSpecialChar(ctxMenu.nodeId)
      setCtxMenu(null)
    }
  }
  const toggleLinkCtx = () => {
    if (ctxMenu) {
      togglePfmeaLinked(ctxMenu.nodeId)
      setCtxMenu(null)
    }
  }

  // 从连接点拉线松开到空白处：新建所选类型节点并自动连线（ComfyUI 式）
  const pickConnectNode = (type: FlowNodeType) => {
    if (!addMenu) return
    const s = useProcessFlowStore.getState()
    s.addNode(type, Math.round(addMenu.wx - NODE_W / 2), Math.round(addMenu.wy - NODE_H / 2))
    const nid = useProcessFlowStore.getState().selectedNodeId
    if (nid) {
      useProcessFlowStore.getState().connect(addMenu.from, nid)
      useProcessFlowStore.getState().enforceEdgeGaps()
    }
    setAddMenu(null)
  }

  const counts = useMemo(
    () => ({
      nodes: nodes.length,
      edges: edges.length,
      sc: nodes.filter((n) => n.specialChar).length,
    }),
    [nodes, edges],
  )
  // 避免重复调用 canUndo（读取内部 history），改用按钮禁用态：
  const undoDisabled = flowLocked || !canUndo()
  const redoDisabled = flowLocked || !canRedo()

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      {/* ===== 工具栏 ===== */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border-separator)]">
        <span className="material-symbols-outlined text-[20px] text-[var(--color-brand)]">account_tree</span>
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{MODE_LABELS[mode]}</span>
        <div className="mx-1 h-5 w-px bg-[var(--color-border-separator)]" />
        <ToolButton icon="undo" label="撤销 (Ctrl+Z)" disabled={undoDisabled} onClick={undo} />
        <ToolButton icon="redo" label="重做 (Ctrl+Y)" disabled={redoDisabled} onClick={redo} />
        <div className="mx-1 h-5 w-px bg-[var(--color-border-separator)]" />
        <ToolButton icon="arrow_selector_tool" label="选择（框选/删除）" active={canvasMode === 'select'} onClick={() => setCanvasMode('select')} />
        <ToolButton icon="pan_tool" label="移动画布" active={canvasMode === 'pan'} onClick={() => setCanvasMode('pan')} />
        <ToolButton
          icon="auto_awesome"
          label="自动布局"
          disabled={flowLocked}
          onClick={() => {
            autoLayout()
            // 布局后自动把整张图带入视野，避免内容跑出可视区
            requestAnimationFrame(() => {
              const rect = viewportRef.current?.getBoundingClientRect()
              if (rect) resetView(rect.width, rect.height)
            })
          }}
        />
        <ToolButton
          icon="fit_screen"
          label="适应窗口"
          onClick={() => {
            const rect = viewportRef.current?.getBoundingClientRect()
            if (rect) resetView(rect.width, rect.height)
          }}
        />
        <ToolButton icon="format_list_numbered" label="重编号" disabled={flowLocked || nodes.length === 0} onClick={renumberAll} />
        <ToolButton
          icon="delete_sweep"
          label="清空"
          disabled={flowLocked || nodes.length === 0}
          onClick={() => {
            if (window.confirm('确定清空所有节点和连线？')) clearCanvas()
          }}
        />
        <div className="flex-1" />
        {isPfmea ? (
          <>
            <button
              type="button"
              onClick={generatePfmeaFromFlow}
              disabled={locked}
              title="从流程生成 PFMEA"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-brand)] bg-[var(--color-brand)]/10 hover:bg-[var(--color-brand)]/15 disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">analytics</span>
              从流程生成 PFMEA
            </button>
            <button
              type="button"
              onClick={() => selectedNode && setMmNodeId(selectedNode.id)}
              disabled={!selectedNode || pfmeaLocked}
              title="在思维导图中设计选中工序的 FMEA"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-focus)] disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">account_tree</span>
              FMEA 思维导图
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => download(buildFlowCsv(nodes), 'process_flow_export.csv')}
              disabled={nodes.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-focus)] disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              导出
            </button>
            <ToolButton icon="delete" label="删除选中 (Delete)" disabled={(!selectedNodeIds.length && !selectedEdgeId) || flowLocked} onClick={removeSelected} />
          </>
        )}
        <span className="text-[11px] text-[var(--color-text-tertiary)] tabular-nums">{Math.round(zoom * 100)}%</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ===== 左栏：节点库 / 失效模式库 ===== */}
        <div data-panel className="w-[216px] shrink-0 border-r border-[var(--color-border-separator)] bg-[var(--color-surface)] p-3 overflow-y-auto">
          {isPfmea ? (
            <>
              <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">失效模式库</p>
              <p className="text-[11px] text-[var(--color-text-tertiary)] leading-5 mb-2">
                先在画布中选中工序节点，单击右侧面板「新增失效模式」；或<b className="text-[var(--color-brand)]">双击卡片</b>进入思维导图设计。
              </p>
              <button
                onClick={() => {
                  if (!selectedNode) {
                    alert('请先在画布中选中一个工序节点')
                    return
                  }
                  useProcessFlowStore.getState().addPfmea(selectedNode.id, {
                    mode: '新失效模式', severity: 0, occurrence: 0, detection: 0, effects: [], causes: [], controls: [], actions: [],
                  })
                }}
                disabled={locked || !selectedNode}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-dashed border-[var(--color-brand)]/40 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 text-xs disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                为选中工序新增失效模式
              </button>
              <div className="text-[10px] text-[var(--color-text-tertiary)] mt-1.5">
                完整失效模式库（尺寸/装配/外观/性能/材料）与 S/O/D 打分标准在右侧面板。
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">节点库</p>
              <div className="flex flex-col gap-1.5">
                {PALETTE_CATEGORIES.map((cat) => (
                  <div key={cat.title}>
                    <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] mt-2 mb-1 flex items-center gap-1.5">
                      {cat.title}
                      <span className="flex-1 h-px bg-[var(--color-border-separator)]" />
                    </p>
                    {cat.types.map((type) => {
                      const meta = NODE_META[type]
                      const colors = NODE_COLORS[type]
                      return (
                        <button
                          key={type}
                          type="button"
                          disabled={locked}
                          onPointerDown={startPaletteDrag(type)}
                          title="拖拽到画布创建节点（单击为快速创建，拖到空白处放置）"
                          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] hover:border-[var(--color-brand)] disabled:opacity-40 disabled:cursor-not-allowed cursor-grab active:cursor-grabbing transition-colors"
                        >
                          <NodeSymbol type={type} size={24} />
                          <div className="text-left min-w-0">
                            <div className="text-xs font-medium text-[var(--color-text-primary)]">{meta.label}</div>
                            <div className="text-[10px] text-[var(--color-text-tertiary)]" style={{ color: colors.color }}>{meta.defaultName}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ===== 画布 ===== */}
        <div
          ref={viewportRef}
          className={`flex-1 relative overflow-hidden bg-[var(--color-surface-container-low)] ${canvasMode === 'pan' ? 'cursor-grab' : 'cursor-default'}`}
          style={{
            // 固定背景网格：放大/缩小/平移不改变点阵疏密，始终贴在屏幕上
            backgroundImage: 'radial-gradient(circle, var(--color-surface-container-high) 1.5px, transparent 1.5px)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0',
          }}
          onWheel={handleWheel}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
          onContextMenu={(e) => {
            if (!(e.target as HTMLElement).closest('[data-node]')) {
              e.preventDefault()
              setCtxMenu(null)
            }
          }}
        >
          {/* 连线 SVG（置于卡片之上，卡片不遮挡线条/箭头） */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-[var(--z-raised)]">
            {edges.map((edge) => {
              const from = nodes.find((n) => n.id === edge.from)
              const to = nodes.find((n) => n.id === edge.to)
              if (!from || !to) return null
              const f = toScreen(from.x, from.y)
              const t = toScreen(to.x, to.y)
              const x1 = f.x + NODE_W / 2
              const y1 = f.y + NODE_H
              const x2 = t.x + NODE_W / 2
              const y2 = t.y
              const my = (y1 + y2) / 2
              const selected = selectedEdgeId === edge.id
              const downward = y2 >= y1
              const ey = downward ? y2 - ARROW_LEN : y2 + ARROW_LEN
              const d = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${ey}`
              const midX = (x1 + x2) / 2
              const midY = (y1 + y2) / 2
              const labelW = Math.max(20, edge.label.length * 8 + 8)
              const key = edge.id
              return (
                <g key={key}>
                  {!selected && (
                    <>
                      <path d={d} stroke="rgba(208,122,92,0.5)" className="pf-flow-layer pf-flow-glow" />
                      <path d={d} stroke="var(--color-brand)" className="pf-flow-layer pf-flow-main" />
                      <path d={d} stroke="rgba(255,255,255,0.9)" className="pf-flow-layer pf-flow-spark" />
                    </>
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={selected ? 'var(--color-brand)' : 'var(--color-outline)'}
                    strokeWidth={selected ? 2.6 : 1.6}
                    className="pf-edge-hit"
                    onClick={(e) => handleEdgeClick(e, edge)}
                    onDoubleClick={(e) => handleEdgeDoubleClick(e, edge)}
                    style={selected ? { filter: 'drop-shadow(0 0 3px var(--color-brand))' } : undefined}
                  />
                  <polygon
                    points={`${x2 - 7},${ey} ${x2},${y2} ${x2 + 7},${ey}`}
                    fill={selected ? 'var(--color-brand)' : 'var(--color-outline)'}
                    pointerEvents="none"
                  />
                  {edge.label && (
                    <g pointerEvents="none">
                      <rect
                        x={midX - labelW / 2}
                        y={midY - 10}
                        width={labelW}
                        height={20}
                        rx={4}
                        fill="var(--color-surface)"
                        stroke="var(--color-border)"
                      />
                      <text x={midX} y={midY + 3} textAnchor="middle" fontSize={11} fill="var(--color-text-secondary)">
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
            {drag?.kind === 'connect' && (() => {
              const from = nodes.find((n) => n.id === drag.from)
              if (!from) return null
              const p = toScreen(from.x, from.y)
              const sx = p.x + NODE_W / 2
              const sy = p.y + NODE_H
              return (
                <path
                  d={`M ${sx} ${sy} L ${drag.x} ${drag.y}`}
                  fill="none"
                  stroke="var(--color-brand)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  pointerEvents="none"
                />
              )
            })()}
          </svg>

          {/* 节点 */}
          {nodes.map((node) => (
            <FlowNodeCard
              key={node.id}
              node={node}
              selected={selectedNodeIds.includes(node.id)}
              pfmeaHighlight={isPfmea && selectedNodeIds.includes(node.id)}
              showPfmeaBadge={isPfmea}
              locked={flowLocked}
              editing={editingField?.nodeId === node.id ? editingField.field : null}
              onCommitField={(value) => {
                if (editingField) updateField(editingField.nodeId, editingField.field, value)
                setEditingField(null)
              }}
              onCancelField={() => setEditingField(null)}
              onPointerDown={handleNodePointerDown}
              onClick={handleNodeClick}
              onDoubleClick={handleNodeDoubleClick}
              onContextMenu={handleNodeContextMenu}
              onStartEdit={(field) => {
                if (!flowLocked) setEditingField({ nodeId: node.id, field })
              }}
            />
          ))}

          {/* 连接点单独绘制在连线层之上：连线/箭头不遮挡连接点 */}
          {!flowLocked &&
            nodes.map((node) => (
              <PortPair key={`ports-${node.id}`} node={node} panX={panX} panY={panY} zoom={zoom} onPortPointerDown={handlePortPointerDown} />
            ))}

          {/* 连线标签编辑浮层 */}
          {labelEdit && (
            <input
              autoFocus
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel()
                if (e.key === 'Escape') setLabelEdit(null)
              }}
              onBlur={commitLabel}
              placeholder="连线说明"
              className="absolute z-[80] px-2 py-1 text-[11px] text-center rounded-lg border border-[var(--color-brand)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] outline-none shadow-md"
              style={{ left: labelEdit.x - 60, top: labelEdit.y - 14, width: 120 }}
            />
          )}

          {/* 拖拽中的节点幽灵 */}
          {drag?.kind === 'palette' && (
            <div
              className="absolute z-[100] pointer-events-none opacity-70"
              style={{ left: drag.x - NODE_W / 2, top: drag.y - NODE_H / 2, width: NODE_W, height: NODE_H }}
            >
              <div className="w-full h-full rounded-[14px] border-2 border-dashed border-[var(--color-brand)] bg-[var(--color-surface)] flex items-center justify-center text-xs text-[var(--color-text-tertiary)]">
                {NODE_META[drag.type].label}
              </div>
            </div>
          )}

          {/* 框选 */}
          {drag?.kind === 'marquee' && (
            <div
              className="absolute z-[90] pointer-events-none border border-dashed border-[var(--color-brand)] bg-[var(--color-brand)]/10"
              style={{
                left: Math.min(drag.sx, drag.cx),
                top: Math.min(drag.sy, drag.cy),
                width: Math.abs(drag.cx - drag.sx),
                height: Math.abs(drag.cy - drag.sy),
              }}
            />
          )}

          {/* 空态提示 */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-[var(--color-text-tertiary)]">
              <span className="material-symbols-outlined text-[64px] opacity-20">account_tree</span>
              <p className="text-sm mt-2">从左侧拖拽节点到此处开始编排工艺流程</p>
            </div>
          )}

          {/* 完整性校验徽章 */}
          {issues.length > 0 && (
            <div
              className="absolute right-3 bottom-3 z-[70] max-w-[380px] rounded-xl shadow-lg cursor-pointer select-none"
              style={{
                backgroundColor: issues.some((i) => i.kind === 'error') ? '#fef2f2' : '#fffbeb',
                border: issues.some((i) => i.kind === 'error') ? '1px solid #fecaca' : '1px solid #fde68a',
              }}
              onClick={() => setIssuesOpen((v) => !v)}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIssuesOpen(false)
                }}
                className="absolute top-1 right-1.5 text-[13px] opacity-60 hover:opacity-100"
                aria-label="关闭告警"
              >
                ×
              </button>
              <div className="flex items-center gap-2 px-3.5 py-2.5 pr-6">
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ color: issues.some((i) => i.kind === 'error') ? '#b91c1c' : '#b45309' }}
                >
                  {issues.some((i) => i.kind === 'error') ? 'error' : 'warning'}
                </span>
                <div>
                  <div className="text-xs font-semibold" style={{ color: issues.some((i) => i.kind === 'error') ? '#b91c1c' : '#b45309' }}>
                    流程完整性告警（{issues.filter((i) => i.kind === 'error').length} 错误 · {issues.filter((i) => i.kind === 'warning').length} 警告）
                  </div>
                  {issuesOpen && (
                    <div className="mt-1.5 text-[11px] leading-5 space-y-0.5">
                      {issues.map((it, idx) => (
                        <div key={idx} style={{ color: it.kind === 'error' ? '#b91c1c' : '#b45309' }}>
                          <span className="mr-1">•</span>
                          {it.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {(locked || flowLocked) && (
            <button
              type="button"
              onClick={() => toggleLock(flowLocked ? 'process' : mode)}
              onContextMenu={(e) => {
                e.preventDefault()
                toggleLock(flowLocked ? 'process' : mode)
              }}
              onDoubleClick={() => toggleLock(flowLocked ? 'process' : mode)}
              title="Process Flow 已锁定，画布只读。点击 / 右键 / 双击可直接解锁（后道 PFMEA/CP/WI 若也锁定将一并解锁）"
              className="absolute top-3 left-3 z-[60] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer text-[#CA8A04] bg-[#CA8A04]/10 border border-[#CA8A04]/25 hover:bg-[#CA8A04]/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">lock</span>
              {flowLocked ? 'Process Flow 已锁定 · 点击解锁' : `${MODE_LABELS[mode]} 已锁定 · 点击解锁`}
            </button>
          )}
        </div>

        {/* ===== 右栏 ===== */}
        <div data-panel className="w-[264px] shrink-0 border-l border-[var(--color-border-separator)] bg-[var(--color-surface)] p-3 overflow-y-auto">
          {isPfmea ? (
            selectedNode ? (
              <PfmeaInspector key={selectedNode.id} node={selectedNode} />
            ) : (
              <div className="flex flex-col items-center text-center py-10 gap-2">
                <span className="material-symbols-outlined text-[32px] text-[var(--color-text-tertiary)]">analytics</span>
                <p className="text-xs text-[var(--color-text-tertiary)] leading-5">
                  在流程图中<b>单击</b>一个工序节点在右侧编辑 PFMEA；
                  <br />
                  <b>双击</b>卡片进入思维导图设计。
                </p>
                <button
                  onClick={generatePfmeaFromFlow}
                  disabled={locked}
                  className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-brand)] bg-[var(--color-brand)]/10 hover:bg-[var(--color-brand)]/15 disabled:opacity-40 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                  一键从流程生成 PFMEA
                </button>
              </div>
            )
          ) : selectedNode ? (
            <NodeInspector
              key={selectedNode.id}
              node={selectedNode}
              locked={flowLocked}
              onStartEdit={(field) => setEditingField({ nodeId: selectedNode.id, field })}
            />
          ) : selectedEdgeId ? (
            <EdgeInspector edge={edges.find((e) => e.id === selectedEdgeId)} onDelete={() => removeEdge(selectedEdgeId)} />
          ) : (
            <div className="flex flex-col items-center text-center py-10 gap-2">
              <span className="material-symbols-outlined text-[32px] text-[var(--color-text-tertiary)]">touch_app</span>
              <p className="text-xs text-[var(--color-text-tertiary)] leading-5">
                从左侧拖入节点到画布；
                <br />
                拖动节点底部圆点建立连线；
                <br />
                右键节点可复制/删除/改号；
                <br />
                双击连线可添加说明；Ctrl+Z 撤销。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ===== 状态栏 ===== */}
      <div className="shrink-0 h-8 flex items-center gap-4 px-4 text-[11px] text-[var(--color-text-tertiary)] border-t border-[var(--color-border-separator)] bg-[var(--color-surface)]">
        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">circle</span>节点: <b>{counts.nodes}</b></span>
        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">timeline</span>连线: <b>{counts.edges}</b></span>
        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">warning</span>特殊特性: <b>{counts.sc}</b></span>
        <div className="flex-1" />
        <span>连线净距下限 {MIN_EDGE_LEN}px · 拖动时自动撑开下游</span>
      </div>

      {/* ===== 右键菜单 ===== */}
      {ctxMenu && (
        <div
          className="fixed z-[var(--z-popover)] min-w-[176px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg p-1 flex flex-col"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {[
            { icon: 'content_copy', label: '复制节点', danger: false, fn: copyNode },
            { icon: 'delete', label: '删除节点', danger: true, fn: deleteNodeCtx },
            { icon: 'edit', label: '修改编号', danger: false, fn: renumberCtx },
            { icon: 'star', label: '切换特殊特性', danger: false, fn: toggleSCCtx },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.fn}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                item.danger
                  ? 'text-[var(--color-error)] hover:bg-[var(--color-error)]/10'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-brand)]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
          {!isPfmea && (
            <>
              <div className="h-px bg-[var(--color-border-separator)] my-1" />
              <button
                type="button"
                onClick={toggleLinkCtx}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-brand)] transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">link</span>
                关联 PFMEA
              </button>
            </>
          )}
        </div>
      )}

      {/* ===== 拉线空白处松开的节点选择菜单（ComfyUI 式） ===== */}
      {addMenu && (
        <>
          <div className="fixed inset-0 z-[var(--z-popover)]" onClick={() => setAddMenu(null)} />
          <div
            className="fixed z-[var(--z-popover)] w-[230px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg p-1.5 flex flex-col max-h-[70vh] overflow-y-auto"
            style={{
              left: Math.min(addMenu.x, window.innerWidth - 250),
              top: Math.min(addMenu.y, window.innerHeight - 420),
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider px-1.5 py-1">
              选择要添加的节点
            </p>
            {PALETTE_CATEGORIES.map((cat) => (
              <div key={cat.title} className="mb-1">
                <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] px-1.5 pt-1 pb-0.5 flex items-center gap-1.5">
                  {cat.title}
                  <span className="flex-1 h-px bg-[var(--color-border-separator)]" />
                </p>
                {cat.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => pickConnectNode(type)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-brand)] transition-colors"
                  >
                    <NodeSymbol type={type} size={20} />
                    <span>{NODE_META[type].label}</span>
                    <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">{NODE_META[type].defaultName}</span>
                  </button>
                ))}
              </div>
            ))}
            <p className="text-[10px] text-[var(--color-text-tertiary)] px-1.5 py-1">
              选择后将在此处新建节点并与当前端口自动连线；点空白处取消。
            </p>
          </div>
        </>
      )}

      {/* ===== FMEA 思维导图 ===== */}
      {mmNodeId && <FmeaMindMapModal nodeId={mmNodeId} onClose={() => setMmNodeId(null)} />}
    </div>
  )
}

// 供 Field/其他面板使用的最小工具集
function updateField(id: string, field: 'stepNo' | 'name', value: string) {
  useProcessFlowStore.getState().updateNode(id, { [field]: value })
}

function download(content: string, name: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function useReducerState(): [number, () => void] {
  const [v, setV] = useState(0)
  return [v, () => setV((x) => x + 1)]
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[var(--color-text-tertiary)]">{label}</span>
      {children}
    </div>
  )
}

const inputCls =
  'w-full h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50'

function NodeInspector({
  node,
  locked,
  onStartEdit,
}: {
  node: FlowNode
  locked: boolean
  onStartEdit: (field: 'stepNo' | 'name') => void
}) {
  const { updateNode, setNodeType, toggleSpecialChar, togglePfmeaLinked, removeNode } = useProcessFlowStore()

  const [paramText, setParamText] = useState(node.processParams.join('\n'))
  const [charText, setCharText] = useState(node.productChars.join('\n'))

  const updateParams = (text: string) => {
    setParamText(text)
    updateNode(node.id, { processParams: text.split('\n').map((s) => s.trim()).filter(Boolean) })
  }
  const updateChars = (text: string) => {
    setCharText(text)
    updateNode(node.id, { productChars: text.split('\n').map((s) => s.trim()).filter(Boolean) })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">节点属性</p>
      <div className="flex items-center gap-2">
        <Field label="类型">
          <select
            value={node.type}
            disabled={locked}
            onChange={(e) => setNodeType(node.id, e.target.value as FlowNodeType)}
            className={inputCls}
          >
            {(Object.keys(NODE_META) as FlowNodeType[]).map((t) => (
              <option key={t} value={t}>
                {NODE_META[t].symbol} {NODE_META[t].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="工序号">
          <button
            type="button"
            onClick={() => onStartEdit('stepNo')}
            disabled={locked}
            title="双击修改（或右键 → 修改编号）"
            className={inputCls + ' text-left cursor-text hover:border-[var(--color-border-focus)]'}
          >
            <span className="inline-flex">{node.stepNo || '(未编号)'}</span>
          </button>
        </Field>
      </div>
      <Field label="名称">
        <button type="button" onClick={() => onStartEdit('name')} disabled={locked} title="点击修改" className={inputCls + ' text-left cursor-text hover:border-[var(--color-border-focus)]'}>
          {node.name}
        </button>
      </Field>
      <Field label="设备 / 工装">
        <input value={node.equipment} disabled={locked} onChange={(e) => updateNode(node.id, { equipment: e.target.value })} className={inputCls} />
      </Field>
      <Field label="材料输入">
        <input value={node.material} disabled={locked} onChange={(e) => updateNode(node.id, { material: e.target.value })} className={inputCls} />
      </Field>
      <Field label="变异源 (Variation)">
        <textarea
          value={node.variation}
          disabled={locked}
          onChange={(e) => updateNode(node.id, { variation: e.target.value })}
          rows={2}
          className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50"
        />
      </Field>
      <Field label="产品特性（每行一项，PC）">
        <textarea value={charText} disabled={locked} onChange={(e) => updateChars(e.target.value)} rows={3}
          className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50" />
      </Field>
      <Field label="工艺参数（每行一项，PP）">
        <textarea value={paramText} disabled={locked} onChange={(e) => updateParams(e.target.value)} rows={3}
          className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50" />
      </Field>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => toggleSpecialChar(node.id)}
          disabled={locked}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
            node.specialChar
              ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
              : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container)]'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">star</span>
          {node.specialChar ? 'SC · 特殊特性' : '标记为特殊特性'}
        </button>
      </div>
      {node.specialChar && (
        <Field label="特性编号 (Balloon No.)">
          <input value={node.balloonNo} disabled={locked} onChange={(e) => updateNode(node.id, { balloonNo: e.target.value })} className={inputCls} />
        </Field>
      )}

      <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
        <input type="checkbox" checked={node.pfmeaLinked} disabled={locked} onChange={() => togglePfmeaLinked(node.id)} />
        关联 PFMEA（随流程生成风险分析）
      </label>

      <button
        type="button"
        onClick={() => removeNode(node.id)}
        disabled={locked}
        className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-error)] bg-[var(--color-error)]/5 hover:bg-[var(--color-error)]/10 disabled:opacity-40 transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">delete</span>
        删除节点
      </button>
    </div>
  )
}

function EdgeInspector({ edge, onDelete }: { edge: FlowEdge | undefined; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">连线</p>
      <p className="text-xs text-[var(--color-text-secondary)]">
        已选中一条连线。双击连线可在中点添加说明；拖动源节点底部圆点或在此删除可移除连线。
      </p>
      {edge?.label && (
        <div className="rounded-lg bg-[var(--color-surface-container-low)] px-2.5 py-2 text-xs text-[var(--color-text-secondary)]">
          说明：{edge.label}
        </div>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-[var(--color-error)] bg-[var(--color-error)]/5 hover:bg-[var(--color-error)]/10 transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">link_off</span>
        删除连线
      </button>
    </div>
  )
}

function ToolButton({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: string
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
        active
          ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
          : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-primary)]'
      } disabled:opacity-35 disabled:cursor-not-allowed`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{icon}</span>
    </button>
  )
}

export function NodeSymbol({ type, size = 26 }: { type: FlowNodeType; size?: number }) {
  const colors = NODE_COLORS[type]
  const meta = NODE_META[type]
  const style: React.CSSProperties = {
    width: size,
    height: size,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.42,
    fontWeight: 700,
    color: colors.color,
    background: colors.bg,
    border: `2px solid ${colors.color}`,
    borderRadius: type === 'operation' || type === 'start' || type === 'end' ? '50%' : 4,
    flexShrink: 0,
  }
  return <span style={style}>{meta.symbol}</span>
}

/** 连接点层：独立绘制在卡片与连线之上，保证连接点永远可见可点 */
function PortPair({
  node,
  panX,
  panY,
  zoom,
  onPortPointerDown,
}: {
  node: FlowNode
  panX: number
  panY: number
  zoom: number
  onPortPointerDown: (e: React.PointerEvent, nodeId: string, side: 'top' | 'bottom') => void
}) {
  const cx = panX + node.x * zoom + NODE_W / 2
  const topY = panY + node.y * zoom
  const bottomY = topY + NODE_H
  const dotCls =
    'absolute z-[var(--z-sticky)] w-3.5 h-3.5 rounded-full border-2 border-white cursor-crosshair transition-transform hover:scale-125'
  return (
    <>
      <span
        data-node={node.id}
        data-port="top"
        className={dotCls}
        style={{ left: cx - 7, top: topY - 7, backgroundColor: 'var(--color-brand)' }}
        onPointerDown={(e) => onPortPointerDown(e, node.id, 'top')}
        title="拖出连线；松开到空白处可选择要新建的节点"
      />
      <span
        data-node={node.id}
        data-port="bottom"
        className={dotCls}
        style={{ left: cx - 7, top: bottomY - 7, backgroundColor: 'var(--color-brand)' }}
        onPointerDown={(e) => onPortPointerDown(e, node.id, 'bottom')}
        title="拖出连线（原输出自动断开）；松开到空白处可选择要新建的节点"
      />
    </>
  )
}

function FlowNodeCard({
  node,
  selected,
  pfmeaHighlight,
  showPfmeaBadge,
  locked,
  editing,
  onCommitField,
  onCancelField,
  onPointerDown,
  onClick,
  onDoubleClick,
  onContextMenu,
  onStartEdit,
}: {
  node: FlowNode
  selected: boolean
  pfmeaHighlight: boolean
  showPfmeaBadge: boolean
  locked: boolean
  editing: 'stepNo' | 'name' | null
  onCommitField: (value: string) => void
  onCancelField: () => void
  onPointerDown: (e: React.PointerEvent, node: FlowNode) => void
  onClick: (e: React.MouseEvent, node: FlowNode) => void
  onDoubleClick: (e: React.MouseEvent, node: FlowNode) => void
  onContextMenu: (e: React.MouseEvent, node: FlowNode) => void
  onStartEdit: (field: 'stepNo' | 'name') => void
}) {
  const zoom = useProcessFlowStore((s) => s.zoom)
  const panX = useProcessFlowStore((s) => s.panX)
  const panY = useProcessFlowStore((s) => s.panY)
  const colors = NODE_COLORS[node.type]
  const left = panX + node.x * zoom
  const top = panY + node.y * zoom

  return (
    <div
      data-node={node.id}
      onPointerDown={(e) => onPointerDown(e, node)}
      onClick={(e) => onClick(e, node)}
      onDoubleClick={(e) => onDoubleClick(e, node)}
      onContextMenu={(e) => onContextMenu(e, node)}
      className={`absolute z-[2] select-none rounded-[14px] border-2 bg-[var(--color-surface)] shadow-sm pf-node ${
        locked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${selected ? 'border-[var(--color-brand)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-focus)]'}`}
      style={{
        left,
        top,
        width: NODE_W,
        minHeight: NODE_H,
        padding: '10px 14px',
        touchAction: 'none',
        ...(pfmeaHighlight
          ? { boxShadow: '0 0 0 4px var(--color-brand-soft), 0 8px 24px rgba(143,72,47,0.18)', zIndex: 'var(--z-raised)' }
          : {}),
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <NodeSymbol type={node.type} size={24} />
        {editing === 'stepNo' ? (
          <InlineEditInput value={node.stepNo} onCommit={onCommitField} onCancel={onCancelField} />
        ) : (
          <button
            type="button"
            onDoubleClick={(e) => {
              e.stopPropagation()
              onStartEdit('stepNo')
            }}
            title={locked ? undefined : '双击修改工序号'}
            className="text-[11px] font-bold px-1.5 py-0.5 rounded cursor-text"
            style={{ color: colors.color, background: colors.bg }}
          >
            {node.stepNo || node.name || '未编号'}
          </button>
        )}
      </div>
      {editing === 'name' ? (
        <InlineEditInput value={node.name} onCommit={onCommitField} onCancel={onCancelField} />
      ) : (
        <div
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (!locked) onStartEdit('name')
          }}
          className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate cursor-text"
          title={locked ? undefined : '双击修改名称'}
        >
          {node.name}
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--color-text-tertiary)] flex-wrap">
        {node.specialChar && (
          <span className="px-1.5 py-px rounded font-bold" style={{ background: '#BA1A1A', color: '#fff' }}>
            SC{node.balloonNo ? `·${node.balloonNo}` : ''}
          </span>
        )}
        {node.equipment && <span className="truncate">设备:{node.equipment}</span>}
        {node.productChars.length > 0 && <span>PC×{node.productChars.length}</span>}
        {node.processParams.length > 0 && <span>PP×{node.processParams.length}</span>}
      </div>
      {showPfmeaBadge && (
        <div
          className={`mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
            node.pfmeas.length > 0
              ? 'bg-[#CA8A04]/10 text-[#CA8A04]'
              : 'bg-[var(--color-surface-container)] text-[var(--color-text-tertiary)]'
          }`}
        >
          <span className="material-symbols-outlined text-[11px]">analytics</span>
          {node.pfmeas.length > 0 ? `PFMEA ×${node.pfmeas.length}` : '未生成 PFMEA'}
        </div>
      )}
    </div>
  )
}

function InlineEditInput({
  value,
  onCommit,
  onCancel,
}: {
  value: string
  onCommit: (v: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.select()
  }, [])
  return (
    <input
      ref={ref}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') onCommit(draft)
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={() => onCommit(draft)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      className="min-w-[90px] px-1.5 py-0.5 rounded-md border border-[var(--color-brand)] bg-[var(--color-surface)] text-[11px] font-bold text-[var(--color-text-primary)] outline-none"
    />
  )
}
