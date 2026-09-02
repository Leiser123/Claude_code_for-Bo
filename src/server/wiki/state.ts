import fs from "node:fs"
import path from "node:path"
import os from "node:os"

// Resolved lazily so tests can redirect HOME / CLAUDE_CONFIG_DIR even when
// this module was already loaded by another test file in the same process.
function getStateFile(): string {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude")
  return path.join(claudeDir, "cc-haha", "wiki-state.json")
}

interface WikiState {
  currentWikiRoot: string
  currentWikiName: string
  repos?: { name: string; path: string }[]
  removedRepoNames?: string[]
}

function ensureDir() {
  const dir = path.dirname(getStateFile())
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readState(): WikiState {
  const stateFile = getStateFile()
  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, "utf-8")) as WikiState
    }
  } catch {
    // ignore
  }
  return { currentWikiRoot: "", currentWikiName: "" }
}

function writeState(state: WikiState) {
  ensureDir()
  fs.writeFileSync(getStateFile(), JSON.stringify(state, null, 2), "utf-8")
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
    const body = (await req.json()) as Partial<WikiState>
    const currentState = readState()
    // Field-level merge: preserve existing repos/removedRepoNames when the
    // request omits them. Callers like loadPage() only persist currentWiki*
    // and must not wipe the linked-repo list stored on disk.
    const newState: WikiState = {
      currentWikiRoot: body.currentWikiRoot ?? currentState.currentWikiRoot,
      currentWikiName: body.currentWikiName ?? currentState.currentWikiName,
      repos: body.repos !== undefined ? body.repos : currentState.repos,
      removedRepoNames:
        body.removedRepoNames !== undefined
          ? body.removedRepoNames
          : currentState.removedRepoNames,
    }
    writeState(newState)
    return Response.json({ success: true, state: newState })
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 })
  }
}
