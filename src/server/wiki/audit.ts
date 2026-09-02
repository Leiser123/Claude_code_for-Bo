import fs from "node:fs"
import path from "node:path"
import {
  computeAnchor,
  filenameFor,
  fromMarkdown,
  makeId,
  toMarkdown,
  type AuditEntry,
  type Severity,
  VALID_SEVERITIES,
} from "./audit-shared.js"

/**
 * GET /api/wiki/audit?target=...&mode=...
 */
export async function handleAuditList(url: URL, getWikiRoot: () => string): Promise<Response> {
  const wikiRoot = getWikiRoot()
  const target = url.searchParams.get("target") ?? undefined
  const mode = url.searchParams.get("mode") ?? "open"

  const entries: AuditEntry[] = []
  const dirs: string[] = []
  if (mode === "open" || mode === "all") dirs.push(path.join(wikiRoot, "audit"))
  if (mode === "resolved" || mode === "all") dirs.push(path.join(wikiRoot, "audit/resolved"))

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".md")) continue
      const full = path.join(dir, name)
      if (!fs.statSync(full).isFile()) continue
      try {
        const text = fs.readFileSync(full, "utf-8")
        const entry = fromMarkdown(text)
        if (target && entry.target !== target) continue
        entries.push(entry)
      } catch (err) {
        console.warn(`skipping malformed audit ${full}: ${String(err)}`)
      }
    }
  }

  entries.sort((a, b) => a.created.localeCompare(b.created))
  return Response.json({ entries })
}

/**
 * POST /api/wiki/audit
 */
export async function handleAuditCreate(req: Request, getWikiRoot: () => string): Promise<Response> {
  const wikiRoot = getWikiRoot()
  try {
    const body = (await req.json()) as {
      target?: string
      rawMarkdown?: string
      selStart?: number
      selEnd?: number
      comment?: string
      severity?: string
      author?: string
    }

    if (!body.target || typeof body.target !== "string") {
      return Response.json({ error: "target is required" }, { status: 400 })
    }
    if (!body.rawMarkdown || typeof body.rawMarkdown !== "string") {
      return Response.json({ error: "rawMarkdown is required" }, { status: 400 })
    }
    if (typeof body.selStart !== "number" || typeof body.selEnd !== "number") {
      return Response.json({ error: "selStart and selEnd must be numbers" }, { status: 400 })
    }
    if (!body.comment || !body.comment.trim()) {
      return Response.json({ error: "comment is required" }, { status: 400 })
    }
    if (!body.severity || !VALID_SEVERITIES.includes(body.severity as Severity)) {
      return Response.json({ error: `severity must be one of ${VALID_SEVERITIES.join(", ")}` }, { status: 400 })
    }

    const targetFull = path.join(wikiRoot, body.target)
    if (!fs.existsSync(targetFull) || !fs.statSync(targetFull).isFile()) {
      return Response.json({ error: "target file not found", target: body.target }, { status: 404 })
    }

    const anchor = computeAnchor(body.rawMarkdown, body.selStart, body.selEnd)

    const id = makeId()
    const slug = body.comment.trim().split(/\s+/).slice(0, 5).join(" ")
    const filename = filenameFor(id, slug)
    const auditDir = path.join(wikiRoot, "audit")
    fs.mkdirSync(auditDir, { recursive: true })
    const outPath = path.join(auditDir, filename)

    const entry: AuditEntry = {
      id,
      target: body.target,
      target_lines: anchor.target_lines,
      anchor_before: anchor.anchor_before,
      anchor_text: anchor.anchor_text,
      anchor_after: anchor.anchor_after,
      severity: body.severity as Severity,
      author: (body.author && body.author.trim()) || "anonymous",
      source: "web-viewer",
      created: new Date().toISOString(),
      status: "open",
      body: `# Comment\n\n${body.comment.trim()}\n\n# Resolution\n\n<!-- filled in when the audit is processed -->\n`,
    }

    fs.writeFileSync(outPath, toMarkdown(entry), "utf-8")
    return Response.json({ id, filename, path: path.relative(wikiRoot, outPath).split(path.sep).join("/"), entry })
  } catch (err) {
    console.error("failed to create audit", err)
    return Response.json({ error: "failed to create audit", detail: String(err) }, { status: 500 })
  }
}

/**
 * PATCH /api/wiki/audit/:id/resolve
 */
export async function handleAuditResolve(id: string, req: Request, getWikiRoot: () => string): Promise<Response> {
  const wikiRoot = getWikiRoot()
  try {
    if (!id || !/^\d{8}-\d{6}-[0-9a-f]{4}$/.test(id)) {
      return Response.json({ error: "invalid id" }, { status: 400 })
    }
    const body = (await req.json()) as { resolution?: string }
    const resolution = body.resolution

    const openDir = path.join(wikiRoot, "audit")
    const resolvedDir = path.join(wikiRoot, "audit/resolved")
    fs.mkdirSync(resolvedDir, { recursive: true })

    const candidate = fs.readdirSync(openDir).find((f) => f.startsWith(id))
    if (!candidate) {
      return Response.json({ error: "no open audit with that id" }, { status: 404 })
    }
    const openPath = path.join(openDir, candidate)
    const text = fs.readFileSync(openPath, "utf-8")
    const entry = fromMarkdown(text)

    const today = new Date().toISOString().slice(0, 10)
    const newBody = replaceResolution(
      entry.body,
      `${today} · accepted.\n${(resolution ?? "").trim() || "(no details)"}\n`,
    )
    const resolvedEntry: AuditEntry = { ...entry, status: "resolved", body: newBody }

    const resolvedPath = path.join(resolvedDir, candidate)
    fs.writeFileSync(resolvedPath, toMarkdown(resolvedEntry), "utf-8")
    fs.unlinkSync(openPath)
    return Response.json({ id, from: openPath, to: resolvedPath })
  } catch (err) {
    console.error("failed to resolve audit", err)
    return Response.json({ error: "failed to resolve audit", detail: String(err) }, { status: 500 })
  }
}

function replaceResolution(body: string, newBlock: string): string {
  const re = /# Resolution[\s\S]*$/
  if (re.test(body)) {
    return body.replace(re, `# Resolution\n\n${newBlock}`)
  }
  return `${body.trimEnd()}\n\n# Resolution\n\n${newBlock}`
}
