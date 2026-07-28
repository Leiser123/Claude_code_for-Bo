/**
 * Wiki API Router — 处理所有 /api/wiki/* 请求
 * 适配 Bun.serve() 格式: (req: Request, url: URL) => Promise<Response>
 */

import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { handleTree } from "./tree.js"
import { handleGraph } from "./graph.js"
import { handlePage, handleRaw } from "./pages.js"
import { handleAuditList, handleAuditCreate, handleAuditResolve } from "./audit.js"
import { handleTranslate, handleTranslateBatch } from "./translate.js"
import { handleListFiles, handleBrowseDir, handleOpenWiki, handleCreateWiki, handleWikiConfig } from "./files.js"
import { handleChat, handleChatStream } from "./chat.js"
import { handleWikis, handleWikiSwitch } from "./wikis.js"
import { handleStateGet, handleStatePost } from "./state.js"
import { handleTranslateConfigGet, handleTranslateConfigPut } from "./translate-config.js"

// ─── Wiki Root 管理 ────────────────────────────────────────────────

let _currentWikiRoot: string = resolveDefaultWikiRoot()

function resolveDefaultWikiRoot(): string {
  // 优先使用环境变量
  if (process.env.WIKI_ROOT) {
    const p = path.resolve(process.env.WIKI_ROOT)
    if (fs.existsSync(p)) return p
  }
  // 默认从 ~/.claude/cc-haha/knowledge/ 取第一个目录
  const knowledgeDir = path.join(os.homedir(), ".claude", "cc-haha", "knowledge")
  if (fs.existsSync(knowledgeDir)) {
    const entries = fs.readdirSync(knowledgeDir, { withFileTypes: true })
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."))
    if (dirs.length > 0) {
      return path.join(knowledgeDir, dirs[0]!.name)
    }
  }
  return ""
}

export function getWikiRoot(): string {
  return _currentWikiRoot
}

export function setWikiRoot(root: string): void {
  _currentWikiRoot = root
}

// ─── Router ────────────────────────────────────────────────────────

export async function handleWikiApi(req: Request, url: URL, _segments: string[]): Promise<Response> {
  const pathname = url.pathname
  const method = req.method
  const segs = pathname.split("/").filter(Boolean) // ['api', 'wiki', 'tree', ...]
  const resource = segs[2]

  // GET /api/wiki/config
  if (resource === "config" && !segs[3]) return handleWikiConfig()

  // GET /api/wiki/wikis, POST /api/wiki/switch
  if (resource === "wikis") return handleWikis()
  if (resource === "switch" && method === "POST") return handleWikiSwitch(req)

  // GET /api/wiki/tree
  if (resource === "tree") return handleTree(getWikiRoot)

  // GET /api/wiki/graph
  if (resource === "graph") return handleGraph(getWikiRoot)

  // GET /api/wiki/page?path=..., GET /api/wiki/raw?path=...
  if (resource === "page") return handlePage(url, getWikiRoot)
  if (resource === "raw") return handleRaw(url, getWikiRoot)

  // GET/POST /api/wiki/audit, PATCH /api/wiki/audit/:id/resolve
  if (resource === "audit" && !segs[3]) {
    if (method === "GET") return handleAuditList(url, getWikiRoot)
    if (method === "POST") return handleAuditCreate(req, getWikiRoot)
  }
  if (resource === "audit" && segs[3] && segs[4] === "resolve" && method === "PATCH") {
    return handleAuditResolve(segs[3], req, getWikiRoot)
  }

  // GET /api/wiki/translate, POST /api/wiki/translate-batch
  if (resource === "translate" && method === "GET") return handleTranslate(url, getWikiRoot)
  if (resource === "translate-batch" && method === "POST") return handleTranslateBatch(req)

  // GET /api/wiki/files, GET /api/wiki/browse
  // POST /api/wiki/open, POST /api/wiki/create
  if (resource === "files") return handleListFiles(url)
  if (resource === "browse") return handleBrowseDir(url)
  if (resource === "open" && method === "POST") return handleOpenWiki(req)
  if (resource === "create" && method === "POST") return handleCreateWiki(req)

  // POST /api/wiki/chat, POST /api/wiki/chat-stream
  if (resource === "chat" && method === "POST" && !segs[3]) return handleChat(req)
  if (resource === "chat-stream" && method === "POST") return handleChatStream(req)

  // GET/POST /api/wiki/state
  if (resource === "state") {
    if (method === "GET") return handleStateGet()
    if (method === "POST") return handleStatePost(req)
  }

  // GET/PUT /api/wiki/translate-config
  if (resource === "translate-config") {
    if (method === "GET") return handleTranslateConfigGet()
    if (method === "PUT") return handleTranslateConfigPut(req)
  }

  return Response.json({ error: "Wiki API endpoint not found" }, { status: 404 })
}
