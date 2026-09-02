import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const PROVIDERS_PATH = path.join(
  process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"),
  "cc-haha",
  "providers.json",
)

export interface WikiTranslateConfig {
  provider: string
  apiKey: string
  apiSecret: string
  apiUrl: string
  model: string
  apiFormat: "anthropic" | "openai_chat" | "openai_responses"
}

const DEFAULT_CONFIG: WikiTranslateConfig = {
  provider: "",
  apiKey: "",
  apiSecret: "",
  apiUrl: "",
  model: "",
  apiFormat: "openai_chat",
}

function readActiveProviderConfig(): WikiTranslateConfig {
  try {
    if (!fs.existsSync(PROVIDERS_PATH)) return { ...DEFAULT_CONFIG }

    const raw = JSON.parse(fs.readFileSync(PROVIDERS_PATH, "utf-8"))
    const index = raw as {
      activeId?: string
      providers?: Array<{
        id: string
        apiKey: string
        baseUrl: string
        models: { main: string }
        apiFormat?: "anthropic" | "openai_chat" | "openai_responses"
      }>
    }

    if (!index.activeId || !index.providers) return { ...DEFAULT_CONFIG }

    const activeProvider = index.providers.find((p) => p.id === index.activeId)
    if (!activeProvider) return { ...DEFAULT_CONFIG }

    const apiFormat = activeProvider.apiFormat ?? "anthropic"
    let apiUrl = ""

    if (apiFormat === "openai_chat") {
      // OpenAI Chat Completions: 直接拼接
      const baseUrl = (activeProvider.baseUrl || "").replace(/\/+$/, "")
      apiUrl = baseUrl ? `${baseUrl}/v1/chat/completions` : ""
    } else {
      // anthropic / openai_responses: 从 baseUrl 推导 OpenAI 兼容 URL
      // 常见 Anthropic baseUrl 末尾的路径需要剥离
      let baseUrl = (activeProvider.baseUrl || "").replace(/\/+$/, "")
      const knownSuffixes = ["/anthropic", "/api/anthropic", "/coding", "/v1"]
      for (const suffix of knownSuffixes) {
        if (baseUrl.endsWith(suffix)) {
          baseUrl = baseUrl.slice(0, -suffix.length).replace(/\/+$/, "")
          break
        }
      }
      apiUrl = baseUrl ? `${baseUrl}/v1/chat/completions` : ""
    }

    return {
      provider: "active-provider",
      apiKey: activeProvider.apiKey || "",
      apiSecret: "",
      apiUrl,
      model: activeProvider.models?.main || "",
      apiFormat: "openai_chat", // 统一使用 OpenAI Chat Completions 格式调用
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * GET /api/wiki/translate-config
 */
export async function handleTranslateConfigGet(): Promise<Response> {
  const config = readActiveProviderConfig()
  return Response.json(config)
}

/**
 * PUT /api/wiki/translate-config
 * 不再写入独立配置，仅返回当前激活 provider 的信息
 */
export async function handleTranslateConfigPut(_req: Request): Promise<Response> {
  const config = readActiveProviderConfig()
  return Response.json({ success: true, config })
}

/**
 * 供 translate handler 使用的读配置函数
 * 直接从 Settings 页面的激活 Provider 读取，不再使用独立配置
 */
export function getTranslateConfig(): WikiTranslateConfig {
  return readActiveProviderConfig()
}
