import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useProcessFlowStore,
  findDisconnectedNodes,
  validateFlow,
  rpnLevel,
  riskLevelName,
  buildFlowCsv,
  buildFmeaCsv,
  isOverlapping,
  subtreeNodeIds,
  NODE_W,
  NODE_H,
  type FlowNodeType,
} from './processFlowStore'

function node(id: string, name: string, x: number, y: number) {
  return {
    id,
    type: 'operation' as const,
    name,
    code: '',
    stepNo: `Op ${x}`,
    x,
    y,
    desc: '',
    equipment: '',
    material: '',
    specialChar: false,
    balloonNo: '',
    processParams: [],
    productChars: [],
    pfmeas: [],
    pfmeaLinked: false,
    pfmeaStep: '',
    variation: '',
  }
}

describe('processFlowStore multi-select', () => {
  beforeEach(() => {
    localStorage.clear()
    useProcessFlowStore.setState({
      nodes: [node('n1', 'A', 0, 0), node('n2', 'B', 200, 0), node('n3', 'C', 400, 0)],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: '' },
        { id: 'e2', from: 'n2', to: 'n3', label: '' },
      ],
      nextId: 4,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      mode: 'process',
      modeLockState: { process: false, pfmea: false, cp: false, wi: false },
    })
  })

  it('selectNodes selects multiple nodes; removeSelected deletes them all together with their edges', () => {
    useProcessFlowStore.getState().selectNodes(['n1', 'n2'])
    expect(useProcessFlowStore.getState().selectedNodeIds).toEqual(['n1', 'n2'])
    expect(useProcessFlowStore.getState().selectedNodeId).toBe('n1')

    useProcessFlowStore.getState().removeSelected()

    const state = useProcessFlowStore.getState()
    expect(state.nodes.map((n) => n.id)).toEqual(['n3'])
    // 与已删节点相连的边一并删除（e1、e2 都触及 n1/n2）
    expect(state.edges.map((e) => e.id)).toEqual([])
    expect(state.selectedNodeIds).toEqual([])
  })

  it('undo restores a batch deletion as a single step', () => {
    useProcessFlowStore.getState().selectNodes(['n1', 'n3'])
    useProcessFlowStore.getState().removeSelected()
    expect(useProcessFlowStore.getState().nodes.length).toBe(1)

    useProcessFlowStore.getState().undo()
    expect(useProcessFlowStore.getState().nodes.length).toBe(3)
    expect(useProcessFlowStore.getState().selectedNodeIds).toEqual([])
  })

  it('selectNode collapses the selection back to a single node', () => {
    useProcessFlowStore.getState().selectNodes(['n1', 'n2'])
    useProcessFlowStore.getState().selectNode('n3')
    expect(useProcessFlowStore.getState().selectedNodeIds).toEqual(['n3'])
    expect(useProcessFlowStore.getState().selectedEdgeId).toBeNull()
  })

  it('selectEdge clears the node selection', () => {
    useProcessFlowStore.getState().selectNodes(['n1', 'n2'])
    useProcessFlowStore.getState().selectEdge('e1')
    expect(useProcessFlowStore.getState().selectedNodeIds).toEqual([])
    expect(useProcessFlowStore.getState().selectedEdgeId).toBe('e1')
  })

  it('moveNode during a drag does not write localStorage every step (persist only on endInteraction)', () => {
    const before = localStorage.getItem('cc-haha-process-flow')
    useProcessFlowStore.getState().moveNode('n1', 100, 100)
    const during = localStorage.getItem('cc-haha-process-flow')
    expect(during).toBe(before)

    useProcessFlowStore.getState().endInteraction()
    const after = localStorage.getItem('cc-haha-process-flow')
    expect(after).not.toBeNull()
    expect(JSON.parse(after!).nodes.find((n: { id: string }) => n.id === 'n1').x).toBe(100)
  })
})

describe('processFlowStore closure check & auto layout', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('findDisconnectedNodes returns nodes outside the main connected component', () => {
    const nodes = [node('n1', 'A', 0, 0), node('n2', 'B', 200, 0), node('n3', 'C', 400, 0)]
    const edges = [{ id: 'e1', from: 'n1', to: 'n2', label: '' }]
    expect(findDisconnectedNodes(nodes, edges).map((n) => n.name)).toEqual(['C'])
    expect(findDisconnectedNodes(nodes, [{ id: 'e1', from: 'n1', to: 'n2', label: '' }, { id: 'e2', from: 'n2', to: 'n3', label: '' }])).toEqual([])
    // 只有一个节点时视为闭环（无内容可断）
    expect(findDisconnectedNodes([node('n1', 'A', 0, 0)], [])).toEqual([])
  })

  it('autoLayout arranges layers top-to-bottom with at least one card-width gap between cards', () => {
    useProcessFlowStore.setState({
      nodes: [node('n1', 'A', 0, 0), node('n2', 'B', 0, 0), node('n3', 'C', 0, 0), node('n4', 'D', 0, 0)],
      edges: [
        { id: 'e1', from: 'n1', to: 'n3', label: '' },
        { id: 'e2', from: 'n2', to: 'n3', label: '' },
        { id: 'e3', from: 'n3', to: 'n4', label: '' },
      ],
      nextId: 5,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      mode: 'process',
      modeLockState: { process: false, pfmea: false, cp: false, wi: false },
    })

    useProcessFlowStore.getState().autoLayout()

    const placed = Object.fromEntries(useProcessFlowStore.getState().nodes.map((n) => [n.id, n])) as Record<string, ReturnType<typeof node>>
    // 从上往下：n1/n2(层0) 在 n3(层1) 之上，n3 在 n4(层2) 之上
    expect(placed.n1!.y).toBeLessThan(placed.n3!.y)
    expect(placed.n3!.y).toBeLessThan(placed.n4!.y)
    // 同层（n1、n2）中心间距至少一个卡片宽度(240*2=480)
    expect(Math.abs(placed.n1!.x - placed.n2!.x)).toBeGreaterThanOrEqual(480)
  })

  it('blocks locking process mode when the flow is not closed', () => {
    const confirmMock = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirmMock)
    useProcessFlowStore.setState({
      nodes: [node('n1', 'A', 0, 0), node('n2', 'B', 200, 0), node('n3', 'C', 400, 0)],
      edges: [{ id: 'e1', from: 'n1', to: 'n2', label: '' }],
      nextId: 4,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      mode: 'process',
      modeLockState: { process: false, pfmea: false, cp: false, wi: false },
    })

    useProcessFlowStore.getState().toggleLock('process')

    expect(confirmMock).toHaveBeenCalled()
    expect(useProcessFlowStore.getState().modeLockState.process).toBe(false)
    vi.unstubAllGlobals()
  })

  it('locks process mode without prompting when the flow is fully connected', () => {
    const confirmMock = vi.fn()
    vi.stubGlobal('confirm', confirmMock)
    useProcessFlowStore.setState({
      nodes: [node('n1', 'A', 0, 0), node('n2', 'B', 200, 0)],
      edges: [{ id: 'e1', from: 'n1', to: 'n2', label: '' }],
      nextId: 3,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      mode: 'process',
      modeLockState: { process: false, pfmea: false, cp: false, wi: false },
    })

    useProcessFlowStore.getState().toggleLock('process')

    expect(confirmMock).not.toHaveBeenCalled()
    expect(useProcessFlowStore.getState().modeLockState.process).toBe(true)
    vi.unstubAllGlobals()
  })
})

describe('processFlowStore new reference logic', () => {
  function base(id: string, name: string, type: FlowNodeType = 'operation') {
    return { ...node(id, name, 0, 0), type }
  }

  it('rpnLevel / riskLevelName classify risk thresholds', () => {
    expect(rpnLevel(0)).toBe('zero')
    expect(rpnLevel(39)).toBe('low')
    expect(rpnLevel(40)).toBe('mid')
    expect(rpnLevel(99)).toBe('mid')
    expect(rpnLevel(100)).toBe('high')
    expect(riskLevelName(100)).toBe('高风险')
    expect(riskLevelName(0)).toBe('无风险')
  })

  it('validateFlow reports missing start/end, unconnected leaves and cycles', () => {
    const n1 = base('n1', 'A', 'operation')
    const n2 = base('n2', 'B', 'operation')
    const issues = validateFlow([n1, n2], [{ id: 'e1', from: 'n1', to: 'n2', label: '' }])
    const texts = issues.map((i) => i.text)
    expect(texts.some((t) => t.includes('缺少起点'))).toBe(true)
    expect(texts.some((t) => t.includes('缺少结束'))).toBe(true)

    // 带 start/end 且首尾相连：无错误
    const s = base('s', '来料', 'start')
    const e = base('e', '出货', 'end')
    const okIssues = validateFlow(
      [s, n1, n2, e],
      [
        { id: 'e1', from: 's', to: 'n1', label: '' },
        { id: 'e2', from: 'n1', to: 'n2', label: '' },
        { id: 'e3', from: 'n2', to: 'e', label: '' },
      ],
    )
    expect(okIssues).toEqual([])

    // 死循环检测
    const cyc = validateFlow(
      [n1, n2],
      [
        { id: 'e1', from: 'n1', to: 'n2', label: '' },
        { id: 'e2', from: 'n2', to: 'n1', label: '' },
      ],
    )
    expect(cyc.some((i) => i.kind === 'error' && i.text.includes('循环'))).toBe(true)
  })

  it('isOverlapping honors node size and margin; subtreeNodeIds collects downstream', () => {
    const a = base('n1', 'A')
    const b = { ...base('n2', 'B'), x: NODE_W + 200, y: 0 }
    // a 移到 b 位置附近 → 重叠；留出 60px 间距 → 不重叠
    expect(isOverlapping([a, b], b, b.x, b.y)).toBe(false)
    expect(isOverlapping([a, b], a, b.x - NODE_W - 60, b.y)).toBe(false)
    expect(isOverlapping([a, b], a, b.x - 50, b.y)).toBe(true)
    const edges = [
      { id: 'e1', from: 'n1', to: 'n2', label: '' },
      { id: 'e2', from: 'n2', to: 'n3', label: '' },
      { id: 'e3', from: 'n9', to: 'n3', label: '' },
    ]
    expect([...subtreeNodeIds(edges, 'n1').values()].sort()).toEqual(['n1', 'n2', 'n3'])
    void NODE_H
  })

  it('connect removes the target old incoming edge (single-parent constraint)', () => {
    useProcessFlowStore.setState({
      nodes: [base('n1', 'A'), base('n2', 'B'), base('n3', 'C')],
      edges: [{ id: 'e1', from: 'n1', to: 'n2', label: '' }],
      nextId: 4,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      mode: 'process',
      modeLockState: { process: false, pfmea: false, cp: false, wi: false },
    })
    useProcessFlowStore.getState().connect('n3', 'n2')
    const edges = useProcessFlowStore.getState().edges
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ from: 'n3', to: 'n2' })
  })

  it('removeOutgoingEdges clears output before rewiring', () => {
    useProcessFlowStore.setState({
      nodes: [base('n1', 'A'), base('n2', 'B'), base('n3', 'C')],
      edges: [
        { id: 'e1', from: 'n1', to: 'n2', label: '' },
        { id: 'e2', from: 'n1', to: 'n3', label: '' },
      ],
      nextId: 4,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      mode: 'process',
      modeLockState: { process: false, pfmea: false, cp: false, wi: false },
    })
    useProcessFlowStore.getState().removeOutgoingEdges('n1')
    expect(useProcessFlowStore.getState().edges).toEqual([])
  })

  it('renumberAll / updateEdgeLabel / PFMEA item ops mutate as expected', () => {
    const store = useProcessFlowStore.getState()
    store.addNode('operation', 0, 0)
    store.addNode('inspection', 0, 200)
    const ids = useProcessFlowStore.getState().nodes.map((n) => n.id)
    store.renumberAll()
    const numbered = useProcessFlowStore.getState().nodes
    expect(numbered[0]!.stepNo).toBe('Op 10')
    expect(numbered[1]!.stepNo).toBe('Op 20')

    store.connect(ids[0]!, ids[1]!)
    const edgeId = useProcessFlowStore.getState().edges[0]!.id
    store.updateEdgeLabel(edgeId, '流转')
    expect(useProcessFlowStore.getState().edges[0]!.label).toBe('流转')

    store.addPfmea(ids[0]!, { mode: '尺寸超差', severity: 7, occurrence: 5, detection: 5, effects: [], causes: [], controls: [], actions: [] })
    const fm = useProcessFlowStore.getState().nodes.find((n) => n.id === ids[0])!.pfmeas[0]!
    expect(fm.effects).toEqual([])
    store.addPfmeaItem(ids[0]!, fm.id, 'effects')
    store.addPfmeaItem(ids[0]!, fm.id, 'causes')
    let node = useProcessFlowStore.getState().nodes.find((n) => n.id === ids[0])!
    const effectItem = node.pfmeas[0]!.effects[0]!
    store.updatePfmeaItem(ids[0]!, fm.id, 'effects', effectItem.id, '影响下道工序')
    node = useProcessFlowStore.getState().nodes.find((n) => n.id === ids[0])!
    expect(node.pfmeas[0]!.effects[0]!.text).toBe('影响下道工序')
    store.removePfmeaItem(ids[0]!, fm.id, 'causes', node.pfmeas[0]!.causes[0]!.id)
    expect(useProcessFlowStore.getState().nodes.find((n) => n.id === ids[0])!.pfmeas[0]!.causes).toEqual([])
  })

  it('autoLayout stacks nodes vertically when no edges exist', () => {
    useProcessFlowStore.setState({
      nodes: [base('n1', 'A'), base('n2', 'B')],
      edges: [],
      nextId: 3,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      mode: 'process',
      modeLockState: { process: false, pfmea: false, cp: false, wi: false },
    })
    useProcessFlowStore.getState().autoLayout()
    const stacked = useProcessFlowStore.getState().nodes
    expect(stacked[0]!.x).toBe(stacked[1]!.x)
    expect(stacked[1]!.y).toBeGreaterThan(stacked[0]!.y)
  })

  it('unlocking a mode also unlocks locked downstream modes (no dead-lock)', () => {
    const confirmMock = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirmMock)
    useProcessFlowStore.setState({
      nodes: [base('n1', 'A'), base('n2', 'B')],
      edges: [{ id: 'e1', from: 'n1', to: 'n2', label: '' }],
      nextId: 3,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      mode: 'process',
      modeLockState: { process: false, pfmea: false, cp: false, wi: false },
    })
    const store = useProcessFlowStore.getState()
    store.toggleLock('process')
    store.toggleLock('pfmea')
    expect(useProcessFlowStore.getState().modeLockState.process).toBe(true)
    expect(useProcessFlowStore.getState().modeLockState.pfmea).toBe(true)

    // 解锁 Process Flow 时 PFMEA 仍锁定 —— 应一并解除，而不是弹"无法解锁"
    useProcessFlowStore.getState().toggleLock('process')
    const state = useProcessFlowStore.getState()
    expect(state.modeLockState.process).toBe(false)
    expect(state.modeLockState.pfmea).toBe(false)
    vi.unstubAllGlobals()
  })

  it('buildFlowCsv and buildFmeaCsv quote values with BOM-safe content', () => {
    const n1 = { ...base('n1', '冲压'), stepNo: 'Op 10', productChars: ['A', 'B'], specialChar: true }
    const csv = buildFlowCsv([n1])
    expect(csv).toContain('"Step No."')
    expect(csv).toContain('"A; B"')
    expect(csv).toContain('"SC"')

    const fmNode = {
      ...base('n2', '绕线'),
      stepNo: 'Op 20',
      pfmeas: [
        {
          id: 'fm1',
          mode: '匝数超差',
          severity: 7,
          occurrence: 5,
          detection: 5,
          effects: [{ id: 'x', text: '性能不达标' }],
          causes: [{ id: 'y', text: '张力波动' }],
          controls: [],
          actions: [],
        },
      ],
    }
    const fcsv = buildFmeaCsv([fmNode])
    expect(fcsv).toContain('匝数超差')
    expect(fcsv).toContain('张力波动')
    expect(fcsv).toContain('175')
    expect(fcsv).toContain('高风险')
  })
})
