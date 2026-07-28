import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { setWikiRoot, getWikiRoot } from './index.js'

export interface FileEntry {
  name: string
  relPath: string
  isDirectory: boolean
  size: number
}

export interface OpenWikiResult {
  success: boolean
  name: string
  path: string
  error?: string
}

/**
 * GET /api/wiki/files?path=...
 */
export async function handleListFiles(url: URL): Promise<Response> {
  const dirRaw = url.searchParams.get("path") || ""
  if (!dirRaw) {
    return Response.json({ error: "path query parameter is required" }, { status: 400 })
  }

  const resolved = path.resolve(dirRaw)
  const normalized = path.normalize(resolved)

  if (!fs.existsSync(normalized)) {
    return Response.json({ error: "directory not found", path: normalized }, { status: 404 })
  }

  if (!fs.statSync(normalized).isDirectory()) {
    return Response.json({ error: "path is not a directory", path: normalized }, { status: 400 })
  }

  const entries = fs.readdirSync(normalized, { withFileTypes: true })
  const files: FileEntry[] = entries
    .filter((e) => !e.name.startsWith("."))
    .map((e) => {
      const full = path.join(normalized, e.name)
      let size = 0
      try {
        if (e.isFile()) size = fs.statSync(full).size
      } catch { /* permission issues */ }
      return {
        name: e.name,
        relPath: path.join(dirRaw, e.name).split(path.sep).join("/"),
        isDirectory: e.isDirectory(),
        size,
      }
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  return Response.json({ directory: normalized, files })
}

function getAvailableDrives(): Array<{ name: string; fullPath: string; isDirectory: boolean; size: number }> {
  const drives: Array<{ name: string; fullPath: string; isDirectory: boolean; size: number }> = []
  for (let i = 65; i <= 90; i++) {
    const drive = String.fromCharCode(i) + ":\\"
    try {
      if (fs.existsSync(drive) && fs.statSync(drive).isDirectory()) {
        drives.push({
          name: drive,
          fullPath: drive,
          isDirectory: true,
          size: 0,
        })
      }
    } catch {
      continue
    }
  }
  return drives.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * GET /api/wiki/browse?dir=...
 */
export async function handleBrowseDir(url: URL): Promise<Response> {
  const dirRaw = url.searchParams.get("dir") || ""

  let resolved: string
  const isRoot = !dirRaw || dirRaw === "/" || dirRaw === "root"

  if (isRoot) {
    if (process.platform === "win32") {
      const drives = getAvailableDrives()
      return Response.json({ success: true, currentPath: "root", parentPath: "root", files: drives })
    } else {
      resolved = "/"
    }
  } else {
    resolved = path.resolve(dirRaw)
  }

  if (!fs.existsSync(resolved)) {
    return Response.json({ success: false, error: "directory not found" }, { status: 404 })
  }

  if (!fs.statSync(resolved).isDirectory()) {
    return Response.json({ success: false, error: "path is not a directory" }, { status: 400 })
  }

  const parentPath = path.dirname(resolved)

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(resolved, { withFileTypes: true })
  } catch {
    entries = []
  }

  const files = entries
    .filter((e) => !e.name.startsWith("."))
    .map((e) => {
      const full = path.join(resolved, e.name)
      let size = 0
      try {
        if (e.isFile()) size = fs.statSync(full).size
      } catch {
        size = 0
      }
      return {
        name: e.name,
        fullPath: full,
        isDirectory: e.isDirectory(),
        size,
      }
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  return Response.json({ success: true, currentPath: resolved, parentPath, files })
}

/**
 * POST /api/wiki/open
 */
export async function handleOpenWiki(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { path?: string }
    const folderPath = body.path

    if (!folderPath) {
      return Response.json({ success: false, name: "", path: "", error: "path is required" }, { status: 400 })
    }

    const resolved = path.resolve(folderPath)

    if (!fs.existsSync(resolved)) {
      return Response.json({ success: false, name: "", path: "", error: "directory not found" }, { status: 404 })
    }

    if (!fs.statSync(resolved).isDirectory()) {
      return Response.json({ success: false, name: "", path: "", error: "path is not a directory" }, { status: 400 })
    }

    const wikiDir = path.join(resolved, "wiki")
    if (!fs.existsSync(wikiDir) || !fs.statSync(wikiDir).isDirectory()) {
      return Response.json({ success: false, name: "", path: "", error: "directory does not contain a 'wiki/' subdirectory" }, { status: 400 })
    }

    const name = path.basename(resolved)
    setWikiRoot(resolved)
    return Response.json({ success: true, name, path: resolved })
  } catch {
    return Response.json({ success: false, name: "", path: "", error: "invalid request body" }, { status: 400 })
  }
}

/**
 * POST /api/wiki/create
 */
export async function handleCreateWiki(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { parentPath?: string; name?: string }

    if (!body.parentPath) {
      return Response.json({ success: false, name: "", path: "", error: "parentPath is required" }, { status: 400 })
    }

    if (!body.name || !body.name.trim()) {
      return Response.json({ success: false, name: "", path: "", error: "name is required" }, { status: 400 })
    }

    const resolvedParent = path.resolve(body.parentPath)

    if (!fs.existsSync(resolvedParent)) {
      return Response.json({ success: false, name: "", path: "", error: "parent directory not found" }, { status: 404 })
    }

    if (!fs.statSync(resolvedParent).isDirectory()) {
      return Response.json({ success: false, name: "", path: "", error: "parent path is not a directory" }, { status: 400 })
    }

    const safeName = body.name.trim().replace(/[\\/:*?"<>|]/g, "_")
    const repoPath = path.join(resolvedParent, safeName)

    if (fs.existsSync(repoPath)) {
      return Response.json({ success: false, name: "", path: "", error: "directory already exists" }, { status: 400 })
    }

    execSync(`mkdir "${repoPath}"`, { stdio: "ignore" })
    execSync(`mkdir "${path.join(repoPath, "wiki")}"`, { stdio: "ignore" })
    execSync(`mkdir "${path.join(repoPath, "audit")}"`, { stdio: "ignore" })
    execSync(`mkdir "${path.join(repoPath, "raw")}"`, { stdio: "ignore" })
    execSync(`mkdir "${path.join(repoPath, "outputs")}"`, { stdio: "ignore" })

    const indexContent = `# ${safeName}\n\nWelcome to your new wiki!\n\n## Getting Started\n\nStart adding content to this wiki.\n`
    fs.writeFileSync(path.join(repoPath, "wiki", "index.md"), indexContent, "utf-8")

    setWikiRoot(repoPath)
    return Response.json({ success: true, name: safeName, path: repoPath })
  } catch (err) {
    return Response.json({ success: false, name: "", path: "", error: `failed to create directory: ${(err as Error).message}` }, { status: 500 })
  }
}

/**
 * GET /api/wiki/config
 */
export async function handleWikiConfig(): Promise<Response> {
  return Response.json({ wikiRoot: process.env.WIKI_ROOT || "", wikiRootPath: getWikiRoot() || "" })
}
