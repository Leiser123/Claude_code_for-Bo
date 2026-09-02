import type { ExpertConfig } from '../stores/projectStore'
import { useWikiStore } from '../stores/wikiStore'
import { retrieveKnowledgeContext } from './wikiChatPrompt'

/**
 * 按专家配置激活其知识库并检索相关内容。
 * 专家未配置知识库时不检索；检索基于当前激活的知识库。
 */
export async function retrieveExpertContext(
  expert: ExpertConfig,
  question: string,
): Promise<{ content: string; paths: string[] }> {
  const repoName = expert.knowledgeRepo?.trim()
  const repoPath = expert.knowledgeRepoPath?.trim()
  if (!repoName && !repoPath) return { content: '', paths: [] }

  const wiki = useWikiStore.getState()
  try {
    if (repoPath) {
      // 指定地址优先：确保该知识库已激活
      const targetName = repoName || repoPath.split(/[\\/]/).filter(Boolean).pop() || 'wiki'
      if (wiki.currentWiki !== targetName || wiki.wikiRootPath !== repoPath) {
        await wiki.switchWiki(targetName, repoPath)
      }
    } else if (repoName && wiki.currentWiki !== repoName) {
      const repo = wiki.repos.find((r) => r.name === repoName)
      if (repo) await wiki.switchWiki(repoName, repo.path)
    }
  } catch {
    // 切换失败时基于当前激活知识库检索
  }
  return retrieveKnowledgeContext(question)
}

/** 组装发送给模型的完整消息：专家系统提示词 + 知识库内容 + 用户问题 */
export function buildExpertChatMessage(
  expert: ExpertConfig,
  question: string,
  context: string,
): string {
  const role = expert.systemPrompt?.trim()
    ? expert.systemPrompt.trim()
    : '请结合你的专业领域给出专业、可操作的工程建议。'
  const blocks = [`[系统提示]\n你是「${expert.name}」专家。${role}`]
  if (expert.description?.trim()) {
    blocks.push(`角色定位：${expert.description.trim()}`)
  }
  if (context.trim()) {
    blocks.push(`[知识库内容]\n${context}`)
  }
  blocks.push(`[用户问题]\n${question}`)
  return blocks.join('\n\n')
}
