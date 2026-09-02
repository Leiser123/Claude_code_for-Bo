import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { auditApi, stateApi, wikiApi } from '../api/wikiClient'
import { useWikiStore } from './wikiStore'

vi.mock('../api/wikiClient', () => ({
  wikiApi: {
    getConfig: vi.fn(),
    getWikis: vi.fn(),
    getTree: vi.fn(),
    getPage: vi.fn(),
    openWiki: vi.fn(),
    createWiki: vi.fn(),
    switchWiki: vi.fn(),
  },
  auditApi: { getAudits: vi.fn() },
  stateApi: { getState: vi.fn(), saveState: vi.fn() },
}))

// 独立的内存版 localStorage，保证测试不依赖 jsdom / Node 内建的实现
function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
  } as Storage
}

const externalRepo = { name: 'glue-wiki', path: 'C:/Users/me/Desktop/glue-wiki' }

describe('wikiStore.fetchRepos', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    useWikiStore.setState({
      repos: [],
      currentRepo: null,
      wikiRootPath: '',
      currentWiki: '',
      wikis: [],
      multiWikiMode: false,
      currentPage: null,
      tree: null,
    })
    vi.mocked(wikiApi.getConfig).mockResolvedValue({ wikiRoot: '', wikiRootPath: '', multiWikiMode: false })
    vi.mocked(wikiApi.getWikis).mockResolvedValue({ wikis: [], current: { name: '', path: '' }, multiWikiMode: false })
    vi.mocked(wikiApi.getTree).mockResolvedValue({ name: 'wiki', path: 'wiki', kind: 'dir', children: [] })
    vi.mocked(wikiApi.getPage).mockResolvedValue({
      id: 'wiki/index.md',
      path: 'wiki/index.md',
      title: 'Index',
      content: '',
      html: '',
      raw: '# Index',
      frontmatter: null,
      contentType: 'markdown',
    })
    vi.mocked(auditApi.getAudits).mockResolvedValue({ entries: [] })
    vi.mocked(stateApi.saveState).mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps user-opened external repos when the discovery refresh finds new wikis', async () => {
    useWikiStore.setState({
      repos: [
        { ...externalRepo, status: 'active' as const },
        { name: 'norm-wiki', path: 'C:/Users/me/Desktop/norm-wiki', status: 'inactive' as const },
      ],
      currentWiki: externalRepo.name,
      currentRepo: { name: externalRepo.name, path: externalRepo.path },
    })
    vi.mocked(wikiApi.getWikis).mockResolvedValue({
      wikis: [
        { name: 'A', path: 'C:/kb/A' },
        { name: 'B', path: 'C:/kb/B' },
      ],
      current: { name: 'A', path: 'C:/kb/A' },
      multiWikiMode: true,
    })

    await useWikiStore.getState().fetchRepos()

    const repos = useWikiStore.getState().repos
    expect(repos.map((r) => r.name)).toEqual([externalRepo.name, 'norm-wiki', 'A', 'B'])
    // 当前仓库仍保持用户正在维护的外部仓库
    expect(useWikiStore.getState().currentWiki).toBe(externalRepo.name)
    expect(useWikiStore.getState().repos.find((r) => r.name === externalRepo.name)?.status).toBe('active')
  })

  it('does not re-add a repo the user removed even if it is discovered again', async () => {
    localStorage.setItem('wiki-removed-repos', JSON.stringify(['A']))
    useWikiStore.setState({
      repos: [{ ...externalRepo, status: 'active' as const }],
      currentWiki: externalRepo.name,
      currentRepo: { name: externalRepo.name, path: externalRepo.path },
    })
    vi.mocked(wikiApi.getWikis).mockResolvedValue({
      wikis: [
        { name: 'A', path: 'C:/kb/A' },
        { name: 'B', path: 'C:/kb/B' },
      ],
      current: { name: 'B', path: 'C:/kb/B' },
      multiWikiMode: true,
    })

    await useWikiStore.getState().fetchRepos()

    const names = useWikiStore.getState().repos.map((r) => r.name)
    expect(names).toContain(externalRepo.name)
    expect(names).toContain('B')
    expect(names).not.toContain('A')
  })

  it('returns only discovered wikis when nothing is open yet', async () => {
    vi.mocked(wikiApi.getWikis).mockResolvedValue({
      wikis: [{ name: 'A', path: 'C:/kb/A' }],
      current: { name: 'A', path: 'C:/kb/A' },
      multiWikiMode: false,
    })

    await useWikiStore.getState().fetchRepos()

    expect(useWikiStore.getState().repos.map((r) => r.name)).toEqual(['A'])
    expect(useWikiStore.getState().currentWiki).toBe('A')
  })
})

describe('wikiStore.loadPage must not persist state', () => {
  beforeEach(() => {
    // 服务端持久化了两条外部仓库（非自动发现目录）
    vi.mocked(stateApi.getState).mockResolvedValue({
      currentWikiRoot: externalRepo.path,
      currentWikiName: externalRepo.name,
      repos: [
        externalRepo,
        { name: 'norm-wiki', path: 'C:/Users/me/Desktop/norm-wiki' },
      ],
      removedRepoNames: [],
    })
    vi.mocked(wikiApi.getWikis).mockResolvedValue({
      wikis: [],
      current: { name: '', path: '' },
      multiWikiMode: false,
    })
  })

  it('a page load during startup must not overwrite the persisted repo list', async () => {
    // 复现启动竞态：仓库尚未从持久化恢复时，路由器先触发一次页面加载。
    // 旧实现会在这里用空/不完整的 repos 覆盖 wiki-state.json，
    // 导致"重新打开只剩一个知识库"。
    const earlyLoad = useWikiStore.getState().loadPage('wiki/index.md')
    await useWikiStore.getState().initialize()
    await earlyLoad

    // initialize 恢复出全部仓库
    const names = useWikiStore.getState().repos.map((r) => r.name)
    expect(names).toEqual([externalRepo.name, 'norm-wiki'])

    // 页面加载与初始化恢复都是只读的；持久化只能由仓库操作触发
    expect(vi.mocked(stateApi.saveState).mock.calls).toHaveLength(0)
  })
})

describe('wikiStore.switchWiki path resolution', () => {
  it('resolves the repo path from the store when no path is given', async () => {
    useWikiStore.setState({
      repos: [
        { name: 'A', path: 'C:/kb/A', status: 'active' as const },
        { name: 'B', path: 'C:/kb/B', status: 'inactive' as const },
      ],
      currentWiki: 'A',
      currentRepo: { name: 'A', path: 'C:/kb/A' },
      wikiRootPath: 'C:/kb/A',
      tree: { name: 'wiki', path: 'wiki', kind: 'dir', children: [] },
    })
    vi.mocked(wikiApi.switchWiki).mockResolvedValue({ success: true, name: 'B', path: 'C:/kb/B' })

    await useWikiStore.getState().switchWiki('B')

    expect(wikiApi.switchWiki).toHaveBeenCalledWith('B', 'C:/kb/B')
    expect(useWikiStore.getState().currentWiki).toBe('B')
  })
})
