import { wikiApi, type TreeNode } from '../api/wikiClient'
import type { WikiChatSettings } from '../stores/wikiChatStore'

const DEFAULT_SYSTEM_PROMPT = `你的职责是像检索 Wiki 一样，基于知识库中的内容回答用户的问题，而不是凭一般知识作答。

【知识库结构】知识库位于"当前知识库路径"下，采用 llm-wiki 的组织方式：
- index.md 或 wiki/index.md：全库目录页，按类别列出所有页面，是查询的起点
- wiki/concepts/：概念/主题页面（主题过大时会拆分出子页面）
- wiki/entities/：人物、工具、论文、组织等实体页面
- wiki/summaries/：原始资料的摘要页面
- raw/：原始资料（文章、论文、笔记等），wiki 已编译页面内容不足或需要更细的原始说明时，查询这里
页面之间用 [[页面名]] 形式的 wikilink 互相引用。

【查询步骤】严格按以下流程查询并回答（llm-wiki 的 query 流程）：
1. 先读目录页（index.md 或 wiki/index.md），按类别定位与问题相关的页面，不要只凭文件名猜测。
2. 通读相关页面全文；遇到 wikilink 或交叉引用时，如果指向的页面与问题相关，追读一层。
3. 综合多个相关页面的内容作答，只依据知识库中的事实，不要编造内容。
4. 如果 wiki 已编译页面不足以回答、或需要更详细的原始说明，请继续查询 raw/ 下的原始资料（先用 Glob/Grep 在 raw/ 中定位相关文件，再 Read 读取全文）。
5. 如果知识库内容仍不足以回答，请明确说明"知识库中未找到相关信息"，并指出还缺少哪类资料（提示可补充的方向），不要强行作答。

【工具规则】只允许使用只读工具（Read、Grep、Glob 等）查询知识库文件；禁止写入、修改、删除任何文件，禁止执行命令。所有资料都在同一个知识库目录内，查询文档一律用 Glob/Grep 定位、Read 读取 md/html 文件，严禁用 Python 或任何命令行脚本读取文档（太慢）。下方"知识库内容"是系统预检索的候选页面，只是查询起点，若不足以回答，必须按上述查询步骤自行查询知识库。

【回答格式】
1. 使用与用户提问相同的语言回答，条理清晰、简明扼要。
2. 引用标注：回答中引用某个页面时，在相应句子后用 [n] 标注该页面的编号（如：根据文档说明，该接口需要两步配置[1]）。
3. 回答结束后，请在末尾输出一个参考文献 JSON 块，放在单独的 json 代码块中（用三个反引号包裹），格式如下，其中 index 必须与正文中引用的编号 [n] 一一对应，path 是页面相对知识库根目录的路径，title 是页面标题：
\`\`\`json
{"references":[{"index":1,"path":"wiki/concepts/example.md","title":"示例页面"}]}
\`\`\`
如果回答没有引用任何知识库页面，请输出 {"references":[]}。该 JSON 块以外的多余解释不要输出。`

function flattenMarkdownPaths(node: TreeNode): string[] {
  if (node.kind === 'file') {
    return /\.(md|markdown)$/i.test(node.path) ? [node.path] : []
  }
  const paths: string[] = []
  for (const child of node.children ?? []) {
    paths.push(...flattenMarkdownPaths(child))
  }
  return paths
}

function scorePath(path: string, tokens: string[]): number {
  const haystack = path.toLowerCase()
  return tokens.reduce((sum, token) => (haystack.includes(token) ? sum + 1 : sum), 0)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1)
}

/**
 * 以当前知识库为检索依据：按问题关键词与页面路径的匹配度取分，
 * 取排名靠前的页面内容作为模型回答的依据。无匹配时回退到索引页。
 * 返回检索到的内容与页面路径（供前端展示可点击的依据链接）。
 */
export async function retrieveKnowledgeContext(
  question: string,
  maxPages = 3,
  maxCharsPerPage = 5000,
): Promise<{ content: string; paths: string[] }> {
  const tree = await wikiApi.getTree()
  const paths = flattenMarkdownPaths(tree)
  if (paths.length === 0) return { content: '', paths: [] }

  const tokens = tokenize(question)
  const ranked = paths
    .map((path) => ({ path, score: scorePath(path, tokens) }))
    .sort((a, b) => b.score - a.score)

  let chosen = ranked.filter((entry) => entry.score > 0).slice(0, maxPages)
  if (chosen.length === 0) {
    const indexPath = ranked.find((entry) => /index\.md$/i.test(entry.path))
    const fallback = indexPath ?? ranked[0]
    if (!fallback) return { content: '', paths: [] }
    chosen = [fallback]
  }

  const sections: string[] = []
  // 并行拉取页面内容，避免串行 HTTP 往返拖慢回答
  const pages = await Promise.all(
    chosen.map(async ({ path }) => {
      try {
        const page = await wikiApi.getPage(path)
        return { path, content: (page.raw ?? '').slice(0, maxCharsPerPage) }
      } catch {
        return null
      }
    }),
  )
  pages.forEach((page, index) => {
    if (!page) return
    sections.push(`[${index + 1}] ${page.path}\n\n${page.content}`)
  })
  return {
    content: sections.join('\n\n---\n\n'),
    paths: chosen.map((entry) => entry.path),
  }
}

export function buildChatSystemPrompt(
  settings: Pick<WikiChatSettings, 'systemPrompt'>,
  wikiRootPath: string,
): string {
  const parts: string[] = []
  parts.push(`你是知识库问答助手。当前知识库路径：${wikiRootPath || '(未知)'}`)
  parts.push(DEFAULT_SYSTEM_PROMPT)

  if (settings.systemPrompt.trim()) {
    parts.push(`用户附加要求：\n${settings.systemPrompt.trim()}`)
  }
  return parts.join('\n\n')
}

export function buildChatMessage(
  settings: Pick<WikiChatSettings, 'systemPrompt'>,
  wikiRootPath: string,
  question: string,
  context: string,
): string {
  const systemPrompt = buildChatSystemPrompt(settings, wikiRootPath)
  const blocks = [`[系统提示]\n${systemPrompt}`]
  if (context.trim()) {
    blocks.push(`[知识库内容]\n${context}`)
  }
  blocks.push(`[用户问题]\n${question}`)
  return blocks.join('\n\n')
}

/**
 * 界面上展示的用户气泡内容：系统提示默认折叠（<details>），点击 summary 展开，
 * 之后紧跟用户的问题。UserMessage 对含 <details> 的内容走 markdown 渲染，
 * details/summary 由 DOMPurify 默认放行，因此能渲染成可点击展开的原生折叠块。
 */
export function buildDisplayChatContent(systemPrompt: string, question: string): string {
  const trimmedPrompt = systemPrompt.trim()
  if (!trimmedPrompt) return question
  return `<details><summary>系统提示</summary><pre>${escapeHtml(trimmedPrompt)}</pre></details>\n\n${question}`
}

export type ReferenceEntry = { index: number; path: string; title?: string }

/**
 * 从模型的回答中解析参考文献 schema（{"references":[{index,path,title}]}）。
 * 优先取最后一个能解析的 fenced json 块；没有时尝试解析正文末尾的裸 JSON 对象。
 * body 为去掉 schema 块后的正文；found 表示是否解析出了 schema。
 */
export function parseReferencesSchema(text: string): {
  body: string
  found: boolean
  entries: ReferenceEntry[]
} {
  const fenceRe = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g
  let match: RegExpExecArray | null
  let body = text
  let found = false
  let entries: ReferenceEntry[] = []
  while ((match = fenceRe.exec(text)) !== null) {
    if (match[1] === undefined) continue
    const parsed = parseReferencesObject(match[1])
    if (!parsed) continue
    found = true
    entries = parsed
    body = `${text.slice(0, match.index)}${text.slice(match.index + match[0].length)}`.trimEnd()
  }
  if (found) return { body, found, entries }
  // 无 fenced 块：尝试解析末尾的裸 JSON 对象
  const bare = text.match(/\{[\s\S]*?\}\s*$/)
  if (bare) {
    const parsed = parseReferencesObject(bare[0].trim())
    if (parsed) {
      return { body: text.slice(0, bare.index).trimEnd(), found: true, entries: parsed }
    }
  }
  return { body: text, found: false, entries }
}

function parseReferencesObject(jsonText: string): ReferenceEntry[] | null {
  try {
    const parsed = JSON.parse(jsonText) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const refs = (parsed as { references?: unknown }).references
    if (!Array.isArray(refs)) return null
    const entries: ReferenceEntry[] = []
    for (const item of refs) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      const index = Number(record.index)
      const path = typeof record.path === 'string' ? record.path : ''
      if (!Number.isFinite(index) || !path) continue
      entries.push({
        index,
        path,
        ...(typeof record.title === 'string' && record.title ? { title: record.title } : {}),
      })
    }
    return entries
  } catch {
    return null
  }
}

/**
 * 把模型按 schema 输出的参考文献渲染成论文式"参考依据"列表，
 * 每条带 data-wiki-path 可点击链接，编号与正文 [n] 一一对应。
 */
export function buildReferencesMarkdownFromEntries(entries: ReferenceEntry[]): string {
  if (entries.length === 0) return ''
  const items = entries
    .map(
      (entry) =>
        `[${entry.index}] <a href="#" data-wiki-path="${escapeHtml(entry.path)}" title="${escapeHtml(entry.path)}">${escapeHtml(entry.title || entry.path)}</a>`,
    )
    .join('\n')
  return `\n\n---\n\n**参考依据**\n\n${items}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 把本次回答检索到的知识库页面构造成论文式的"参考依据"列表，
 * 编号与"知识库内容"中的 [n] 一一对应；每条链接带 data-wiki-path，
 * 由聊天面板统一拦截点击并跳转到知识库 content 中的对应 md 页面。
 */
export function buildReferencesMarkdown(paths: string[]): string {
  if (paths.length === 0) return ''
  const items = paths
    .map(
      (path, index) =>
        `[${index + 1}] <a href="#" data-wiki-path="${escapeHtml(path)}" title="${escapeHtml(path)}">${escapeHtml(path)}</a>`,
    )
    .join('\n')
  return `\n\n---\n\n**参考依据**\n\n${items}`
}
