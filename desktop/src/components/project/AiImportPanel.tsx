import { useCallback, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useExpertSessionsStore } from '../../stores/expertSessionsStore'
import { retrieveKnowledgeContext } from '../../lib/wikiChatPrompt'
import { useProcessFlowStore, MODE_LABELS, type WorkflowMode } from './processFlowStore'

type Props = {
  open: boolean
  onClose: () => void
  mode: WorkflowMode
}

const WAIT_TIMEOUT_MS = 180_000

const PROMPTS: Record<WorkflowMode, string> = {
  process:
    '你是一名资深工艺工程师。请基于"知识库内容"中的产品/工艺信息，输出一份完整的工艺流程（Process Flow）。' +
    '格式要求：每行一个工序，格式为"工序号|工序名称|设备（可选）"。只输出工序列表，不要额外说明。',
  pfmea:
    '你是一名 PFMEA 工程师。请基于"知识库内容"中的工艺信息，为各工序输出失效模式分析。' +
    '格式要求：每行一条，格式为"工序名称|失效模式|潜在影响|潜在原因|S分值|O分值|D分值"。S/O/D 为 1-10 整数。只输出列表。',
  cp:
    '你是一名质量工程师。请基于"知识库内容"中的工艺信息，输出控制计划（CP）。' +
    '格式要求：每行一条，格式为"工序号|工序名称|特性/参数|规格|控制方法|抽样|反应计划"。只输出列表。',
  wi: '',
}

export function AiImportPanel({ open, onClose, mode }: Props) {
  const [question, setQuestion] = useState('')
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [imported, setImported] = useState(false)

  const createSession = useSessionStore((s) => s.createSession)
  const connectToSession = useChatStore((s) => s.connectToSession)
  const sendMessage = useChatStore((s) => s.sendMessage)

  const waitForReply = useCallback((sessionId: string, beforeCount: number): Promise<string> => {
    return new Promise((resolve) => {
      const startedAt = Date.now()
      const check = () => {
        const session = useChatStore.getState().sessions[sessionId]
        const lastAssistant = session?.messages
          ? [...session.messages].reverse().find((m) => m.type === 'assistant_text')
          : undefined
        if (session?.chatState === 'idle') {
          resolve(lastAssistant && session.messages.length > beforeCount ? lastAssistant.content : '')
          return
        }
        if (Date.now() - startedAt > WAIT_TIMEOUT_MS) {
          resolve(lastAssistant?.content ?? '')
          return
        }
        setTimeout(check, 500)
      }
      check()
    })
  }, [])

  const handleGenerate = async () => {
    if (busy) return
    setBusy(true)
    setImported(false)
    setOutput('')
    let sessionId: string | null = null
    try {
      // 读取知识库内容
      const { content: kbContent } = await retrieveKnowledgeContext(question || '产品工艺分析')
      const prompt = PROMPTS[mode]
      sessionId = await createSession(undefined, { permissionMode: 'default', mode: 'expert' })
      useExpertSessionsStore.getState().register(sessionId, '__ai__', 'AI 生成任务')
      // 必须建立连接并注册消息处理器，否则 sendMessage 后收不到回复
      connectToSession(sessionId)
      const beforeCount = useChatStore.getState().sessions[sessionId]?.messages.length ?? 0
      const message = [
        `[系统提示]\n${prompt}`,
        kbContent.trim() ? `[知识库内容]\n${kbContent}` : '',
        question.trim() ? `[用户要求]\n${question.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
      sendMessage(sessionId, message, undefined)
      const reply = await waitForReply(sessionId, beforeCount)
      setOutput(reply.trim())
    } catch (err) {
      console.error('AI generate failed:', err)
      setOutput('生成失败，请稍后重试。')
    } finally {
      if (sessionId) {
        useChatStore.getState().disconnectSession(sessionId)
      }
      setBusy(false)
    }
  }

  const handleImport = () => {
    if (!output.trim()) return
    const flow = useProcessFlowStore.getState()
    let count = 0
    const lines = output.split('\n').map((l) => l.trim()).filter(Boolean)
    if (mode === 'process') {
      // 每行：工序号|工序名称|设备
      lines.forEach((line, i) => {
        const parts = line.split(/[|｜]/).map((p) => p.trim())
        const stepNo = parts[0] || `Op ${(i + 1) * 10}`
        const name = parts[1] || parts[0] || '工序'
        const equipment = parts[2] || ''
        flow.addNode('operation', i * 280, 0)
        const nodeId = useProcessFlowStore.getState().selectedNodeId
        if (nodeId) flow.updateNode(nodeId, { stepNo, name, equipment })
        count++
      })
    } else if (mode === 'pfmea') {
      const node = useProcessFlowStore.getState().nodes.find(
        (n) => n.id === useProcessFlowStore.getState().selectedNodeId,
      )
      if (!node) {
        alert('请先在流程图中选中要导入失效模式的工序节点')
        return
      }
      // 每行：工序|失效模式|影响|原因|S|O|D
      for (const line of lines) {
        const parts = line.split(/[|｜]/).map((p) => p.trim())
        if (parts.length < 2) continue
        flow.addPfmea(node.id, {
          mode: parts[1] ?? '失效模式',
          severity: Math.max(0, Math.min(10, Number(parts[4]) || 5)),
          occurrence: Math.max(0, Math.min(10, Number(parts[5]) || 4)),
          detection: Math.max(0, Math.min(10, Number(parts[6]) || 5)),
          effects: parts[2] ? [{ id: `ai_${Date.now()}_1`, text: parts[2] }] : [],
          causes: parts[3] ? [{ id: `ai_${Date.now()}_2`, text: parts[3] }] : [],
          controls: [],
          actions: [],
        })
        count++
      }
    } else {
      alert('CP / WI 请复制生成内容后手动粘贴到表格中')
      return
    }
    setImported(true)
    alert(`已导入 ${count} 条${MODE_LABELS[mode]}数据`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`AI 自动填写 · ${MODE_LABELS[mode]}`}
      width={640}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
          <Button variant="secondary" size="sm" onClick={() => void handleGenerate()} disabled={busy}>
            {busy ? '生成中...' : '读取知识库并生成'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleImport} disabled={!output.trim() || imported}>
            {imported ? '已导入' : '导入到当前页面'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
          <p>
            系统会<b className="text-[var(--color-text-primary)]">读取当前知识库</b>中与问题相关的页面内容，
            由模型生成 {MODE_LABELS[mode]} 的文字版清单。确认内容无误后，点击
            <b className="text-[var(--color-text-primary)]">"导入到当前页面"</b>。
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">生成要求（可留空，使用默认提示）</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="例如：为电机装配线生成工艺流程（共 6 道工序）"
            className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-brand)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">生成结果</span>
            {output && (
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                {output.split('\n').filter((l) => l.trim()).length} 行
              </span>
            )}
          </div>
          <textarea
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            readOnly={!output}
            rows={10}
            placeholder={busy ? '正在读取知识库并生成...' : '生成结果将显示在这里，可手动编辑后导入。'}
            className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm leading-6 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-brand)] font-mono"
          />
          <p className="text-xs text-[var(--color-text-tertiary)]">
            导入格式：工序版「工序号|工序名称|设备」，PFMEA 版「工序|失效模式|影响|原因|S|O|D」。
          </p>
        </div>
      </div>
    </Modal>
  )
}
