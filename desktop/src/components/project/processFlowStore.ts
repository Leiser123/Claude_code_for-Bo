import { create } from 'zustand'

export type FlowNodeType = 'operation' | 'inspection' | 'transport' | 'delay' | 'storage' | 'start' | 'end' | 'decision'

// ===== PFMEA 数据模型（多值列表，与参考实现对齐）=====
export type FmListItem = { id: string; text: string }
export type FmListKey = 'effects' | 'causes' | 'controls' | 'actions'

export type PfmeaItem = {
  id: string
  mode: string
  severity: number
  occurrence: number
  detection: number
  effects: FmListItem[]
  causes: FmListItem[]
  controls: FmListItem[]
  actions: FmListItem[]
  collapsed?: boolean
}

export type FlowNode = {
  id: string
  type: FlowNodeType
  name: string
  code: string
  stepNo: string
  x: number
  y: number
  desc: string
  equipment: string
  material: string
  specialChar: boolean
  balloonNo: string
  processParams: string[]
  productChars: string[]
  pfmeas: PfmeaItem[]
  pfmeaLinked: boolean
  pfmeaStep: string
  variation: string
}

export type FlowEdge = {
  id: string
  from: string
  to: string
  label: string
}

export type WorkflowMode = 'process' | 'pfmea' | 'cp' | 'wi'

export const MODE_ORDER: WorkflowMode[] = ['process', 'pfmea', 'cp', 'wi']
export const MODE_LABELS: Record<WorkflowMode, string> = {
  process: 'Process Flow',
  pfmea: 'PFMEA',
  cp: 'CP',
  wi: 'WI',
}

// 画布几何常量（世界坐标，卡片 240×66）
export const NODE_W = 240
export const NODE_H = 66
/** 连线上/下两节点间的最小垂直净距：保证线条长度 ≥ 箭头(14)+直线段，不被卡片遮挡 */
export const MIN_EDGE_LEN = 110

export const NODE_META: Record<FlowNodeType, { label: string; defaultName: string; short: string; symbol: string }> = {
  operation: { label: '操作', defaultName: '加工工序', short: 'OP', symbol: '○' },
  inspection: { label: '检验', defaultName: '质量检验', short: '检', symbol: '□' },
  transport: { label: '运输', defaultName: '物料搬运', short: '运', symbol: '→' },
  delay: { label: '等待', defaultName: '暂存等待', short: '等', symbol: 'D' },
  storage: { label: '存储', defaultName: '仓库存储', short: '存', symbol: '▽' },
  start: { label: '起点', defaultName: '来料', short: '始', symbol: 'S' },
  end: { label: '结束', defaultName: '成品出货', short: '终', symbol: 'E' },
  decision: { label: '决策', defaultName: '合格判定', short: '判', symbol: '◇' },
}

// 节点库分类
export const PALETTE_CATEGORIES: { title: string; types: FlowNodeType[] }[] = [
  { title: '加工 · Operations', types: ['operation', 'inspection'] },
  { title: '流程 · Flow', types: ['transport', 'delay', 'storage'] },
  { title: '边界 · Boundary', types: ['start', 'decision', 'end'] },
]

export const NODE_COLORS: Record<FlowNodeType, { color: string; bg: string }> = {
  operation: { color: '#2D628F', bg: '#E4F1FF' },
  inspection: { color: '#087E4F', bg: '#E8F5E2' },
  transport: { color: '#87736D', bg: '#F4F4F0' },
  delay: { color: '#CA8A04', bg: '#FEF9C3' },
  storage: { color: '#7C3AED', bg: '#F3E8FF' },
  start: { color: '#54433E', bg: '#EFEEEA' },
  end: { color: '#4D3E80', bg: '#E6DFFF' },
  decision: { color: '#BA1A1A', bg: '#FFDAD6' },
}

// 失效模式库
export const FM_LIBRARY: { cat: string; items: { mode: string; en: string; s: number; o: number; d: number }[] }[] = [
  { cat: '尺寸特性', items: [
    { mode: '尺寸超差', en: 'Dimension out of tolerance', s: 7, o: 5, d: 5 },
    { mode: '形位公差超差', en: 'Form/position deviation', s: 7, o: 4, d: 5 },
    { mode: '表面粗糙度不合格', en: 'Surface roughness fail', s: 5, o: 4, d: 4 },
  ]},
  { cat: '装配', items: [
    { mode: '漏装零件', en: 'Missing component', s: 8, o: 4, d: 6 },
    { mode: '错装/装反', en: 'Wrong / mis-oriented assembly', s: 8, o: 4, d: 6 },
    { mode: '装配不到位', en: 'Improper seating', s: 7, o: 5, d: 5 },
    { mode: '连接松动', en: 'Loose joint', s: 7, o: 4, d: 5 },
  ]},
  { cat: '外观表面', items: [
    { mode: '划伤/磕碰', en: 'Scratch / dent', s: 4, o: 5, d: 4 },
    { mode: '毛刺/飞边', en: 'Burr / flash', s: 5, o: 5, d: 5 },
    { mode: '外观不良', en: 'Appearance defect', s: 4, o: 4, d: 4 },
  ]},
  { cat: '性能功能', items: [
    { mode: '性能不达标', en: 'Performance not met', s: 8, o: 4, d: 5 },
    { mode: '异响/噪音', en: 'Abnormal noise', s: 6, o: 4, d: 5 },
    { mode: '发热异常', en: 'Overheating', s: 7, o: 3, d: 5 },
    { mode: '密封失效', en: 'Seal failure', s: 8, o: 4, d: 5 },
    { mode: '泄漏', en: 'Leakage', s: 8, o: 3, d: 5 },
  ]},
  { cat: '材料', items: [
    { mode: '材料缺陷', en: 'Material defect', s: 7, o: 3, d: 6 },
    { mode: '混料/错料', en: 'Mixed material', s: 8, o: 3, d: 6 },
    { mode: '变形', en: 'Deformation', s: 6, o: 4, d: 5 },
    { mode: '断裂', en: 'Fracture', s: 9, o: 3, d: 6 },
  ]},
]

export const FM_LABELS: Record<FmListKey, { label: string; en: string }> = {
  effects: { label: '失效后果', en: 'Failure Effect' },
  causes: { label: '失效原因', en: 'Failure Cause' },
  controls: { label: '现行控制', en: 'Current Control' },
  actions: { label: '建议措施', en: 'Recommended Action' },
}

const STORAGE_KEY = 'cc-haha-process-flow'

// ===== 纯函数：RPN 分级 =====
export function rpn(item: Pick<PfmeaItem, 'severity' | 'occurrence' | 'detection'>): number {
  return (item.severity || 0) * (item.occurrence || 0) * (item.detection || 0)
}

export type RiskLevel = 'high' | 'mid' | 'low' | 'zero'

export function rpnLevel(value: number): RiskLevel {
  if (value >= 100) return 'high'
  if (value >= 40) return 'mid'
  if (value >= 1) return 'low'
  return 'zero'
}

export function riskLevelName(value: number): string {
  if (value >= 100) return '高风险'
  if (value >= 40) return '中风险'
  if (value >= 1) return '低风险'
  return '无风险'
}

export function riskTone(value: number): 'error' | 'warning' | 'success' | 'muted' {
  if (value >= 100) return 'error'
  if (value >= 40) return 'warning'
  if (value >= 1) return 'success'
  return 'muted'
}

// ===== 纯函数：流程完整性校验 =====
export type FlowIssue = { kind: 'error' | 'warning'; text: string }

export function validateFlow(nodes: FlowNode[], edges: FlowEdge[]): FlowIssue[] {
  if (nodes.length === 0) return []
  const issues: FlowIssue[] = []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map<string, string[]>()
  const inEdges = new Map<string, string[]>()
  for (const n of nodes) {
    out.set(n.id, [])
    inEdges.set(n.id, [])
  }
  for (const e of edges) {
    out.get(e.from)?.push(e.to)
    inEdges.get(e.to)?.push(e.from)
  }
  const label = (id: string) => {
    const n = byId.get(id)
    return n ? `[${n.stepNo || n.name}] ${n.name}` : id
  }

  const hasStart = nodes.some((n) => n.type === 'start')
  const hasEnd = nodes.some((n) => n.type === 'end')
  if (!hasStart) issues.push({ kind: 'error', text: '缺少起点节点 (Start S)' })
  if (!hasEnd) issues.push({ kind: 'error', text: '缺少结束节点 (End E)' })

  for (const n of nodes) {
    const outs = out.get(n.id) ?? []
    if (outs.length === 0 && n.type !== 'end') {
      issues.push({ kind: 'error', text: `工序 ${label(n.id)} 未连接到结束节点` })
    }
    if (n.type === 'end' && outs.length > 0) {
      issues.push({ kind: 'warning', text: `结束节点 ${label(n.id)} 仍有出边` })
    }
    for (const t of outs) {
      if (byId.get(t)?.type === 'start') {
        issues.push({ kind: 'warning', text: `有连线指向起点节点 ${label(t)}` })
      }
    }
  }

  // 死循环检测（DFS 三色标记）
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const n of nodes) color.set(n.id, WHITE)
  const stack: string[] = []
  const cyclePath: string[] = []
  const dfs = (id: string): boolean => {
    color.set(id, GRAY)
    stack.push(id)
    for (const next of out.get(id) ?? []) {
      if (color.get(next) === GRAY) {
        const cut = stack.indexOf(next)
        cyclePath.push(...stack.slice(cut), next)
        return true
      }
      if (color.get(next) === WHITE && dfs(next)) return true
    }
    stack.pop()
    color.set(id, BLACK)
    return false
  }
  const found = nodes.some((n) => color.get(n.id) === WHITE && dfs(n.id))
  if (found && cyclePath.length > 0) {
    issues.push({ kind: 'error', text: `检测到循环：${cyclePath.map((id) => label(id)).join(' → ')}` })
  }
  return issues
}

// ===== 纯函数：重叠检测 / 子树级联 =====
export function isOverlapping(nodes: FlowNode[], test: FlowNode, nx: number, ny: number, margin = 12): boolean {
  return nodes.some((n) => {
    if (n.id === test.id) return false
    return (
      nx + NODE_W + margin > n.x &&
      nx < n.x + NODE_W + margin &&
      ny + NODE_H + margin > n.y &&
      ny < n.y + NODE_H + margin
    )
  })
}

/** 收集从 root 沿 from→to 出边可达的全部节点 id（含自身） */
export function subtreeNodeIds(edges: FlowEdge[], root: string): Set<string> {
  const out = new Map<string, string[]>()
  for (const e of edges) {
    const list = out.get(e.from) ?? []
    list.push(e.to)
    out.set(e.from, list)
  }
  const seen = new Set<string>()
  const stack = [root]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const next of out.get(id) ?? []) if (!seen.has(next)) stack.push(next)
  }
  return seen
}

export function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/** 流程 CSV（每个节点一行） */
export function buildFlowCsv(nodes: FlowNode[]): string {
  const header = ['Step No.', 'Step Name', 'Symbol Type', 'Product Characteristics', 'Process Parameters', 'Material Input', 'Equipment', 'Special Char', 'Balloon No.', 'PFMEA Linked', 'PFMEA Step', 'Variation']
  const rows = nodes.map((n) => [
    n.stepNo,
    n.name,
    NODE_META[n.type].label,
    n.productChars.join('; '),
    n.processParams.join('; '),
    n.material,
    n.equipment,
    n.specialChar ? 'SC' : '',
    n.balloonNo,
    n.pfmeaLinked ? 'Yes' : 'No',
    n.pfmeaStep,
    n.variation,
  ])
  return [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n')
}

/** PFMEA CSV（每条失效模式一行） */
export function buildFmeaCsv(nodes: FlowNode[]): string {
  const header = ['工步编号', '工序名称', '设备', '失效模式', '失效后果', '严重度S', '失效原因', '频度O', '现行控制', '探测度D', '建议措施', 'RPN', '风险等级']
  const rows: string[][] = []
  for (const n of nodes) {
    for (const fm of n.pfmeas) {
      rows.push([
        n.stepNo,
        n.name,
        n.equipment,
        fm.mode,
        fm.effects.map((i) => i.text).filter(Boolean).join('；'),
        String(fm.severity || 0),
        fm.causes.map((i) => i.text).filter(Boolean).join('；'),
        String(fm.occurrence || 0),
        fm.controls.map((i) => i.text).filter(Boolean).join('；'),
        String(fm.detection || 0),
        fm.actions.map((i) => i.text).filter(Boolean).join('；'),
        String(rpn(fm)),
        riskLevelName(rpn(fm)),
      ])
    }
  }
  return [header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n')
}

// ===== 数据归一化 =====
function mkFmId(): string {
  return `fm${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}
function mkItemId(): string {
  return `it${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function normalizeFmList(raw: unknown): FmListItem[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((it): it is { id?: unknown; text?: unknown } => !!it && typeof it === 'object')
      .map((it) => ({ id: typeof it.id === 'string' ? it.id : mkItemId(), text: String(it.text ?? '') }))
      .filter((it) => it.text !== '' || true)
  }
  return []
}

function normalizePfmea(raw: Partial<PfmeaItem> & { id?: string }): PfmeaItem {
  return {
    id: raw.id || mkFmId(),
    mode: raw.mode ?? '',
    severity: Number(raw.severity) || 0,
    occurrence: Number(raw.occurrence) || 0,
    detection: Number(raw.detection) || 0,
    effects: normalizeFmList(raw.effects),
    causes: normalizeFmList(raw.causes),
    controls: normalizeFmList(raw.controls),
    actions: normalizeFmList(raw.actions),
  }
}

function normalizeNode(raw: Partial<FlowNode> & { id: string }): FlowNode {
  const type = (raw.type && NODE_META[raw.type as FlowNodeType]) ? raw.type as FlowNodeType : 'operation'
  return {
    id: raw.id,
    type,
    name: raw.name ?? NODE_META[type].defaultName,
    code: raw.code ?? '',
    stepNo: raw.stepNo ?? '',
    x: raw.x ?? 0,
    y: raw.y ?? 0,
    desc: raw.desc ?? '',
    equipment: raw.equipment ?? '',
    material: raw.material ?? '',
    specialChar: raw.specialChar ?? false,
    balloonNo: raw.balloonNo ?? '',
    processParams: Array.isArray(raw.processParams) ? raw.processParams : [],
    productChars: Array.isArray(raw.productChars) ? raw.productChars : [],
    pfmeas: Array.isArray(raw.pfmeas) ? raw.pfmeas.map(normalizePfmea) : [],
    pfmeaLinked: raw.pfmeaLinked ?? false,
    pfmeaStep: raw.pfmeaStep ?? '',
    variation: raw.variation ?? '',
  }
}

function loadInitial(): { nodes: FlowNode[]; edges: FlowEdge[]; nextId: number; modeLockState: Record<WorkflowMode, boolean> } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        return {
          nodes: parsed.nodes.map(normalizeNode),
          edges: parsed.edges.map((e: FlowEdge) => ({ id: e.id, from: e.from, to: e.to, label: e.label ?? '' })),
          nextId: typeof parsed.nextId === 'number' ? parsed.nextId : parsed.nodes.length + 1,
          modeLockState: {
            process: parsed.modeLockState?.process ?? false,
            pfmea: parsed.modeLockState?.pfmea ?? false,
            cp: parsed.modeLockState?.cp ?? false,
            wi: parsed.modeLockState?.wi ?? false,
          },
        }
      }
    }
  } catch {
    // ignore
  }
  return { nodes: [], edges: [], nextId: 1, modeLockState: { process: false, pfmea: false, cp: false, wi: false } }
}

const initial = loadInitial()

/**
 * 找出与主流程不连通的节点。锁定前用于检查工艺流程是否形成闭环。
 */
export function findDisconnectedNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (nodes.length <= 1) return []
  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of edges) {
    if (adj.has(e.from)) adj.get(e.from)!.push(e.to)
    if (adj.has(e.to)) adj.get(e.to)!.push(e.from)
  }
  const seen = new Set<string>()
  const stack = [nodes[0]!.id]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const next of adj.get(id) ?? []) {
      if (!seen.has(next)) stack.push(next)
    }
  }
  return nodes.filter((n) => !seen.has(n.id))
}

export type ProcessFlowState = {
  nodes: FlowNode[]
  edges: FlowEdge[]
  nextId: number
  selectedNodeId: string | null
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  mode: WorkflowMode
  modeLockState: Record<WorkflowMode, boolean>
  panX: number
  panY: number
  zoom: number
  addNode: (type: FlowNodeType, x: number, y: number) => void
  updateNode: (id: string, patch: Partial<FlowNode>) => void
  duplicateNode: (id: string) => void
  setNodeType: (id: string, type: FlowNodeType) => void
  toggleSpecialChar: (id: string) => void
  togglePfmeaLinked: (id: string) => void
  removeNode: (id: string) => void
  removeNodes: (ids: string[]) => void
  removeSelected: () => void
  removeOutgoingEdges: (id: string) => void
  connect: (from: string, to: string) => void
  removeEdge: (id: string) => void
  updateEdgeLabel: (id: string, label: string) => void
  beginInteraction: () => void
  endInteraction: () => void
  enforceEdgeGaps: () => void
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  selectNodes: (ids: string[]) => void
  moveNode: (id: string, x: number, y: number) => void
  setView: (panX: number, panY: number, zoom: number) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  autoLayout: () => void
  renumberAll: () => void
  clearCanvas: () => void
  resetView: (viewportW: number, viewportH: number) => void
  // PFMEA
  addPfmea: (nodeId: string, item: Omit<PfmeaItem, 'id'>) => void
  updatePfmea: (nodeId: string, itemId: string, patch: Partial<PfmeaItem>) => void
  removePfmea: (nodeId: string, itemId: string) => void
  addPfmeaItem: (nodeId: string, fmId: string, listKey: FmListKey) => void
  updatePfmeaItem: (nodeId: string, fmId: string, listKey: FmListKey, itemId: string, text: string) => void
  removePfmeaItem: (nodeId: string, fmId: string, listKey: FmListKey, itemId: string) => void
  generatePfmeaFromFlow: () => void
  setMode: (mode: WorkflowMode) => boolean
  toggleLock: (mode: WorkflowMode) => void
  canEnterMode: (mode: WorkflowMode) => boolean
}

type Snapshot = { nodes: FlowNode[]; edges: FlowEdge[]; nextId: number }

const HISTORY_MAX = 50

export const useProcessFlowStore = create<ProcessFlowState>((set, get) => {
  const history: Snapshot[] = []
  const redoStack: Snapshot[] = []
  let suppressHistory = false

  const snapshot = (): Snapshot => ({
    nodes: JSON.parse(JSON.stringify(get().nodes)),
    edges: JSON.parse(JSON.stringify(get().edges)),
    nextId: get().nextId,
  })

  const pushHistory = () => {
    if (suppressHistory) return
    redoStack.length = 0
    history.push(snapshot())
    if (history.length > HISTORY_MAX) history.shift()
  }

  const persist = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          nodes: get().nodes,
          edges: get().edges,
          nextId: get().nextId,
          modeLockState: get().modeLockState,
        }),
      )
    } catch {
      // ignore
    }
  }

  const restore = (snap: Snapshot) => {
    suppressHistory = true
    set({
      nodes: JSON.parse(JSON.stringify(snap.nodes)),
      edges: JSON.parse(JSON.stringify(snap.edges)),
      nextId: snap.nextId,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
    })
    suppressHistory = false
    persist()
  }

  const canEnterMode = (mode: WorkflowMode): boolean => {
    const idx = MODE_ORDER.indexOf(mode)
    if (idx < 0) return true
    for (let i = 0; i < idx; i++) {
      const prev = MODE_ORDER[i]!
      if (!get().modeLockState[prev]) return false
    }
    return true
  }

  const canEditFlow = () => !get().modeLockState.process

  const patchNode = (id: string, fn: (n: FlowNode) => FlowNode, withHistory: boolean, alsoPersist = true) => {
    const apply = () =>
      set((state) => ({ nodes: state.nodes.map((n) => (n.id === id ? fn(n) : n)) }))
    if (withHistory) pushHistory()
    apply()
    if (alsoPersist) persist()
  }

  return {
    ...initial,
    panX: 80,
    panY: 80,
    zoom: 1,
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedEdgeId: null,
    mode: 'process',

    addNode: (type, x, y) => {
      if (!canEditFlow()) return
      pushHistory()
      const meta = NODE_META[type]
      const id = `n${get().nextId}`
      set((state) => ({
        nextId: state.nextId + 1,
        selectedNodeId: id,
        selectedNodeIds: [id],
        selectedEdgeId: null,
        nodes: [
          ...state.nodes,
          normalizeNode({
            id,
            type,
            name: meta.defaultName,
            stepNo: `Op ${(state.nodes.length + 1) * 10}`,
            x,
            y,
          }),
        ],
      }))
      persist()
    },

    updateNode: (id, patch) => {
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      }))
      persist()
    },

    duplicateNode: (id) => {
      if (!canEditFlow()) return
      const src = get().nodes.find((n) => n.id === id)
      if (!src) return
      pushHistory()
      const nid = `n${get().nextId}`
      set((state) => ({
        nextId: state.nextId + 1,
        selectedNodeId: nid,
        selectedNodeIds: [nid],
        selectedEdgeId: null,
        nodes: [
          ...state.nodes,
          {
            ...JSON.parse(JSON.stringify(src)),
            id: nid,
            x: src.x + 30,
            y: src.y + 40,
            stepNo: `Op ${(state.nodes.length + 1) * 10}`,
            pfmeas: [],
          },
        ],
      }))
      persist()
    },

    setNodeType: (id, type) => {
      if (!canEditFlow()) return
      if (!NODE_META[type] || get().nodes.find((n) => n.id === id)?.type === type) return
      patchNode(id, (n) => ({ ...n, type }), true)
    },

    toggleSpecialChar: (id) => {
      if (!canEditFlow()) return
      const cur = get().nodes.find((n) => n.id === id)
      if (!cur) return
      patchNode(
        id,
        (n) => ({ ...n, specialChar: !n.specialChar, balloonNo: n.specialChar ? '' : n.balloonNo }),
        true,
      )
    },

    togglePfmeaLinked: (id) => {
      if (!canEditFlow()) return
      const cur = get().nodes.find((n) => n.id === id)
      if (!cur) return
      patchNode(id, (n) => {
        const linked = !n.pfmeaLinked
        return { ...n, pfmeaLinked: linked, pfmeaStep: linked ? n.stepNo || n.name : '' }
      }, true)
    },

    moveNode: (id, x, y) => {
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
      }))
    },

    removeNode: (id) => {
      if (!canEditFlow()) return
      pushHistory()
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
        edges: state.edges.filter((e) => e.from !== id && e.to !== id),
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
        selectedNodeIds: state.selectedNodeIds.filter((nid) => nid !== id),
      }))
      persist()
    },

    removeNodes: (ids) => {
      if (!canEditFlow()) return
      pushHistory()
      const idSet = new Set(ids)
      set((state) => ({
        nodes: state.nodes.filter((n) => !idSet.has(n.id)),
        edges: state.edges.filter((e) => !idSet.has(e.from) && !idSet.has(e.to)),
        selectedNodeId: state.selectedNodeId && idSet.has(state.selectedNodeId) ? null : state.selectedNodeId,
        selectedNodeIds: state.selectedNodeIds.filter((nid) => !idSet.has(nid)),
      }))
      persist()
    },

    removeSelected: () => {
      const { selectedNodeIds, selectedEdgeId, nodes } = get()
      const ids = selectedNodeIds.filter((id) => nodes.some((n) => n.id === id))
      if (ids.length > 0) {
        get().removeNodes(ids)
      } else if (selectedEdgeId) {
        get().removeEdge(selectedEdgeId)
      }
    },

    removeOutgoingEdges: (id) => {
      if (!canEditFlow()) return
      const before = get().edges.length
      set((state) => ({ edges: state.edges.filter((e) => e.from !== id) }))
      if (get().edges.length !== before) {
        pushHistory()
        persist()
      }
    },

    // 参考实现的单父约束：目标节点只能有一个入边 —— 连接时先移除目标旧入边再新增
    connect: (from, to) => {
      if (!canEditFlow() || from === to) return
      const exists = get().edges.some((e) => e.from === from && e.to === to)
      if (exists) return
      pushHistory()
      const others = get().edges.filter((e) => !(e.to === to))
      set({
        edges: [
          ...others,
          { id: `e${Date.now()}`, from, to, label: '' },
        ],
      })
      persist()
    },

    removeEdge: (id) => {
      if (!canEditFlow()) return
      pushHistory()
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== id),
        selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId,
      }))
      persist()
    },

    updateEdgeLabel: (id, label) => {
      if (!canEditFlow()) return
      const cur = get().edges.find((e) => e.id === id)
      if (!cur || cur.label === label) return
      pushHistory()
      set((state) => ({
        edges: state.edges.map((e) => (e.id === id ? { ...e, label } : e)),
      }))
      persist()
    },

    selectNode: (id) => set({ selectedNodeId: id, selectedNodeIds: id ? [id] : [], selectedEdgeId: null }),
    selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null, selectedNodeIds: [] }),
    selectNodes: (ids) =>
      set({
        selectedNodeIds: ids,
        selectedNodeId: ids[0] ?? null,
        selectedEdgeId: null,
      }),
    setView: (panX, panY, zoom) => set({ panX, panY, zoom }),

    beginInteraction: () => {
      pushHistory()
    },

    endInteraction: () => {
      persist()
    },

    // 拖拽/连接结束后的间距约束修复：垂直净距不足的边，把目标子树整体下推
    enforceEdgeGaps: () => {
      if (!canEditFlow()) return
      const { nodes, edges } = get()
      let changed = false
      const byId = new Map(nodes.map((n) => [n.id, n]))
      for (let iter = 0; iter < 8; iter++) {
        let moved = false
        for (const e of edges) {
          const a = byId.get(e.from)
          const b = byId.get(e.to)
          if (!a || !b) continue
          const gap = b.y - (a.y + NODE_H)
          if (gap < MIN_EDGE_LEN) {
            const dy = MIN_EDGE_LEN - gap
            for (const id of subtreeNodeIds(edges, b.id)) {
              const n = byId.get(id)
              if (n) {
                n.y += dy
                changed = true
                moved = true
              }
            }
          }
        }
        if (!moved) break
        void iter
      }
      if (!changed) return
      set((state) => ({ nodes: state.nodes.map((n) => byId.get(n.id) ?? n) }))
      persist()
    },

    undo: () => {
      if (get().modeLockState.process) return
      if (!get().canUndo()) return
      const cur = snapshot()
      const prev = history.pop()
      if (!prev) return
      redoStack.push(cur)
      restore(prev)
    },

    redo: () => {
      if (get().modeLockState.process) return
      const cur = snapshot()
      const next = redoStack.pop()
      if (!next) return
      history.push(cur)
      restore(next)
    },

    canUndo: () => history.length > 0,
    canRedo: () => redoStack.length > 0,

    // 自动布局：无连线 → 纵向堆叠；单链 → 等距单列；分支 → 分层排列（防交叉）
    autoLayout: () => {
      if (!canEditFlow()) return
      pushHistory()
      const { nodes, edges } = get()
      if (nodes.length === 0) return
      const out = new Map<string, string[]>()
      const inDegree = new Map<string, number>()
      for (const n of nodes) {
        out.set(n.id, [])
        inDegree.set(n.id, 0)
      }
      for (const e of edges) {
        out.get(e.from)?.push(e.to)
        inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1)
      }
      const placed = new Map<string, { x: number; y: number }>()

      // 1) 无连线：纵向堆叠
      if (edges.length === 0) {
        nodes.forEach((n, i) => placed.set(n.id, { x: 0, y: i * (NODE_H + MIN_EDGE_LEN + 4) }))
      } else {
        // 单链判定：边数=n-1、恰一个入度为 0、所有人出/入度 ≤1
        const isChain =
          edges.length === nodes.length - 1 &&
          nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).length === 1 &&
          nodes.every((n) => (out.get(n.id) ?? []).length <= 1 && (inDegree.get(n.id) ?? 0) <= 1)
        if (isChain) {
          let cur = nodes.find((n) => (inDegree.get(n.id) ?? 0) === 0)!
          let i = 0
          while (cur) {
            placed.set(cur.id, { x: 0, y: i * (NODE_H + MIN_EDGE_LEN + 4) })
            const next = out.get(cur.id)?.[0]
            if (!next) break
            cur = nodes.find((n) => n.id === next)!
            i++
          }
        } else {
          // 分支：按最长路径分层
          const visited = new Set<string>()
          const layers = new Map<string, number>()
          const compute = (id: string): number => {
            if (visited.has(id)) return layers.get(id) ?? 0
            visited.add(id)
            const deps = edges.filter((e) => e.to === id).map((e) => e.from)
            const depth = deps.length === 0 ? 0 : Math.max(...deps.map(compute)) + 1
            layers.set(id, depth)
            return depth
          }
          for (const node of nodes) compute(node.id)
          const maxDepth = Math.max(0, ...layers.values())
          const byLayer = new Map<number, string[]>()
          for (const [id, depth] of layers) {
            const list = byLayer.get(depth) ?? []
            list.push(id)
            byLayer.set(depth, list)
          }
          const orderedLayers: string[][] = []
          for (let d = 0; d <= maxDepth; d++) {
            const list = byLayer.get(d) ?? []
            if (d === 0 || orderedLayers.length === 0) {
              orderedLayers.push(list)
              continue
            }
            const prev = orderedLayers[d - 1]!
            const prevIndex = new Map(prev.map((id, i) => [id, i]))
            const score = (id: string): number => {
              const parents = edges.filter((e) => e.to === id).map((e) => e.from)
              if (parents.length === 0) return 0
              const idx = parents.map((p) => prevIndex.get(p) ?? 0)
              return idx.reduce((a, b) => a + b, 0) / idx.length
            }
            orderedLayers.push([...list].sort((a, b) => score(a) - score(b)))
          }
          const GAP_X = 520
          const GAP_Y = 280
          for (let d = 0; d <= maxDepth; d++) {
            const list = orderedLayers[d] ?? []
            const totalW = (list.length - 1) * GAP_X
            list.forEach((id, i) => {
              placed.set(id, { x: -totalW / 2 + i * GAP_X, y: d * GAP_Y })
            })
          }
        }
      }
      set((state) => ({
        nodes: state.nodes.map((n) => ({ ...n, ...(placed.get(n.id) ?? {}) })),
      }))
      persist()
    },

    renumberAll: () => {
      if (!canEditFlow()) return
      pushHistory()
      const nodes = get().nodes.map((n, i) => {
        const stepNo = `Op ${(i + 1) * 10}`
        return {
          ...n,
          stepNo,
          pfmeaStep: n.pfmeaLinked ? stepNo : n.pfmeaStep,
        }
      })
      set({ nodes })
      persist()
    },

    clearCanvas: () => {
      if (!canEditFlow()) return
      pushHistory()
      set({
        nodes: [],
        edges: [],
        selectedNodeId: null,
        selectedNodeIds: [],
        selectedEdgeId: null,
      })
      persist()
    },

    resetView: (viewportW, viewportH) => {
      const { nodes } = get()
      if (nodes.length === 0) {
        set({ panX: viewportW / 2, panY: viewportH / 2, zoom: 1 })
        return
      }
      const xs = nodes.map((n) => n.x)
      const ys = nodes.map((n) => n.y)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const maxX = Math.max(...xs)
      const maxY = Math.max(...ys)
      const pad = 90
      const z = Math.max(
        0.15,
        Math.min(1.2, Math.min((viewportW - pad * 2) / Math.max(1, maxX - minX + 260), (viewportH - pad * 2) / Math.max(1, maxY - minY + 120))),
      )
      set({
        zoom: z,
        panX: (viewportW - (maxX - minX + 260) * z) / 2 - minX * z,
        panY: (viewportH - (maxY - minY + 120) * z) / 2 - minY * z,
      })
    },

    // ===== PFMEA =====
    addPfmea: (nodeId, item) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                pfmeas: [...n.pfmeas, normalizePfmea({ ...item, id: mkFmId() })],
                pfmeaLinked: true,
                pfmeaStep: n.pfmeaStep || n.stepNo || n.name,
              }
            : n,
        ),
      }))
      persist()
    },

    updatePfmea: (nodeId, itemId, patch) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, pfmeas: n.pfmeas.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
            : n,
        ),
      }))
      persist()
    },

    removePfmea: (nodeId, itemId) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, pfmeas: n.pfmeas.filter((it) => it.id !== itemId) } : n,
        ),
      }))
      persist()
    },

    addPfmeaItem: (nodeId, fmId, listKey) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                pfmeas: n.pfmeas.map((fm) =>
                  fm.id === fmId ? { ...fm, [listKey]: [...fm[listKey], { id: mkItemId(), text: '' }] } : fm,
                ),
              }
            : n,
        ),
      }))
      persist()
    },

    updatePfmeaItem: (nodeId, fmId, listKey, itemId, text) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                pfmeas: n.pfmeas.map((fm) =>
                  fm.id === fmId
                    ? { ...fm, [listKey]: fm[listKey].map((it) => (it.id === itemId ? { ...it, text } : it)) }
                    : fm,
                ),
              }
            : n,
        ),
      }))
      persist()
    },

    removePfmeaItem: (nodeId, fmId, listKey, itemId) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                pfmeas: n.pfmeas.map((fm) =>
                  fm.id === fmId ? { ...fm, [listKey]: fm[listKey].filter((it) => it.id !== itemId) } : fm,
                ),
              }
            : n,
        ),
      }))
      persist()
    },

    generatePfmeaFromFlow: () => {
      if (get().modeLockState.pfmea) return
      pushHistory()
      set((state) => ({
        nodes: state.nodes.map((n) => {
          if (n.type !== 'operation' && n.type !== 'inspection') return n
          if (n.pfmeas.length > 0) return { ...n, pfmeaLinked: true, pfmeaStep: n.stepNo || n.name }
          return {
            ...n,
            pfmeaLinked: true,
            pfmeaStep: n.stepNo || n.name,
            pfmeas: [
              {
                id: mkFmId(),
                mode: `${n.name}失效`,
                severity: 0,
                occurrence: 0,
                detection: 0,
                effects: [{ id: mkItemId(), text: '影响下道工序 / 最终产品' }],
                causes: [{ id: mkItemId(), text: '待分析（可点击编辑）' }],
                controls: [],
                actions: [],
              },
            ],
          }
        }),
      }))
      persist()
    },

    // ===== 工作模式 / 锁定 =====
    setMode: (mode) => {
      if (!canEnterMode(mode)) return false
      set({ mode })
      return true
    },

    toggleLock: (mode) => {
      const current = get().modeLockState
      if (current[mode]) {
        const idx = MODE_ORDER.indexOf(mode)
        const downstreamLocked = MODE_ORDER.slice(idx + 1).filter((m) => current[m])
        // 解锁时若后道工序仍锁定，一并解锁（带确认），避免出现"永远无法解锁"的卡死
        const unlockTip = downstreamLocked.length > 0
          ? `（当前 ${MODE_LABELS[mode]} 锁定中，且 ${downstreamLocked.map((m) => MODE_LABELS[m]).join(' → ')} 仍锁定；本次将一并解除）`
          : ''
        if (!window.confirm(`确定要解除「${MODE_LABELS[mode]}」的锁定吗？${unlockTip}\n\n解锁后修改内容可能导致后道工序的匹配关系紊乱，请确认。`)) {
          return
        }
        const next = { ...current }
        for (const m of MODE_ORDER.slice(idx)) next[m] = false
        set({ modeLockState: next })
        persist()
        return
      }
      if (mode === 'process') {
        const disconnected = findDisconnectedNodes(get().nodes, get().edges)
        if (disconnected.length > 0) {
          const names = disconnected.map((n) => n.name || n.id).join('、')
          const ok = window.confirm(`⚠ 工艺流程尚未形成闭环：以下节点未与流程连通：\n${names}\n\n确定仍要锁定吗？`)
          if (!ok) return
        }
      }
      set((state) => ({
        modeLockState: { ...state.modeLockState, [mode]: !state.modeLockState[mode] },
      }))
      persist()
    },

    canEnterMode,
  }
})
