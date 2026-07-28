import fs from "node:fs"
import path from "node:path"

export interface GraphNode {
  id: string
  label: string
  path: string
  group: string
  degree: number
  title: string | null
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g

export function buildGraph(wikiRoot: string): GraphData {
  if (!fs.existsSync(wikiRoot)) return { nodes: [], edges: [] }

  const files = collectMdFiles(wikiRoot)

  const byKey: Map<string, string> = new Map()
  const nodes: Map<string, GraphNode> = new Map()

  for (const f of files) {
    const relFromRoot = path.relative(wikiRoot, f).split(path.sep).join("/")
    const id = relFromRoot
    const stem = path.basename(f, ".md")
    // Determine group: skip leading "wiki/" prefix so that
    // "wiki/concepts/file.md" → group "concepts", not "wiki"
    const groupPath = relFromRoot.startsWith("wiki/") ? relFromRoot.slice(5) : relFromRoot
    const parts = groupPath.split("/")
    const group = parts.length > 1 ? parts[0]! : "other"
    const title = extractTitle(fs.readFileSync(f, "utf-8")) ?? stem

    const node: GraphNode = {
      id,
      label: stem,
      path: id,
      group,
      degree: 0,
      title,
    }
    nodes.set(id, node)
    byKey.set(stem, id)
    byKey.set(relFromRoot.replace(/\.md$/, ""), id)
    byKey.set(stem.toLowerCase(), id)
    // Also add key without leading "wiki/" prefix for matching wikilinks that omit it
    const withoutWiki = relFromRoot.replace(/^wiki\//, "").replace(/\.md$/, "")
    if (withoutWiki !== stem) byKey.set(withoutWiki, id)
  }

  const edges: GraphEdge[] = []
  const seenEdges = new Set<string>()
  for (const f of files) {
    const relFromRoot = path.relative(wikiRoot, f).split(path.sep).join("/")
    const srcId = relFromRoot
    const text = fs.readFileSync(f, "utf-8")
    WIKILINK_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = WIKILINK_RE.exec(text))) {
      const target = m[1]!.trim()
      if (target.startsWith("#")) continue
      const tgtId =
        byKey.get(target) ??
        byKey.get(target.replace(/\.md$/, "")) ??
        byKey.get(target.toLowerCase())
      if (!tgtId || tgtId === srcId) continue

      const key = `${srcId}→${tgtId}`
      if (seenEdges.has(key)) continue
      seenEdges.add(key)
      edges.push({ source: srcId, target: tgtId })

      nodes.get(srcId)!.degree += 1
      nodes.get(tgtId)!.degree += 1
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
  }
}

function collectMdFiles(dir: string): string[] {
  const wikiDir = path.join(dir, "wiki")
  if (!fs.existsSync(wikiDir)) return []
  const out: string[] = []
  for (const e of fs.readdirSync(wikiDir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue
    const full = path.join(wikiDir, e.name)
    if (e.isDirectory()) out.push(...collectMdFilesRecursive(full))
    else if (e.isFile() && e.name.endsWith(".md")) out.push(full)
  }
  return out
}

function collectMdFilesRecursive(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...collectMdFilesRecursive(full))
    else if (e.isFile() && e.name.endsWith(".md")) out.push(full)
  }
  return out
}

function extractTitle(text: string): string | null {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text)
  if (fm) {
    const t = /^title:\s*(.+)$/m.exec(fm[1]!)
    if (t) return t[1]!.trim().replace(/^["']|["']$/g, "")
  }
  const h1 = /^#\s+(.+?)\s*$/m.exec(text)
  return h1 ? h1[1]! : null
}

/**
 * GET /api/wiki/graph
 */
export async function handleGraph(getWikiRoot: () => string): Promise<Response> {
  return Response.json(buildGraph(getWikiRoot()))
}
