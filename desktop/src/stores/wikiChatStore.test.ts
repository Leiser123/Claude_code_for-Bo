import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWikiChatStore, CLAUDE_CHAT_SETTINGS_KEY } from './wikiChatStore'
import { settingsApi } from '../api/settings'

const STORAGE_KEY = 'cc-haha-wiki-chat-settings'

vi.mock('../api/settings', () => ({
  settingsApi: {
    getUser: vi.fn(),
    updateUser: vi.fn(),
  },
}))

const mockedGetUser = vi.mocked(settingsApi.getUser)
const mockedUpdateUser = vi.mocked(settingsApi.updateUser)

describe('wikiChatStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockedUpdateUser.mockResolvedValue({ ok: true })
    mockedGetUser.mockResolvedValue({})
    useWikiChatStore.setState({
      systemPrompt: '',
      skillName: null,
      useKnowledgeContext: true,
    })
  })

  it('defaults to knowledge-base retrieval with no prompt or skill', () => {
    const state = useWikiChatStore.getState()
    expect(state.systemPrompt).toBe('')
    expect(state.skillName).toBeNull()
    expect(state.useKnowledgeContext).toBe(true)
  })

  it('persists settings changes to localStorage and ~/.claude/settings.json', () => {
    useWikiChatStore.getState().setSystemPrompt('用通俗语言回答')
    useWikiChatStore.getState().setSkillName('reader')
    useWikiChatStore.getState().setUseKnowledgeContext(false)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored).toEqual({
      systemPrompt: '用通俗语言回答',
      skillName: 'reader',
      useKnowledgeContext: false,
    })

    expect(mockedUpdateUser).toHaveBeenCalledWith({
      [CLAUDE_CHAT_SETTINGS_KEY]: {
        systemPrompt: '用通俗语言回答',
        skillName: 'reader',
        useKnowledgeContext: false,
      },
    })
  })

  it('hydrates settings from ~/.claude/settings.json', async () => {
    mockedGetUser.mockResolvedValue({
      [CLAUDE_CHAT_SETTINGS_KEY]: {
        systemPrompt: '来自 .claude',
        skillName: 'summarizer',
        useKnowledgeContext: false,
      },
    })

    await useWikiChatStore.getState().loadFromClaude()

    const state = useWikiChatStore.getState()
    expect(state.systemPrompt).toBe('来自 .claude')
    expect(state.skillName).toBe('summarizer')
    expect(state.useKnowledgeContext).toBe(false)
    // 同步写回本地存储
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.systemPrompt).toBe('来自 .claude')
  })

  it('ignores malformed values from ~/.claude/settings.json', async () => {
    mockedGetUser.mockResolvedValue({
      [CLAUDE_CHAT_SETTINGS_KEY]: { systemPrompt: 123, skillName: null, useKnowledgeContext: 'yes' },
    })

    await useWikiChatStore.getState().loadFromClaude()

    // 非法字段被丢弃，保留默认值
    expect(useWikiChatStore.getState().systemPrompt).toBe('')
    expect(useWikiChatStore.getState().useKnowledgeContext).toBe(true)
  })

  it('reset restores defaults and persists to ~/.claude/settings.json', () => {
    useWikiChatStore.getState().setSystemPrompt('custom')
    useWikiChatStore.getState().reset()

    const state = useWikiChatStore.getState()
    expect(state.systemPrompt).toBe('')
    expect(state.skillName).toBeNull()
    expect(state.useKnowledgeContext).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy()
  })
})
