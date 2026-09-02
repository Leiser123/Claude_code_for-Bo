import fs from "node:fs"
import path from "node:path"
import os from "node:os"

/**
 * 专家设置持久化（Project 模式）。
 * 存储位置：~/.claude/cc-haha/expert-settings/settings.json
 * 包含：专家列表（含 enabled 激活开关）、项目经理 ID、会议模板。
 */

export type ExpertSetting = {
  id: string
  name: string
  description: string
  /** 头像：emoji 或本地图片路径 */
  avatar: string
  avatarPath?: string
  color: string
  model: string
  customModel: string
  effort: string
  toolAccess: "inherit" | "none" | "custom"
  tools: string
  scope: "user" | "project"
  systemPrompt: string
  skills: string[]
  /** 选中的知识库名称 */
  knowledgeRepo: string
  /** 指定的知识库地址（优先于下拉选择） */
  knowledgeRepoPath?: string
  /** 是否激活（关闭后不出现在 Ask expert / Meeting 中） */
  enabled: boolean
  /** 是否项目经理（一个专家可以是 PM，负责会议模板与进度） */
  isManager?: boolean
}

export type MeetingTemplate = {
  id: string
  name: string
  agenda: string[]
  createdAt: number
}

export type ExpertSettingsFile = {
  version: number
  experts: ExpertSetting[]
  projectManagerId: string | null
  meetingTemplates: MeetingTemplate[]
}

function getSettingsFile(): string {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude")
  return path.join(claudeDir, "cc-haha", "expert-settings", "settings.json")
}

function ensureDir() {
  const dir = path.dirname(getSettingsFile())
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readSettings(): ExpertSettingsFile {
  try {
    const file = getSettingsFile()
    if (!fs.existsSync(file)) {
      return { version: 1, experts: [], projectManagerId: null, meetingTemplates: [] }
    }
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"))
    return {
      version: 1,
      experts: Array.isArray(parsed.experts) ? parsed.experts : [],
      projectManagerId: typeof parsed.projectManagerId === "string" ? parsed.projectManagerId : null,
      meetingTemplates: Array.isArray(parsed.meetingTemplates) ? parsed.meetingTemplates : [],
    }
  } catch {
    return { version: 1, experts: [], projectManagerId: null, meetingTemplates: [] }
  }
}

/**
 * GET /api/expert-settings
 */
export async function handleExpertSettingsGet(): Promise<Response> {
  return Response.json(readSettings())
}

/**
 * POST /api/expert-settings — 全量覆盖保存
 */
export async function handleExpertSettingsPost(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as Partial<ExpertSettingsFile>
    const next: ExpertSettingsFile = {
      version: 1,
      experts: Array.isArray(body.experts) ? body.experts : [],
      projectManagerId:
        typeof body.projectManagerId === "string" ? body.projectManagerId : null,
      meetingTemplates: Array.isArray(body.meetingTemplates)
        ? body.meetingTemplates
        : [],
    }
    ensureDir()
    fs.writeFileSync(getSettingsFile(), JSON.stringify(next, null, 2), "utf-8")
    return Response.json({ success: true, ...next })
  } catch {
    return Response.json({ error: "invalid request body" }, { status: 400 })
  }
}
