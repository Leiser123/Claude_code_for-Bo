import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useProjectStore } from '../../stores/projectStore'
import { useWikiStore } from '../../stores/wikiStore'

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * 专家聊天设置：与 Knowledge 聊天设置一致，可设置系统提示词、
 * 以及回答时检索的具体知识库（下拉选择或指定地址）。
 * 保存后写入该专家的配置，对所有与该专家的对话生效。
 */
export function ExpertChatSettings({ open, onClose }: Props) {
  const experts = useProjectStore((s) => s.experts)
  const selectedExpertId = useProjectStore((s) => s.selectedExpertId)
  const updateExpert = useProjectStore((s) => s.updateExpert)
  const repos = useWikiStore((s) => s.repos)
  const fetchRepos = useWikiStore((s) => s.fetchRepos)

  const expert = experts.find((e) => e.id === selectedExpertId)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [knowledgeRepo, setKnowledgeRepo] = useState('')
  const [knowledgeRepoPath, setKnowledgeRepoPath] = useState('')

  // 弹窗打开时用当前专家的配置初始化表单，并拉取可用知识库
  useEffect(() => {
    if (!open || !expert) return
    setSystemPrompt(expert.systemPrompt ?? '')
    setKnowledgeRepo(expert.knowledgeRepo ?? '')
    setKnowledgeRepoPath(expert.knowledgeRepoPath ?? '')
    void fetchRepos()
  }, [open, expert, fetchRepos])

  const handleSave = () => {
    if (!expert) return
    updateExpert(expert.id, {
      systemPrompt,
      knowledgeRepo,
      knowledgeRepoPath: knowledgeRepoPath.trim() || undefined,
    })
    onClose()
  }

  if (!expert) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="聊天设置"
      width={560}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            保存
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-7">
        {/* 系统提示词 */}
        <section>
          <h3
            className="text-[16.5px] font-semibold leading-tight text-[var(--color-text-primary)] mb-1"
            style={{ fontFamily: 'var(--font-headline)' }}
          >
            系统提示词
          </h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-3">
            附加在专家默认提示词之后，用于规定模型的回答角度与方式。
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="例如：请结合行业标准给出具体参数建议。"
            rows={4}
            className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm leading-6 text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] transition-colors focus:border-[var(--color-brand)] focus:outline-none"
          />
        </section>

        {/* 知识库 */}
        <section>
          <h3
            className="text-[16.5px] font-semibold leading-tight text-[var(--color-text-primary)] mb-1"
            style={{ fontFamily: 'var(--font-headline)' }}
          >
            知识库
          </h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-3">
            选择该专家回答问题时检索的知识库：提问时会先检索该知识库中的相关页面，再基于其中内容回答。
          </p>
          <select
            value={knowledgeRepo}
            onChange={(e) => {
              setKnowledgeRepo(e.target.value)
              setKnowledgeRepoPath('')
            }}
            className="w-full h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="">不选择知识库</option>
            {repos.map((repo) => (
              <option key={repo.name} value={repo.name}>{repo.name}</option>
            ))}
          </select>
          {knowledgeRepo && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)] break-all">
              <span className="material-symbols-outlined shrink-0 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                folder_open
              </span>
              <code className="font-mono">{repos.find((r) => r.name === knowledgeRepo)?.path || ''}</code>
            </div>
          )}
          <div className="mt-3">
            <Input
              label="或指定知识库地址"
              value={knowledgeRepoPath}
              placeholder="输入知识库文件夹的绝对路径（优先于下拉选择）"
              onChange={(e) => setKnowledgeRepoPath(e.target.value)}
            />
          </div>
        </section>

        {/* 固化状态提示 */}
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            save
          </span>
          保存后自动写入该专家的配置，对所有与该专家的对话生效。
        </p>
      </div>
    </Modal>
  )
}
