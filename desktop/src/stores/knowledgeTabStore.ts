import { create } from 'zustand'

export type KnowledgeTabType = 'wiki' | 'graph' | 'repo' | 'import'

export type KnowledgeTab = {
  sessionId: string
  title: string
  type: KnowledgeTabType
  path?: string
}

type KnowledgeTabStore = {
  tabs: KnowledgeTab[]
  activeTabId: string | null
  openTab: (sessionId: string, title: string, type: KnowledgeTabType, path?: string) => void
  closeTab: (sessionId: string) => void
  setActiveTab: (sessionId: string) => void
}

export const useKnowledgeTabStore = create<KnowledgeTabStore>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (sessionId, title, type, path) => {
    const { tabs } = get()
    const existing = tabs.find((t) => t.sessionId === sessionId)
    let newTabs: KnowledgeTab[]
    let newActiveId: string

    const updatedTab = { ...(existing ?? { sessionId, title, type, path }), title, type, ...(path ? { path } : {}) } as KnowledgeTab
    if (existing) {
      // 已存在的标签移到第一个位置
      newTabs = [updatedTab, ...tabs.filter((t) => t.sessionId !== sessionId)]
      newActiveId = sessionId
    } else {
      newTabs = [updatedTab, ...tabs]
      newActiveId = sessionId
    }

    set({ tabs: newTabs, activeTabId: newActiveId })
  },

  closeTab: (sessionId) => {
    const { tabs, activeTabId } = get()
    const index = tabs.findIndex((t) => t.sessionId === sessionId)
    if (index < 0) return

    const newTabs = tabs.filter((t) => t.sessionId !== sessionId)
    let newActiveId = activeTabId

    if (activeTabId === sessionId) {
      if (newTabs.length === 0) {
        newActiveId = null
      } else if (index >= newTabs.length) {
        newActiveId = newTabs[newTabs.length - 1]!.sessionId
      } else {
        newActiveId = newTabs[index]!.sessionId
      }
    }

    set({ tabs: newTabs, activeTabId: newActiveId })
  },

  setActiveTab: (sessionId) => {
    set({ activeTabId: sessionId })
  },
}))
