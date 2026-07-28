import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const STATE_FILE = path.join(os.homedir(), ".claude", "cc-haha", "wiki-state.json")

interface WikiState {
  currentWikiRoot: string
  currentWikiName: string
  repos?: { name: string; path: string }[]
  removedRepoNames?: string[]
}

function ensureDir() {
  const dir = path.dirname(STATE_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readState(): WikiState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as WikiState
    }
  } catch {
    // ignore
  }
  return { currentWikiRoot: "", currentWikiName: "" }
}

function writeState(state: WikiState) {
  ensureDir()
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8")
}

/**
 * GET /api/wiki/state
 */
export async function handleStateGet(): Promise<Response> {
  const state = readState()
  return Response.json(state)
}

/**
 * POST /api/wiki/state
 */
export async function handleStatePost(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as Partial<WikiState & { repos?: { name: string; path: string }[]; removedRepoNames?: string[] }>
    const currentState = readState()
    const newState: WikiState = {
      currentWikiRoot: body.currentWikiRoot ?? currentState.currentWikiRoot,
      currentWikiName: body.currentWikiName ?? currentState.currentWikiName,
    }
    // Persist optional fields when provided
    if (body.repos !== undefined) {
      (newState as any).repos = body.repos
    }
    if (body.removedRepoNames !== undefined) {
      (newState as any).removedRepoNames = body.removedRepoNames
    }
    writeState(newState)
    return Response.json({ success: true, state: newState })
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 })
  }
}
