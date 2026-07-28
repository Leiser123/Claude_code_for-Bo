import { create } from 'zustand'
import type { GraphNode, GraphEdge, GraphData } from '../api/wikiClient'
import { graphApi } from '../api/wikiClient'

interface GraphState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  data: GraphData | null
  labels: string[]
  loading: boolean
  error: string | null
  isOpen: boolean
  setOpen: (open: boolean) => void
  loadGraph: () => Promise<void>
  fetchGraph: () => Promise<void>
  translateLabels: (to: string) => Promise<void>
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  data: null,
  labels: [],
  loading: false,
  error: null,
  isOpen: false,

  setOpen: (open) => set({ isOpen: open }),

  loadGraph: async () => {
    set({ loading: true, error: null })
    try {
      const data = await graphApi.getGraph()
      const labels = data.nodes.map((n) => n.title || n.label)
      set({ data, nodes: data.nodes, edges: data.edges, labels })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load graph' })
    } finally {
      set({ loading: false })
    }
  },

  fetchGraph: async () => {
    const state = useGraphStore.getState()
    await state.loadGraph()
  },

  translateLabels: async (to) => {
    const state = useGraphStore.getState()
    if (!state.labels.length) return
    try {
      const data = await graphApi.translateBatch(state.labels, to)
      if (state.data) {
        const updatedNodes = state.data.nodes.map((n) => ({
          ...n,
          title: data.translations[n.title || n.label] || n.title,
        }))
        const newData = { ...state.data, nodes: updatedNodes }
        set({ data: newData, nodes: updatedNodes })
      }
    } catch {
      // translation failed
    }
  },
}))
