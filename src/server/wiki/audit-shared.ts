/**
 * audit-shared 内联版本。
 * schema/anchor/id/serialize 合并到一个文件中，避免额外依赖。
 */

import { stringify, parse } from "yaml"

// ─── Schema ────────────────────────────────────────────────────────

export const VALID_SEVERITIES = ["info", "suggest", "warn", "error"] as const
export type Severity = (typeof VALID_SEVERITIES)[number]

export const VALID_SOURCES = ["obsidian-plugin", "web-viewer", "manual"] as const
export type AuditSource = (typeof VALID_SOURCES)[number]

export const VALID_STATUSES = ["open", "resolved"] as const
export type AuditStatus = (typeof VALID_STATUSES)[number]

export interface Anchor {
  target_lines: [number, number]
  anchor_before: string
  anchor_text: string
  anchor_after: string
}

export interface AuditEntry {
  id: string
  target: string
  target_lines: [number, number]
  anchor_before: string
  anchor_text: string
  anchor_after: string
  severity: Severity
  author: string
  source: AuditSource
  created: string
  status: AuditStatus
  body: string
}

export const CONTEXT_CHARS = 80

// ─── ID ────────────────────────────────────────────────────────────

/**
 * Generate an audit id of the form: YYYYMMDD-HHMMSS-<4hex>.
 * Local time. Collision probability is negligible for single-user use.
 */
export function makeId(now: Date = new Date()): string {
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  const ss = String(now.getSeconds()).padStart(2, "0")
  const rand = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0")
  return `${y}${mo}${d}-${hh}${mm}${ss}-${rand}`
}

/**
 * Derive a short filesystem-safe slug from a string.
 */
export function slugify(input: string, maxLen = 30): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, maxLen)
    .replace(/^-+|-+$/g, "")
}

export function filenameFor(id: string, slug?: string): string {
  if (!slug) return `${id}.md`
  const cleaned = slugify(slug)
  return cleaned ? `${id}-${cleaned}.md` : `${id}.md`
}

// ─── Serialize ─────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/

/**
 * Render an AuditEntry as the full markdown file contents
 * (YAML frontmatter + body).
 */
export function toMarkdown(entry: AuditEntry): string {
  const { body, ...front } = entry
  const yml = stringify(front, {
    lineWidth: 0,
    sortKeys: false,
  })
  const bodyText = body && body.trim().length > 0 ? body : defaultBody()
  return `---\n${yml}---\n\n${bodyText.trimEnd()}\n`
}

/**
 * Parse the full markdown contents of an audit file back into an AuditEntry.
 */
export function fromMarkdown(text: string): AuditEntry {
  const m = FRONTMATTER_RE.exec(text)
  if (!m) {
    throw new Error("audit file is missing YAML frontmatter (no leading --- block)")
  }
  const frontRaw = parse(m[1]!) as Record<string, unknown>
  const body = (m[2] ?? "").replace(/^\n/, "")
  return {
    ...frontRaw,
    body,
  } as AuditEntry
}

function defaultBody(): string {
  return `# Comment\n\n<!-- describe the feedback here -->\n\n# Resolution\n\n<!-- filled in when the audit is processed -->\n`
}

// ─── Anchor ────────────────────────────────────────────────────────

/**
 * Compute an anchor from a file's full text and a selection range
 * (character offsets, 0-indexed, selEnd exclusive).
 */
export function computeAnchor(
  fileText: string,
  selStart: number,
  selEnd: number,
  context = CONTEXT_CHARS,
): Anchor {
  if (selStart < 0 || selEnd > fileText.length || selStart >= selEnd) {
    throw new Error(
      `computeAnchor: invalid range [${selStart}, ${selEnd}) for text of length ${fileText.length}`,
    )
  }
  const { lineStart, lineEnd } = offsetsToLines(fileText, selStart, selEnd)
  const beforeStart = Math.max(0, selStart - context)
  const afterEnd = Math.min(fileText.length, selEnd + context)
  return {
    target_lines: [lineStart, lineEnd],
    anchor_before: fileText.slice(beforeStart, selStart),
    anchor_text: fileText.slice(selStart, selEnd),
    anchor_after: fileText.slice(selEnd, afterEnd),
  }
}

export interface ResolvedAnchor {
  charStart: number
  charEnd: number
  lineStart: number
  lineEnd: number
  via: "line" | "unique-text" | "context-window"
}

/**
 * Resolve an anchor against a possibly-drifted file.
 */
export function resolveAnchor(fileText: string, anchor: Anchor): ResolvedAnchor | null {
  const lineHit = tryLineMatch(fileText, anchor)
  if (lineHit) return lineHit

  const occurrences = findAll(fileText, anchor.anchor_text)
  if (occurrences.length === 1) {
    const charStart = occurrences[0]!
    const charEnd = charStart + anchor.anchor_text.length
    const { lineStart, lineEnd } = offsetsToLines(fileText, charStart, charEnd)
    return { charStart, charEnd, lineStart, lineEnd, via: "unique-text" }
  }

  if (occurrences.length > 1 || occurrences.length === 0) {
    const combined = anchor.anchor_before + anchor.anchor_text + anchor.anchor_after
    if (combined.length > 0) {
      const idx = fileText.indexOf(combined)
      if (idx >= 0 && fileText.indexOf(combined, idx + 1) < 0) {
        const charStart = idx + anchor.anchor_before.length
        const charEnd = charStart + anchor.anchor_text.length
        const { lineStart, lineEnd } = offsetsToLines(fileText, charStart, charEnd)
        return { charStart, charEnd, lineStart, lineEnd, via: "context-window" }
      }
    }
  }

  return null
}

function tryLineMatch(fileText: string, anchor: Anchor): ResolvedAnchor | null {
  const [ls, le] = anchor.target_lines
  const lines = fileText.split("\n")
  if (ls < 1 || le > lines.length || ls > le) return null
  const rangeText = lines.slice(ls - 1, le).join("\n")
  const idxInRange = rangeText.indexOf(anchor.anchor_text)
  if (idxInRange < 0) return null
  let lineStartOffset = 0
  for (let i = 0; i < ls - 1; i++) {
    lineStartOffset += lines[i]!.length + 1
  }
  const charStart = lineStartOffset + idxInRange
  const charEnd = charStart + anchor.anchor_text.length
  const { lineStart, lineEnd } = offsetsToLines(fileText, charStart, charEnd)
  return { charStart, charEnd, lineStart, lineEnd, via: "line" }
}

function findAll(haystack: string, needle: string): number[] {
  if (!needle) return []
  const out: number[] = []
  let from = 0
  while (true) {
    const idx = haystack.indexOf(needle, from)
    if (idx < 0) break
    out.push(idx)
    from = idx + 1
  }
  return out
}

/**
 * 1-indexed line numbers for a half-open character range [start, end).
 */
export function offsetsToLines(
  text: string,
  start: number,
  end: number,
): { lineStart: number; lineEnd: number } {
  let line = 1
  let lineStart = 1
  let lineEnd = 1
  let seenStart = false
  let seenEnd = false
  for (let i = 0; i < text.length; i++) {
    if (!seenStart && i >= start) {
      lineStart = line
      seenStart = true
    }
    if (!seenEnd && i >= end) {
      lineEnd = line
      seenEnd = true
      break
    }
    if (text[i] === "\n") line++
  }
  if (!seenStart) lineStart = line
  if (!seenEnd) lineEnd = line
  if (lineEnd < lineStart) lineEnd = lineStart
  return { lineStart, lineEnd }
}
