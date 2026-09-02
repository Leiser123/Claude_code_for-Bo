import { create } from 'zustand'
import { chatHistoryApi } from '../api/wikiClient'

const STORAGE_KEY = 'cc-haha-knowledge-sessions'

export type KnowledgeSessionRecord = {
  id: string
  title: string
  createdAt: number
}

function loadRecords(): KnowledgeSessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is KnowledgeSessionRecord =>
        !!entry && typeof entry.id === 'string' && typeof entry.title === 'string',
    )
  } catch {
    return []
  }
}

function persistLocal(records: KnowledgeSessionRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // 存储不可用时静默失败
  }
}

// 同步到服务端：固化到 ~/.claude/cc-haha/knowledge/.chat-history.json，
// 刷新或换机器（同配置目录）后依然可以恢复。
function persistToServer(records: KnowledgeSessionRecord[]) {
  void chatHistoryApi
    .saveRecords(records)
    .catch(() => {
      // 服务端不可用时静默失败，本地注册表仍可用
    })
}

type KnowledgeSessionsStore = {
  sessions: KnowledgeSessionRecord[]
  /** 从服务端固化文件加载历史（本地缓存优先，服务端权威） */
  loadFromServer: () => Promise<void>
  register: (id: string, title: string) => void
  unregister: (id: string) => void
  updateTitle: (id: string, title: string) => void
}

export const useKnowledgeSessionsStore = create<KnowledgeSessionsStore>((set, get) => ({
  sessions: loadRecords(),

  loadFromServer: async () => {
    try {
      const { records } = await chatHistoryApi.getRecords()
      if (records.length === 0) return
      // 以服务端为准合并：服务端有而本地没有的补进来，本地多出的保留（防竞态丢记录）
      const current = get().sessions
      const byId = new Map<string, KnowledgeSessionRecord>()
      for (const record of records) byId.set(record.id, record)
      for (const record of current) {
        if (!byId.has(record.id)) byId.set(record.id, record)
      }
      const merged = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt)
      set({ sessions: merged })
      persistLocal(merged)
    } catch {
      // 服务端不可用时使用本地注册表
    }
  },

  register: (id, title) => {
    if (get().sessions.some((entry) => entry.id === id)) return
    const next = [{ id, title, createdAt: Date.now() }, ...get().sessions]
    set({ sessions: next })
    persistLocal(next)
    persistToServer(next)
  },

  unregister: (id) => {
    const next = get().sessions.filter((entry) => entry.id !== id)
    set({ sessions: next })
    persistLocal(next)
    persistToServer(next)
  },

  updateTitle: (id, title) => {
    const next = get().sessions.map((entry) => (entry.id === id ? { ...entry, title } : entry))
    set({ sessions: next })
    persistLocal(next)
    persistToServer(next)
  },
}))
