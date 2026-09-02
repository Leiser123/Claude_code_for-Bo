import { create } from 'zustand'
import type { PageResponse, TreeNode } from '../api/wikiClient'
import { wikiApi, auditApi, stateApi } from '../api/wikiClient'

export interface RepoInfo {
  name: string
  path: string
}

export interface RepoItem extends RepoInfo {
  status: 'active' | 'inactive'
}

export interface WikiInfo {
  name: string
  path: string
}

interface WikiState {
  // Page state
  currentPage: PageResponse | null
  currentPath: string
  rawMarkdown: string
  loading: boolean
  error: string | null
  pageContent: PageResponse | null
  isLoading: boolean
  author: string

  // Repo state
  repos: RepoItem[]
  currentRepo: RepoInfo | null
  wikiRootPath: string
  tree: TreeNode | null

  // Wiki state
  currentWiki: string
  multiWikiMode: boolean
  wikis: WikiInfo[]

  // Audit state
  audits: Array<{
    id: string
    severity: 'info' | 'suggest' | 'warn' | 'error'
    author: string
    body: string
    created: string
  }>

  // Page actions
  fetchPage: (path: string) => Promise<void>
  navigateTo: (path: string) => void
  loadPage: (path: string) => Promise<void>
  setCurrentPath: (path: string) => void

  // Repo actions
  fetchRepos: () => Promise<void>
  openRepo: (path: string) => Promise<void>
  createRepo: (name: string) => Promise<void>
  renameRepo: (oldName: string, newName: string) => Promise<void>
  removeRepo: (name: string) => Promise<void>
  switchWiki: (name: string, path?: string) => Promise<void>
  addRepo: (name: string, path: string) => Promise<boolean>
  setActiveRepo: (name: string) => void

  // Tree & audit
  loadTree: () => Promise<void>
  loadAudits: (path: string) => Promise<void>

  // Misc
  initialize: () => Promise<void>
}

// ─── State persistence helpers ──────────────────────────────

async function loadAppState() {
  try {
    return await stateApi.getState()
  } catch { return null }
}

async function saveAppState(data: { currentWikiRoot?: string; currentWikiName?: string; repos?: RepoInfo[]; removedRepoNames?: string[] }) {
  try { await stateApi.saveState(data) } catch {}
}

export const useWikiStore = create<WikiState>((set, get) => ({
  // ─── Initial state ──────────────────────────────────────────

  currentPage: null,
  currentPath: 'wiki/index.md',
  rawMarkdown: '',
  loading: false,
  error: null,
  pageContent: null,
  isLoading: false,
  author: '',
  repos: [],
  currentRepo: null,
  wikiRootPath: '',
  tree: null,
  currentWiki: '',
  multiWikiMode: false,
  wikis: [],
  audits: [],

  // ─── Page actions ───────────────────────────────────────────

  setCurrentPath: (path) => set({ currentPath: path }),

  fetchPage: async (path) => {
    set({ loading: true, error: null, isLoading: true })
    try {
      const data = await wikiApi.getPage(path)
      set({
        currentPath: data.path,
        currentPage: data,
        pageContent: data,
        rawMarkdown: data.raw,
        author: '',
      })
      await get().loadAudits(data.path)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load page'
      set({ error: message, currentPage: null, pageContent: null })
    } finally {
      set({ loading: false, isLoading: false })
    }
  },

  navigateTo: (path) => {
    void get().fetchPage(path)
  },

  loadPage: async (path) => {
    // 页面加载只负责取内容，绝不写持久化状态。旧实现在这里无条件 saveAppState，
    // 启动竞态中（initialize 尚未把 repos 恢复完整）会把 wiki-state.json 的
    // repos 覆盖成空/单仓库列表，造成"重新打开只剩一个知识库"。
    await get().fetchPage(path)
  },

  // ─── Repo actions ───────────────────────────────────────────

  fetchRepos: async () => {
    try {
      const cfg = await wikiApi.getConfig()
      const wikisData = await wikiApi.getWikis()
      const savedState = await loadAppState()
      const removedRepoNames = new Set<string>(
        JSON.parse(localStorage.getItem('wiki-removed-repos') || '[]'),
      )
      const discovered: WikiInfo[] = wikisData.wikis
        .filter((w) => !removedRepoNames.has(w.name))
        .map((w) => ({ name: w.name, path: w.path }))
      const discoveredNames = new Set(discovered.map((w) => w.name))

      // 合并而不是替换：保留用户已打开但不在自动发现目录下的仓库（例如外部文件夹），
      // 除非用户显式移除。除了内存中已有的仓库，还要从服务端固化状态(saveAppState)
      // 恢复外部仓库——fetchRepos 可能在 initialize 之前被其它页面(如 Project 设置)
      // 触发，此时内存 repos 仍为空，若只依赖内存会把外部仓库全部丢掉，表现为
      // "刷新后只剩一个知识库"。
      const current = get()
      const savedExtra: RepoInfo[] = (savedState?.repos ?? []).filter(
        (r) => !discoveredNames.has(r.name) && !removedRepoNames.has(r.name),
      )
      const inMemory: RepoInfo[] = current.repos.filter(
        (r) => !discoveredNames.has(r.name) && !removedRepoNames.has(r.name),
      )
      const keptExternal = [
        ...inMemory,
        ...savedExtra.filter((r) => !inMemory.some((m) => m.name === r.name)),
      ]

      const all: RepoInfo[] = [...keptExternal, ...discovered]
      const currentRepoName =
        all.find((r) => r.name === cfg.wikiRoot)?.name ||
        (current.currentWiki && all.some((r) => r.name === current.currentWiki)
          ? current.currentWiki
          : undefined) ||
        discovered[0]?.name ||
        current.currentWiki
      const currentRepo = all.find((r) => r.name === currentRepoName) ?? null
      const repos: RepoItem[] = all.map((r) => ({
        ...r,
        status: (r.name === currentRepo?.name ? 'active' : 'inactive') as 'active' | 'inactive',
      }))

      set({
        repos,
        currentRepo,
        wikiRootPath: currentRepo?.path || '',
        wikis: discovered,
        currentWiki: currentRepo?.name || '',
        multiWikiMode: all.length > 1,
      })
      if (currentRepo?.path) {
        await get().loadTree()
        await get().loadPage('wiki/index.md')
      }
    } catch {
      // No repos configured
    }
  },

  openRepo: async (path) => {
    try {
      const result = await wikiApi.openWiki(path)
      if (!result.success) {
        set({ error: result.error || 'Failed to open repo' })
        return
      }
      await get().addRepo(result.name, result.path)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to open repo' })
    }
  },

  createRepo: async (name) => {
    try {
      // Default: create in home directory
      const homeDir = (await import('node:os')).homedir()
      const parentPath = `${homeDir}/.claude/cc-haha/knowledge`
      const result = await wikiApi.createWiki(parentPath, name)
      if (!result.success) {
        set({ error: result.error || 'Failed to create repo' })
        return
      }
      await get().addRepo(result.name, result.path)
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create repo' })
    }
  },

  renameRepo: async (oldName, newName) => {
    set((state) => ({
      repos: state.repos.map((r) =>
        r.name === oldName ? { ...r, name: newName } : r
      ),
      currentRepo: state.currentRepo?.name === oldName
        ? { ...state.currentRepo, name: newName }
        : state.currentRepo,
      wikis: state.wikis.map((w) =>
        w.name === oldName ? { ...w, name: newName } : w
      ),
      currentWiki: state.currentWiki === oldName ? newName : state.currentWiki,
    }))
    const state = get()
    await saveAppState({
      currentWikiRoot: state.wikiRootPath,
      currentWikiName: state.currentWiki,
      repos: state.repos.map((r) => ({ name: r.name, path: r.path })),
    })
  },

  removeRepo: async (name) => {
    set((state) => {
      const newRepos = state.repos.filter((r) => r.name !== name)
      const newCurrent = state.currentRepo?.name === name
        ? newRepos[0] || null
        : state.currentRepo
      return {
        repos: newRepos,
        currentRepo: newCurrent,
        currentWiki: newCurrent?.name || '',
        multiWikiMode: newRepos.length > 1,
        wikis: state.wikis.filter((w) => w.name !== name),
      }
    })
    const state = get()
    const removedRepoNames = JSON.parse(localStorage.getItem('wiki-removed-repos') || '[]') as string[]
    if (!removedRepoNames.includes(name)) {
      removedRepoNames.push(name)
      localStorage.setItem('wiki-removed-repos', JSON.stringify(removedRepoNames))
    }
    await saveAppState({
      currentWikiRoot: state.wikiRootPath,
      currentWikiName: state.currentWiki,
      repos: state.repos.map((r) => ({ name: r.name, path: r.path })),
      removedRepoNames,
    })
    if (state.currentRepo) {
      await get().switchWiki(state.currentRepo.name, state.currentRepo.path)
    }
  },

  switchWiki: async (name, path?) => {
    try {
      // 允许只传 name：从已加载的仓库清单里解析路径。
      // RepoManagement 的清单点击只传 name，缺 path 会被服务端以
      // "path is required" 拒绝，导致切换静默失败。
      const repoPath = path || get().repos.find((r) => r.name === name)?.path
      if (!repoPath) return
      const result = await wikiApi.switchWiki(name, repoPath)
      set({
        currentRepo: { name: result.name, path: result.path },
        currentPath: 'wiki/index.md',
        wikiRootPath: result.path,
        currentWiki: result.name,
      })
      set((state) => {
        const existing = state.repos.find((r) => r.name === name)
        if (existing) {
          return {
            repos: state.repos.map((r) => ({
              ...r,
              path: r.name === name ? result.path : r.path,
              status: (r.name === name ? 'active' : 'inactive') as 'active' | 'inactive',
            })),
          }
        }
        return {
          repos: [
            ...state.repos.map((r) => ({ ...r, status: 'inactive' as const })),
            { name, path: result.path, status: 'active' as const },
          ],
          wikis: state.wikis.some((w) => w.name === name)
            ? state.wikis
            : [...state.wikis, { name, path: result.path }],
          multiWikiMode: true,
        }
      })
      await get().loadTree()
      await get().loadPage('wiki/index.md')
      const state = get()
      await saveAppState({
        currentWikiRoot: state.wikiRootPath,
        currentWikiName: state.currentWiki,
        repos: state.repos.map((r) => ({ name: r.name, path: r.path })),
      })
    } catch {
      // switch failed
    }
  },

  addRepo: async (name, path) => {
    try {
      const result = await wikiApi.openWiki(path)
      if (!result.success) return false

      // 如果之前移除了该仓库，现在重新添加则清除移除记录
      const removedRepoNames = JSON.parse(localStorage.getItem('wiki-removed-repos') || '[]') as string[]
      const filtered = removedRepoNames.filter((r) => r !== result.name)
      if (filtered.length !== removedRepoNames.length) {
        localStorage.setItem('wiki-removed-repos', JSON.stringify(filtered))
      }

      set((state) => {
        const existing = state.repos.find((r) => r.name === name)
        if (existing) {
          return {
            repos: state.repos.map((r) =>
              r.name === name
                ? { ...r, path: result.path, status: 'active' as const }
                : { ...r, status: 'inactive' as const }
            ),
            currentRepo: { name: result.name, path: result.path },
            currentWiki: result.name,
            multiWikiMode: true,
          }
        }
        return {
          repos: [
            ...state.repos.map((r) => ({ ...r, status: 'inactive' as const })),
            { name: result.name, path: result.path, status: 'active' as const },
          ],
          currentRepo: { name: result.name, path: result.path },
          currentWiki: result.name,
          multiWikiMode: true,
          wikis: state.wikis.some((w) => w.name === result.name)
            ? state.wikis
            : [...state.wikis, { name: result.name, path: result.path }],
        }
      })
      const state = get()
      await saveAppState({
        currentWikiRoot: state.wikiRootPath,
        currentWikiName: state.currentWiki,
        repos: state.repos.map((r) => ({ name: r.name, path: r.path })),
        removedRepoNames: filtered,
      })
      await get().switchWiki(result.name, result.path)
      return true
    } catch {
      return false
    }
  },

  setActiveRepo: (name) => {
    const repo = get().repos.find((r) => r.name === name)
    if (repo) {
      set({
        currentRepo: { name: repo.name, path: repo.path },
        currentWiki: repo.name,
        repos: get().repos.map((r) => ({
          ...r,
          status: (r.name === name ? 'active' : 'inactive') as 'active' | 'inactive',
        })),
      })
      void get().switchWiki(name, repo.path)
    }
  },

  // ─── Tree & audit ───────────────────────────────────────────

  loadTree: async () => {
    try {
      const tree = await wikiApi.getTree()
      set({ tree })
    } catch {
      // tree loading failed
    }
  },

  loadAudits: async (path) => {
    try {
      const data = await auditApi.getAudits(path)
      set({ audits: data.entries })
    } catch {
      set({ audits: [] })
    }
  },

  // ─── Initialize ─────────────────────────────────────────────

  initialize: async () => {
    try {
      const savedState = await loadAppState()
      const cfg = await wikiApi.getConfig()

      let wikiRootPath = savedState?.currentWikiRoot || cfg.wikiRootPath || ''
      let currentWiki = cfg.wikiRoot || wikiRootPath.split(/[/\\]/).filter(Boolean).pop() || 'wiki'
      // Use saved name only if it's not the full path
      if (savedState?.currentWikiName && savedState.currentWikiName !== savedState.currentWikiRoot) {
        currentWiki = savedState.currentWikiName
      }

      let wikisData
      try {
        wikisData = await wikiApi.getWikis()
      } catch {
        wikisData = { wikis: [] }
      }

      // 读取已被用户移除的仓库名，过滤掉这些仓库
      const removedRepoNames = new Set<string>(
        (savedState?.removedRepoNames || JSON.parse(localStorage.getItem('wiki-removed-repos') || '[]')) as string[]
      )

      const wikis: WikiInfo[] = wikisData.wikis
        .filter((w) => !removedRepoNames.has(w.name))
        .map((w) => ({
          name: w.name,
          path: w.path,
        }))
      let repos: RepoItem[] = wikis.length > 0
        ? wikis.map((w) => ({
            ...w,
            status: (w.name === currentWiki ? 'active' : 'inactive') as 'active' | 'inactive',
          }))
        : wikiRootPath && !removedRepoNames.has(currentWiki)
          ? [{ name: currentWiki, path: wikiRootPath, status: 'active' as const }]
          : []

      // Restore saved repos that the server doesn't return (filter out removed repos)
      if (savedState?.repos && savedState.repos.length > 0) {
        const existingNames = new Set(repos.map((r) => r.name))
        const extraRepos = savedState.repos
          .filter((r) => !existingNames.has(r.name))
          .filter((r) => !removedRepoNames.has(r.name))
          .map((r) => ({
            name: r.name,
            path: r.path,
            status: 'inactive' as const,
          }))
        repos = [...repos, ...extraRepos]
      }

      // 如果当前 wiki 已被移除，切换到第一个可用仓库或清空
      if (removedRepoNames.has(currentWiki)) {
        const firstAvailable = repos[0]
        currentWiki = firstAvailable?.name || ''
        wikiRootPath = firstAvailable?.path || ''
      }

      set({
        wikiRootPath,
        currentWiki,
        currentRepo: currentWiki ? { name: currentWiki, path: wikiRootPath } : null,
        repos,
        wikis,
        multiWikiMode: wikis.length > 1,
      })

      if (wikiRootPath) {
        // Sync the server's wiki root with the restored path
        try { await wikiApi.switchWiki(currentWiki, wikiRootPath) } catch {}
        await get().loadTree()
        await get().loadPage('wiki/index.md')
      }
    } catch {
      // init failed, show empty state
    }
  },
}))
