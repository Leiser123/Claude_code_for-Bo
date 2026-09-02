import fs from "node:fs"
import path from "node:path"
import { createRenderer } from "./render/markdown.js"
import { getTranslateConfig, type WikiTranslateConfig } from "./translate-config.js"

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".html", ".htm", ".json"])

/** Default languages mapping: short-code → Google/Browser locale tag. */
const LANGUAGES: Record<string, string> = {
  zh: "zh-CN",
  "zh-TW": "zh-TW",
  ja: "ja",
  ko: "ko",
  en: "en",
  "en-US": "en-US",
  "en-GB": "en-GB",
  de: "de",
  "de-DE": "de-DE",
  fr: "fr",
  "fr-FR": "fr-FR",
  es: "es",
  "es-ES": "es-ES",
  it: "it",
  "it-IT": "it-IT",
  pt: "pt",
  "pt-BR": "pt-BR",
  ru: "ru",
  nl: "nl",
  pl: "pl",
  tr: "tr",
  sv: "sv",
  da: "da",
  no: "no",
  fi: "fi",
  cs: "cs",
  hu: "hu",
  el: "el",
  he: "he",
  ar: "ar",
  hi: "hi",
  bn: "bn",
  ur: "ur",
  th: "th",
  vi: "vi",
  id: "id",
  ms: "ms",
  ro: "ro",
  sk: "sk",
  uk: "uk",
  bg: "bg",
}

/**
 * GET /api/wiki/translate?path=...&to=...&from=...
 * 支持 .md、.txt、.html、.json 等文本文件的翻译
 */
export async function handleTranslate(url: URL, getWikiRoot: () => string): Promise<Response> {
  const relRaw = url.searchParams.get("path") ?? ""
  const to = url.searchParams.get("to") ?? "en"
  const lang = LANGUAGES[to] ?? to

  const wikiRoot = getWikiRoot()
  const rel = safeRel(relRaw)
  if (!rel) {
    return Response.json({ error: "invalid path" }, { status: 400 })
  }

  // 复用 handlePage 的文件查找逻辑找文件
  const { full, ext } = resolvePageFile(wikiRoot, rel)
  if (!full) {
    return Response.json({ error: "file not found" }, { status: 404 })
  }

  // 只翻译文本类文件
  if (!TEXT_EXTENSIONS.has(ext)) {
    return Response.json({ error: `cannot translate ${ext} files` }, { status: 400 })
  }

  const rawContent = fs.readFileSync(full, "utf-8")

  try {
    const config = getTranslateConfig()
    let translatedBody: string
    let outputHtml: string

    if (ext === ".md") {
      const { body, frontmatterRaw } = stripFrontmatterForTranslate(rawContent)
      translatedBody = await translateText(body, lang, config)
      const renderer = createRenderer({ wikiRoot })
      outputHtml = renderer.render(frontmatterRaw + translatedBody).html
    } else {
      translatedBody = await translateText(rawContent, lang, config)
      if (ext === ".html" || ext === ".htm") {
        outputHtml = translatedBody
      } else {
        outputHtml = `<pre class="whitespace-pre-wrap font-mono text-sm">${escapeHtml(translatedBody)}</pre>`
      }
    }

    return Response.json({ html: outputHtml, lang })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[translate] failed:", message)
    return Response.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/wiki/translate-batch
 */
export async function handleTranslateBatch(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { texts: string[]; to: string }
    const { texts, to } = body
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return Response.json({ error: "missing or invalid `texts` array" }, { status: 400 })
    }
    const lang = LANGUAGES[to] ?? to ?? "en"
    const config = getTranslateConfig()

    const separator = "\n---SEP---\n"
    const combined = texts.join(separator)
    const translated = await translateText(combined, lang, config)
    const parts = translated.split(separator).map((s) => s.trim())
    const translations: Record<string, string> = {}
    for (let i = 0; i < texts.length; i++) {
      translations[texts[i]!] = parts[i] ?? texts[i]!
    }
    return Response.json({ translations, lang })
  } catch (err) {
    console.error("Batch translation failed:", err)
    return Response.json({ error: "batch translation failed" }, { status: 500 })
  }
}

// ─── 使用 Settings 激活的 Provider 翻译 ───────────────────

async function translateText(text: string, targetLang: string, config: WikiTranslateConfig): Promise<string> {
  if (!config.apiKey || !config.apiUrl) {
    throw new Error(
      "No active provider configured. Please set up a provider in Settings > Providers.",
    )
  }

  // 更大块减少请求次数，并行请求
  const chunks = splitIntoChunks(text, 32000)
  const model = config.model

  // 精简 system prompt 减少 token 消耗
  const systemPrompt = `Translate to ${targetLang}. Output only the translation.`

  const tasks = chunks.map(async (chunk) => {
    const resp = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: chunk },
        ],
        temperature: 0,
        max_tokens: Math.max(Math.ceil(chunk.length * 1.5), 4096),
      }),
    })

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "")
      throw new Error(`Translation API returned ${resp.status}: ${errBody.slice(0, 200)}`)
    }

    const data = (await resp.json()) as any
    return (data.choices?.[0]?.message?.content ?? "")
  })

  const results = await Promise.all(tasks)
  return results.join("\n\n")
}

// ─── 工具函数 ────────────────────────────────────────────

function splitIntoChunks(text: string, maxLen: number): string[] {
  const chunks: string[] = []
  let current = ""
  const lines = text.split("\n")

  for (const line of lines) {
    if ((current + line).length > maxLen && current.length > 0) {
      chunks.push(current)
      current = line + "\n"
    } else {
      current += line + "\n"
    }
  }
  if (current) chunks.push(current)
  return chunks
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\n---\r?\n?/

function stripFrontmatterForTranslate(text: string): { body: string; frontmatterRaw: string } {
  const m = FRONTMATTER_RE.exec(text)
  if (m) {
    return { body: text.slice(m[0].length), frontmatterRaw: m[0] }
  }
  return { body: text, frontmatterRaw: "" }
}

/** 复用 handlePage 的文件查找逻辑 */
function resolvePageFile(wikiRoot: string, rel: string): { full: string | null; ext: string } {
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
        const wikiFull = path.join(wikiRoot, "wiki", rel.replace(/\//g, path.sep))
        if (fs.existsSync(wikiFull) && fs.statSync(wikiFull).isFile()) {
          full = wikiFull
        } else {
          const wikiWithMd = wikiFull + ".md"
          if (fs.existsSync(wikiWithMd)) {
            full = wikiWithMd
          } else {
            return { full: null, ext: "" }
          }
        }
      }
    } else {
      const wikiFull = path.join(wikiRoot, "wiki", rel.replace(/\//g, path.sep))
      if (fs.existsSync(wikiFull) && fs.statSync(wikiFull).isFile()) {
        full = wikiFull
      } else {
        return { full: null, ext: "" }
      }
    }
  }

  const relFromRoot = path.relative(wikiRoot, full)
  if (relFromRoot.startsWith("..") || path.isAbsolute(relFromRoot)) {
    return { full: null, ext: "" }
  }

  return { full, ext: path.extname(full).toLowerCase() }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/** 复用 handlePage 的安全路径检查 */
function safeRel(input: string): string | null {
  if (!input) return "wiki/index.md"
  if (path.isAbsolute(input)) return null
  const normalized = path.normalize(input.replace(/\//g, path.sep))
  if (normalized.startsWith("..")) return null
  return normalized
}
