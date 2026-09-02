import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { setWikiRoot } from './index.js'

function getKnowledgeDir(): string {
  return path.join(os.homedir(), ".claude", "cc-haha", "knowledge")
}

function discoverWikis(): Array<{ name: string; path: string }> {
  const dir = getKnowledgeDir()
  if (!fs.existsSync(dir)) return []

  const wikis: Array<{ name: string; path: string }> = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith(".")) continue
      const wikiPath = path.join(dir, entry.name)
      wikis.push({ name: entry.name, path: wikiPath })
    }
  } catch {
    // ignore
  }
  return wikis.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * GET /api/wiki/wikis
 */
export async function handleWikis(): Promise<Response> {
  const wikis = discoverWikis()
  return Response.json({ wikis })
}

/**
 * POST /api/wiki/switch
 */
export async function handleWikiSwitch(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { name?: string; path?: string }
    const wikiRoot = body.path
    if (!wikiRoot) {
      return Response.json({ error: "path is required" }, { status: 400 })
    }
    const resolved = path.resolve(wikiRoot)
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return Response.json({ error: "wiki directory not found" }, { status: 404 })
    }
    setWikiRoot(resolved)
    return Response.json({ success: true, name: body.name || path.basename(resolved), path: resolved })
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 })
  }
}
