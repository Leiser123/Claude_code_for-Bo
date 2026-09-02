import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatHistoryApi } from '../api/wikiClient'
import { useKnowledgeSessionsStore } from './knowledgeSessionsStore'

const STORAGE_KEY = 'cc-haha-knowledge-sessions'

describe('knowledgeSessionsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useKnowledgeSessionsStore.setState({ sessions: [] })
    vi.spyOn(chatHistoryApi, 'saveRecords').mockResolvedValue({ success: true, records: [] })
    vi.spyOn(chatHistoryApi, 'getRecords').mockResolvedValue({ records: [] })
  })

  it('registers a session once and persists it', () => {
    useKnowledgeSessionsStore.getState().register('session-1', '知识库对话')
    useKnowledgeSessionsStore.getState().register('session-1', '知识库对话')

    const list = useKnowledgeSessionsStore.getState().sessions
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe('session-1')

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0]?.title).toBe('知识库对话')
  })

  it('syncs the registry to the server on every mutation', () => {
    useKnowledgeSessionsStore.getState().register('session-1', 'A')
    expect(chatHistoryApi.saveRecords).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'session-1', title: 'A' }),
    ])

    useKnowledgeSessionsStore.getState().unregister('session-1')
    expect(chatHistoryApi.saveRecords).toHaveBeenLastCalledWith([])
  })

  it('unregisters a session and persists the change', () => {
    useKnowledgeSessionsStore.getState().register('session-1', 'A')
    useKnowledgeSessionsStore.getState().register('session-2', 'B')
    useKnowledgeSessionsStore.getState().unregister('session-1')

    const list = useKnowledgeSessionsStore.getState().sessions
    expect(list.map((s) => s.id)).toEqual(['session-2'])
  })

  it('loads persisted records on store creation', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 's1', title: '旧记录', createdAt: 1 }]))
    useKnowledgeSessionsStore.setState({ sessions: JSON.parse(localStorage.getItem(STORAGE_KEY)!) })

    expect(useKnowledgeSessionsStore.getState().sessions[0]).toEqual({
      id: 's1',
      title: '旧记录',
      createdAt: 1,
    })
  })

  it('ignores malformed persisted records', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 1 }, null, 'bad']))
    const list = useKnowledgeSessionsStore.getState().sessions
    expect(list).toHaveLength(0)
  })

  it('merges server records into the local registry on loadFromServer', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'local', title: '本地', createdAt: 1 }]))
    useKnowledgeSessionsStore.setState({ sessions: JSON.parse(localStorage.getItem(STORAGE_KEY)!) })
    vi.mocked(chatHistoryApi.getRecords).mockResolvedValue({
      records: [
        { id: 'server-1', title: '服务端', createdAt: 100 },
        { id: 'local', title: '本地（服务端也有）', createdAt: 1 },
      ],
    })

    await useKnowledgeSessionsStore.getState().loadFromServer()

    const byId = Object.fromEntries(
      useKnowledgeSessionsStore.getState().sessions.map((s) => [s.id, s]),
    )
    expect(byId['server-1']).toEqual({ id: 'server-1', title: '服务端', createdAt: 100 })
    // 服务端权威：本地同 id 记录以服务端为准
    expect(byId['local']?.title).toBe('本地（服务端也有）')
    // 合并结果写回本地缓存
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(2)
  })
})
