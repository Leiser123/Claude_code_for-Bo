import fs from "node:fs"
import path from "node:path"
import os from "node:os"

/**
 * Knowledge 聊天历史（知识库会话注册表）持久化。
 * 存储位置：~/.claude/cc-haha/knowledge/.chat-history.json
 * （即"知识库对应的 Knowledge 文件夹"内，与服务端自动发现的知识库同级）
 */

export type KnowledgeSessionRecord = {
  id: string
  title: string
  createdAt: number
}

function getHistoryFile(): string {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude")
  return path.join(claudeDir, "cc-haha", "knowledge", ".chat-history.json")
}

function ensureDir() {
  const dir = path.dirname(getHistoryFile())
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readHistory(): KnowledgeSessionRecord[] {
  try {
    const file = getHistoryFile()
    if (!fs.existsSync(file)) return []
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is KnowledgeSessionRecord =>
        !!entry && typeof entry.id === "string" && typeof entry.title === "string",
    )
  } catch {
    return []
  }
}

/**
 * GET /api/wiki/chat-history
 */
export async function handleChatHistoryGet(): Promise<Response> {
  return Response.json({ records: readHistory() })
}

/**
 * POST /api/wiki/chat-history — 全量覆盖保存（记录数很少，全量写最可靠）
 */
export async function handleChatHistoryPost(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { records?: unknown }
    const records = Array.isArray(body.records)
      ? body.records.filter(
          (entry): entry is KnowledgeSessionRecord =>
            !!entry && typeof entry.id === "string" && typeof entry.title === "string",
        )
      : []
    ensureDir()
    fs.writeFileSync(getHistoryFile(), JSON.stringify(records, null, 2), "utf-8")
    return Response.json({ success: true, records })
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 })
  }
}
