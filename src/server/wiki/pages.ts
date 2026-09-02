import fs from "node:fs"
import path from "node:path"
import { createRenderer } from "./render/markdown.js"

/**
 * GET /api/wiki/page?path=...
 */
export async function handlePage(url: URL, getWikiRoot: () => string): Promise<Response> {
  const wikiRoot = getWikiRoot()
  const renderer = createRenderer({ wikiRoot })

  const relRaw = url.searchParams.get("path") ?? ""
  const rel = safeRel(relRaw)
  if (!rel) {
    return Response.json({ error: "missing or invalid `path` query" }, { status: 400 })
  }

  let full = path.join(wikiRoot, rel.replace(/\//g, path.sep))
  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    full = path.join(full, "index.md")
  }

  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    const ext = path.extname(rel)
    if (!ext) {
      const withMd = full + ".md"
      if (fs.existsSync(withMd)) {
        full = withMd
      } else {
        // Fallback: try with "wiki/" subdirectory prefix
        const wikiFull = path.join(wikiRoot, "wiki", rel.replace(/\//g, path.sep))
        if (fs.existsSync(wikiFull) && fs.statSync(wikiFull).isFile()) {
          full = wikiFull
        } else {
          const wikiWithMd = wikiFull + ".md"
          if (fs.existsSync(wikiWithMd)) {
            full = wikiWithMd
          } else {
            return Response.json({ error: "file not found", path: rel }, { status: 404 })
          }
        }
      }
    } else {
      // Fallback: try with "wiki/" subdirectory prefix
      const wikiFull = path.join(wikiRoot, "wiki", rel.replace(/\//g, path.sep))
      if (fs.existsSync(wikiFull) && fs.statSync(wikiFull).isFile()) {
        full = wikiFull
      } else {
        return Response.json({ error: "file not found", path: rel }, { status: 404 })
      }
    }
  }

  const relFromRoot = path.relative(wikiRoot, full)
  if (relFromRoot.startsWith("..") || path.isAbsolute(relFromRoot)) {
    return Response.json({ error: "path escapes wiki root" }, { status: 403 })
  }

  const ext = path.extname(full).toLowerCase()
  const displayPath = relFromRoot.split(path.sep).join("/")

  if (ext === ".md") {
    const rawMarkdown = fs.readFileSync(full, "utf-8")
    const rendered = renderer.render(rawMarkdown)
    return Response.json({
      path: displayPath,
      title: rendered.title,
      frontmatter: rendered.frontmatter,
      html: rendered.html,
      raw: rendered.rawMarkdown,
      contentType: "markdown" as const,
      fileName: path.basename(full),
    })
  }

  if (ext === ".html" || ext === ".htm") {
    const htmlContent = fs.readFileSync(full, "utf-8")
    const bodyContent = extractBodyContent(htmlContent)
    return Response.json({
      path: displayPath,
      title: path.basename(full, ext),
      frontmatter: null,
      html: bodyContent,
      raw: htmlContent,
      contentType: "html" as const,
      fileName: path.basename(full),
    })
  }

  if (ext === ".txt") {
    const textContent = fs.readFileSync(full, "utf-8")
    return Response.json({
      path: displayPath,
      title: path.basename(full, ext),
      frontmatter: null,
      html: `<pre class="whitespace-pre-wrap font-mono text-sm">${escapeHtml(textContent)}</pre>`,
      raw: textContent,
      contentType: "text" as const,
      fileName: path.basename(full),
    })
  }

  if (ext === ".json") {
    const jsonContent = fs.readFileSync(full, "utf-8")
    try {
      const parsed = JSON.parse(jsonContent)
      const formatted = JSON.stringify(parsed, null, 2)
      return Response.json({
        path: displayPath,
        title: path.basename(full, ext),
        frontmatter: null,
        html: `<pre class="font-mono text-sm">${escapeHtml(formatted)}</pre>`,
        raw: jsonContent,
        contentType: "json" as const,
        fileName: path.basename(full),
      })
    } catch {
      return Response.json({
        path: displayPath,
        title: path.basename(full, ext),
        frontmatter: null,
        html: `<pre class="font-mono text-sm">${escapeHtml(jsonContent)}</pre>`,
        raw: jsonContent,
        contentType: "json" as const,
        fileName: path.basename(full),
      })
    }
  }

  if (ext === ".pdf") {
    return Response.json({
      path: displayPath,
      title: path.basename(full, ext),
      frontmatter: null,
      html: "",
      raw: "",
      contentType: "pdf" as const,
      fileName: path.basename(full),
      fileUrl: `/api/wiki/raw?path=${encodeURIComponent(displayPath)}`,
    })
  }

  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"].includes(ext)) {
    return Response.json({
      path: displayPath,
      title: path.basename(full, ext),
      frontmatter: null,
      html: "",
      raw: "",
      contentType: "image" as const,
      fileName: path.basename(full),
      fileUrl: `/api/wiki/raw?path=${encodeURIComponent(displayPath)}`,
    })
  }

  // Fallback for unknown types
  const rawContent = fs.readFileSync(full, "utf-8")
  return Response.json({
    path: displayPath,
    title: path.basename(full, ext),
    frontmatter: null,
    html: `<pre class="font-mono text-sm">${escapeHtml(rawContent)}</pre>`,
    raw: rawContent,
    contentType: "text" as const,
    fileName: path.basename(full),
  })
}

/**
 * GET /api/wiki/raw?path=...
 */
export async function handleRaw(url: URL, getWikiRoot: () => string): Promise<Response> {
  const wikiRoot = getWikiRoot()
  const relRaw = url.searchParams.get("path") ?? ""
  const rel = safeRel(relRaw)
  if (!rel) {
    return new Response("bad path", { status: 400 })
  }
  const full = path.join(wikiRoot, rel.replace(/\//g, path.sep))
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    return new Response("not found", { status: 404 })
  }
  const data = fs.readFileSync(full)
  return new Response(data, {
    headers: { "Content-Type": getMimeType(full) },
  })
}

function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch && bodyMatch[1]) {
    return bodyMatch[1].trim()
  }
  const htmlMatch = html.match(/<html[^>]*>([\s\S]*)<\/html>/i)
  if (htmlMatch && htmlMatch[1]) {
    const inner = htmlMatch[1].trim()
    const bodyMatch2 = inner.match(/<body[^>]*>([\s\S]*)/i)
    if (bodyMatch2 && bodyMatch2[1]) {
      return bodyMatch2[1].replace(/<\/body>\s*$/i, "").trim()
    }
    return inner.replace(/<\/body>\s*$/i, "").trim()
  }
  return html
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

const MIME_MAP: Record<string, string> = {
  ".md": "text/markdown",
  ".html": "text/html",
  ".htm": "text/html",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
}

function getMimeType(filePath: string): string {
  return MIME_MAP[path.extname(filePath).toLowerCase()] || "application/octet-stream"
}

function safeRel(input: string): string | null {
  if (!input) return "wiki/index.md"
  if (path.isAbsolute(input)) return null
  // Normalize URL-style paths (forward slashes) to OS format
  const normalized = path.normalize(input.replace(/\//g, path.sep))
  if (normalized.startsWith("..")) return null
  return normalized
}
