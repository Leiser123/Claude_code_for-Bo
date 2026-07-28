import { api } from './client'

// ─── Type definitions ─────────────────────────────────────────────

export interface PageResponse {
  id: string
  path: string
  title: string
  content: string
  html: string
  raw: string
  frontmatter: Record<string, unknown> | null
  contentType?: 'markdown' | 'html' | 'text' | 'json' | 'image' | 'pdf'
  fileName?: string
  fileUrl?: string
}

export interface WikiInfo {
  name: string
  path: string
}

export interface WikisResponse {
  wikis: WikiInfo[]
  current: { name: string; path: string }
  multiWikiMode: boolean
}

export interface TreeNode {
  name: string
  path: string
  kind: 'file' | 'dir'
  children?: TreeNode[]
}

export interface GraphNode {
  id: string
  label: string
  path: string
  group: string
  degree: number
  title: string | null
}

export interface GraphEdge {
  source: string | GraphNode
  target: string | GraphNode
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface BrowseEntry {
  name: string
  fullPath: string
  isDirectory: boolean
  size: number
}

export interface BrowseResponse {
  success: boolean
  currentPath: string
  parentPath: string
  files: BrowseEntry[]
  error?: string
}

export interface AuditEntry {
  id: string
  severity: 'info' | 'suggest' | 'warn' | 'error'
  author: string
  body: string
  created: string
}

// ─── Helper: transform backend page to client PageResponse ───────

function toPageResponse(data: {
  path: string
  title: string | null
  html: string
  raw: string
  frontmatter: Record<string, unknown> | null
  contentType?: string
  fileName?: string
  fileUrl?: string
}): PageResponse {
  return {
    id: data.path,
    path: data.path,
    title: data.title || data.path.split('/').pop()?.replace(/\.md$/, '') || 'Untitled',
    content: data.raw,
    html: data.html,
    raw: data.raw,
    frontmatter: data.frontmatter,
    contentType: data.contentType as PageResponse['contentType'],
    fileName: data.fileName,
    fileUrl: data.fileUrl,
  }
}

// ─── Wiki API client ─────────────────────────────────────────────

export const wikiApi = {
  getConfig: () =>
    api.get<{ author?: string; wikiRoot: string; multiWikiMode: boolean; wikiRootPath?: string }>('/api/wiki/config'),

  getWikis: () =>
    api.get<WikisResponse>('/api/wiki/wikis'),

  switchWiki: (name: string, path?: string) =>
    api.post<{ success: boolean; name: string; path: string }>('/api/wiki/switch', { name, path }),

  getTree: () =>
    api.get<TreeNode>('/api/wiki/tree'),

  getPage: async (path: string): Promise<PageResponse> => {
    const data = await api.get<{
      path: string
      title: string | null
      html: string
      raw: string
      frontmatter: Record<string, unknown> | null
      contentType?: string
      fileName?: string
      fileUrl?: string
    }>(`/api/wiki/page?path=${encodeURIComponent(path)}`)
    return toPageResponse(data)
  },

  openWiki: (folderPath: string) =>
    api.post<{ success: boolean; name: string; path: string; error?: string }>('/api/wiki/open', { path: folderPath }),

  createWiki: (parentPath: string, name: string) =>
    api.post<{ success: boolean; name: string; path: string; error?: string }>('/api/wiki/create', { parentPath, name }),

  browseDir: async (dirPath?: string): Promise<BrowseResponse> => {
    return api.get<BrowseResponse>(
      dirPath ? `/api/wiki/browse?dir=${encodeURIComponent(dirPath)}` : '/api/wiki/browse',
    )
  },

  /** Alias for component compatibility */
  browse: (path?: string) => wikiApi.browseDir(path),
}

// ─── Audit API client ────────────────────────────────────────────

export const auditApi = {
  getAudits: (targetPath: string) =>
    api.get<{ entries: AuditEntry[] }>(`/api/wiki/audit?target=${encodeURIComponent(targetPath)}&mode=open`),

  createAudit: (data: {
    target: string
    rawMarkdown: string
    selStart: number
    selEnd: number
    comment: string
    severity: 'info' | 'suggest' | 'warn' | 'error'
    author: string
  }) => api.post<{ id: string }>('/api/wiki/audit', data),

  resolveAudit: (id: string, resolution: string) =>
    api.patch<{ success: boolean }>(`/api/wiki/audit/${id}/resolve`, { resolution }),

  /** Simplified: list all audit entries for a repo */
  list: async (_repoName: string): Promise<Array<{
    id: string
    severity: 'error' | 'warning' | 'info'
    message: string
    author: string
    timestamp: string
    resolved: boolean
    pageId?: string
    pageTitle?: string
  }>> => {
    const res = await api.get<{ entries: AuditEntry[] }>('/api/wiki/audit?mode=all')
    return res.entries.map((e) => ({
      id: e.id,
      severity: (e.severity === 'warn' ? 'warning' : e.severity === 'suggest' ? 'info' : e.severity) as 'error' | 'warning' | 'info',
      message: e.body.replace(/^#\s*Comment\s*/i, '').trim(),
      author: e.author,
      timestamp: e.created,
      resolved: false,
    }))
  },

  /** Simplified: resolve by id */
  resolve: async (entryId: string): Promise<void> => {
    await auditApi.resolveAudit(entryId, '')
  },
}

// ─── Graph API client ────────────────────────────────────────────

export const graphApi = {
  getGraph: () => api.get<GraphData>('/api/wiki/graph'),
  translateBatch: (texts: string[], to: string) =>
    api.post<{ translations: Record<string, string> }>('/api/wiki/translate-batch', { texts, to }),
}

// ─── Translate API client ────────────────────────────────────────

export const translateApi = {
  translatePage: (path: string, to: string, from?: string) =>
    api.get<{ html: string }>(
      `/api/wiki/translate?path=${encodeURIComponent(path)}&to=${to}${from ? `&from=${from}` : ''}`,
    ),
}

// ─── State API client ─────────────────────────────────────────────

export const stateApi = {
  getState: () => api.get<{ currentWikiRoot: string; currentWikiName: string; repos?: WikiInfo[]; removedRepoNames?: string[] }>('/api/wiki/state'),
  saveState: (state: { currentWikiRoot?: string; currentWikiName?: string; repos?: WikiInfo[]; removedRepoNames?: string[] }) =>
    api.post<{ success: boolean }>('/api/wiki/state', state),
}
