import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

// state.ts resolves the config dir at call time via CLAUDE_CONFIG_DIR (or
// HOME / USERPROFILE), so the environment must be redirected before use.
let tmpDir: string
let originalConfigDir: string | undefined
let originalHome: string | undefined
let originalUserProfile: string | undefined
let stateFile: string
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let stateModule: typeof import('../wiki/state.js')

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-wiki-state-'))
  originalConfigDir = process.env.CLAUDE_CONFIG_DIR
  originalHome = process.env.HOME
  originalUserProfile = process.env.USERPROFILE
  process.env.CLAUDE_CONFIG_DIR = path.join(tmpDir, '.claude')
  process.env.HOME = tmpDir
  process.env.USERPROFILE = tmpDir
  stateFile = path.join(tmpDir, '.claude', 'cc-haha', 'wiki-state.json')
  stateModule = await import('../wiki/state.js')
})

afterAll(async () => {
  if (originalConfigDir !== undefined) process.env.CLAUDE_CONFIG_DIR = originalConfigDir
  else delete process.env.CLAUDE_CONFIG_DIR
  if (originalHome !== undefined) process.env.HOME = originalHome
  else delete process.env.HOME
  if (originalUserProfile !== undefined) process.env.USERPROFILE = originalUserProfile
  else delete process.env.USERPROFILE
  await fs.rm(tmpDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await fs.rm(stateFile, { force: true })
})

function postState(body: unknown): Promise<Response> {
  return stateModule.handleStatePost(
    new Request('http://localhost/api/wiki/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

describe('wiki state persistence', () => {
  it('returns empty state when nothing has been written', async () => {
    const res = await stateModule.handleStateGet()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ currentWikiRoot: '', currentWikiName: '' })
  })

  it('persists repos when provided', async () => {
    await postState({
      currentWikiRoot: '/home/me/wiki-a',
      currentWikiName: 'wiki-a',
      repos: [{ name: 'wiki-a', path: '/home/me/wiki-a' }],
    })

    const res = await stateModule.handleStateGet()
    const body = await res.json()
    expect(body.repos).toEqual([{ name: 'wiki-a', path: '/home/me/wiki-a' }])
  })

  // Regression: loadPage() saves only currentWiki* without repos. The writer
  // must preserve the previously stored repos instead of wiping them.
  it('preserves repos when a subsequent POST omits them', async () => {
    await postState({
      currentWikiRoot: '/home/me/wiki-a',
      currentWikiName: 'wiki-a',
      repos: [{ name: 'wiki-a', path: '/home/me/wiki-a' }],
    })

    // Simulate loadPage(): only currentWiki* fields, no repos.
    await postState({
      currentWikiRoot: '/home/me/wiki-a',
      currentWikiName: 'wiki-a',
    })

    const res = await stateModule.handleStateGet()
    const body = await res.json()
    expect(body.repos).toEqual([{ name: 'wiki-a', path: '/home/me/wiki-a' }])
    expect(body.currentWikiName).toBe('wiki-a')
  })

  it('preserves removedRepoNames when a subsequent POST omits them', async () => {
    await postState({
      currentWikiRoot: '/home/me/wiki-b',
      currentWikiName: 'wiki-b',
      repos: [{ name: 'wiki-b', path: '/home/me/wiki-b' }],
      removedRepoNames: ['old-wiki'],
    })

    await postState({ currentWikiRoot: '/home/me/wiki-b', currentWikiName: 'wiki-b' })

    const body = await (await stateModule.handleStateGet()).json()
    expect(body.removedRepoNames).toEqual(['old-wiki'])
    expect(body.repos).toEqual([{ name: 'wiki-b', path: '/home/me/wiki-b' }])
  })

  it('replaces repos when explicitly provided', async () => {
    await postState({
      currentWikiRoot: '/a',
      currentWikiName: 'a',
      repos: [{ name: 'a', path: '/a' }],
    })
    await postState({
      currentWikiRoot: '/b',
      currentWikiName: 'b',
      repos: [{ name: 'b', path: '/b' }],
    })

    const body = await (await stateModule.handleStateGet()).json()
    expect(body.repos).toEqual([{ name: 'b', path: '/b' }])
    expect(body.currentWikiName).toBe('b')
  })
})
