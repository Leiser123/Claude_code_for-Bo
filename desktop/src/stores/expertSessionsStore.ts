import { create } from 'zustand'

const STORAGE_KEY = 'cc-haha-expert-sessions'

export type ExpertSessionRecord = {
  id: string
  expertId: string
  title: string
  createdAt: number
}

function loadRecords(): ExpertSessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is ExpertSessionRecord =>
        !!entry &&
        typeof entry.id === 'string' &&
        typeof entry.expertId === 'string' &&
        typeof entry.title === 'string',
    )
  } catch {
    return []
  }
}

function persistRecords(records: ExpertSessionRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // 存储不可用时静默失败
  }
}

type ExpertSessionsStore = {
  sessions: ExpertSessionRecord[]
  register: (id: string, expertId: string, title: string) => void
  unregister: (id: string) => void
  updateTitle: (id: string, title: string) => void
  /** 某专家最近一次会话 id */
  latestForExpert: (expertId: string) => string | null
}

export const useExpertSessionsStore = create<ExpertSessionsStore>((set, get) => ({
  sessions: loadRecords(),

  register: (id, expertId, title) => {
    if (get().sessions.some((entry) => entry.id === id)) return
    const next = [{ id, expertId, title, createdAt: Date.now() }, ...get().sessions]
    set({ sessions: next })
    persistRecords(next)
  },

  unregister: (id) => {
    const next = get().sessions.filter((entry) => entry.id !== id)
    set({ sessions: next })
    persistRecords(next)
  },

  updateTitle: (id, title) => {
    const next = get().sessions.map((entry) => (entry.id === id ? { ...entry, title } : entry))
    set({ sessions: next })
    persistRecords(next)
  },

  latestForExpert: (expertId) =>
    get().sessions.find((entry) => entry.expertId === expertId)?.id ?? null,
}))
