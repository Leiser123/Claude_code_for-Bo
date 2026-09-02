import { create } from 'zustand'
import { settingsApi } from '../api/settings'

const STORAGE_KEY = 'cc-haha-wiki-chat-settings'
/** 写入 ~/.claude/settings.json 的命名空间键 */
export const CLAUDE_CHAT_SETTINGS_KEY = 'knowledgeChat'

export type WikiChatSettings = {
  /** 用户自定义系统提示词，附加在默认提示词之后 */
  systemPrompt: string
  /** 选中的 skill 名称（空 = 不使用 skill） */
  skillName: string | null
  /** 以当前知识库路径为检索依据，把检索到的页面内容一并提供给模型 */
  useKnowledgeContext: boolean
}

const DEFAULT_SETTINGS: WikiChatSettings = {
  systemPrompt: '',
  skillName: null,
  useKnowledgeContext: true,
}

function loadLocalSettings(): WikiChatSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<WikiChatSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function persistLocal(settings: WikiChatSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 存储不可用时静默失败，不影响聊天功能
  }
}

function sanitizeFromClaude(value: unknown): Partial<WikiChatSettings> | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const next: Partial<WikiChatSettings> = {}
  if (typeof raw.systemPrompt === 'string') next.systemPrompt = raw.systemPrompt
  if (typeof raw.skillName === 'string') next.skillName = raw.skillName
  if (typeof raw.useKnowledgeContext === 'boolean') next.useKnowledgeContext = raw.useKnowledgeContext
  return Object.keys(next).length > 0 ? next : null
}

type WikiChatStore = WikiChatSettings & {
  setSystemPrompt: (value: string) => void
  setSkillName: (value: string | null) => void
  setUseKnowledgeContext: (value: boolean) => void
  /** 从 ~/.claude/settings.json 读取并合并已固化的配置 */
  loadFromClaude: () => Promise<void>
  /** 将当前配置固化到 ~/.claude/settings.json */
  saveToClaude: () => Promise<void>
  reset: () => void
}

export const useWikiChatStore = create<WikiChatStore>((set, get) => ({
  ...loadLocalSettings(),

  setSystemPrompt: (value) => {
    set({ systemPrompt: value })
    persistLocal(get())
    void get().saveToClaude()
  },

  setSkillName: (value) => {
    set({ skillName: value })
    persistLocal(get())
    void get().saveToClaude()
  },

  setUseKnowledgeContext: (value) => {
    set({ useKnowledgeContext: value })
    persistLocal(get())
    void get().saveToClaude()
  },

  loadFromClaude: async () => {
    try {
      const user = await settingsApi.getUser()
      const stored = sanitizeFromClaude(user?.[CLAUDE_CHAT_SETTINGS_KEY])
      if (!stored) return
      const merged = { ...get(), ...stored }
      set(stored)
      persistLocal(merged)
    } catch {
      // 读取失败时沿用本地配置
    }
  },

  saveToClaude: async () => {
    const { systemPrompt, skillName, useKnowledgeContext } = get()
    try {
      await settingsApi.updateUser({
        [CLAUDE_CHAT_SETTINGS_KEY]: { systemPrompt, skillName, useKnowledgeContext },
      })
    } catch {
      // 写入 .claude 失败时静默处理
    }
  },

  reset: () => {
    set(DEFAULT_SETTINGS)
    persistLocal(DEFAULT_SETTINGS)
    void get().saveToClaude()
  },
}))
