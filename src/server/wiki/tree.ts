import fs from "node:fs"
import path from "node:path"

export interface TreeNode {
  name: string
  path: string // relative to wikiRoot
  kind: "file" | "dir"
  children?: TreeNode[]
}

const EXCLUDE_DIRS = new Set(["node_modules", ".git", ".obsidian"])

/**
 * Build a full directory tree from wikiRoot.
 */
export function buildTree(wikiRoot: string): TreeNode {
  if (!fs.existsSync(wikiRoot)) {
    return { name: "", path: "", kind: "dir", children: [] }
  }
  return walk(wikiRoot, wikiRoot, "")
}

function walk(wikiRoot: string, dir: string, rel: string): TreeNode {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith(".") && !EXCLUDE_DIRS.has(e.name))
    .sort(sortEntries)

  const children: TreeNode[] = []
  for (const e of entries) {
    const full = path.join(dir, e.name)
    const nodeRel = rel ? path.join(rel, e.name).split(path.sep).join("/") : e.name
    if (e.isDirectory()) {
      children.push(walk(wikiRoot, full, nodeRel))
    } else {
      children.push({ name: e.name, path: nodeRel, kind: "file" })
    }
  }

  return { name: path.basename(dir), path: rel, kind: "dir", children }
}

/** Dirs first, "index.*" files first within files, then alphabetical. */
function sortEntries(a: fs.Dirent, b: fs.Dirent): number {
  if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
  const aIdx = a.name.startsWith("index.") ? 0 : 1
  const bIdx = b.name.startsWith("index.") ? 0 : 1
  if (aIdx !== bIdx) return aIdx - bIdx
  return a.name.localeCompare(b.name)
}

/**
 * GET /api/wiki/tree
 */
export async function handleTree(getWikiRoot: () => string): Promise<Response> {
  return Response.json(buildTree(getWikiRoot()))
}
