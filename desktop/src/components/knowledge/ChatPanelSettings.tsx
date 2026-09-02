import { useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SettingsCheckboxMark, SETTINGS_CHECKBOX_INPUT_CLASS } from '@/pages/settings/shared'
import { useWikiChatStore } from '../../stores/wikiChatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useWikiStore } from '../../stores/wikiStore'

type Props = {
  open: boolean
  onClose: () => void
}

export function ChatPanelSettings({ open, onClose }: Props) {
  const settings = useWikiChatStore()
  const thinkingEnabled = useSettingsStore((s) => s.thinkingEnabled)
  const setThinkingEnabled = useSettingsStore((s) => s.setThinkingEnabled)
  const wikiRootPath = useWikiStore((s) => s.wikiRootPath)
  const currentWiki = useWikiStore((s) => s.currentWiki)

  useEffect(() => {
    if (open) {
      void useWikiChatStore.getState().loadFromClaude()
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="知识库聊天设置"
      width={560}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => settings.reset()}>
            恢复默认
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            完成
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-7">
        {/* 功能说明 */}
        <section>
          <h3 className="text-[16.5px] font-semibold leading-tight text-[var(--color-text-primary)] mb-1" style={{ fontFamily: 'var(--font-headline)' }}>
            功能说明
          </h3>
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            <p>
              知识库聊天是<b className="text-[var(--color-text-primary)]">纯对话模式</b>：系统会引导模型按 llm-wiki 的
              query 流程查询知识库内容（仅使用只读工具），不会修改任何文件。
            </p>
          </div>
        </section>

        {/* 系统提示词 */}
        <section>
          <h3 className="text-[16.5px] font-semibold leading-tight text-[var(--color-text-primary)] mb-1" style={{ fontFamily: 'var(--font-headline)' }}>
            系统提示词
          </h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-3">
            附加在默认提示词之后，用于规定模型的回答角度与方式。
          </p>
          <textarea
            value={settings.systemPrompt}
            onChange={(e) => settings.setSystemPrompt(e.target.value)}
            placeholder="例如：请用通俗易懂的语言解释，并给出具体示例。"
            rows={4}
            className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-sm leading-6 text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] transition-colors focus:border-[var(--color-brand)] focus:outline-none"
          />
        </section>

        {/* 知识库检索 */}
        <section>
          <h3 className="text-[16.5px] font-semibold leading-tight text-[var(--color-text-primary)] mb-1" style={{ fontFamily: 'var(--font-headline)' }}>
            知识库检索
          </h3>
          <label className="relative flex items-start gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3 cursor-pointer hover:border-[var(--color-border-focus)] transition-colors">
            <input
              type="checkbox"
              checked={settings.useKnowledgeContext}
              onChange={(e) => settings.setUseKnowledgeContext(e.target.checked)}
              className={SETTINGS_CHECKBOX_INPUT_CLASS}
            />
            <SettingsCheckboxMark checked={settings.useKnowledgeContext} />
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                以当前知识库为检索依据
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-1 leading-5">
                发送问题时，系统会自动检索当前知识库中与问题最相关的几个页面，将页面内容随问题一并提供给模型，并在聊天窗口展示可点击的页面依据链接。
              </div>
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)] break-all">
                <span className="material-symbols-outlined shrink-0 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  folder_open
                </span>
                <code className="font-mono">{wikiRootPath || '(尚未打开知识库)'}</code>
                {currentWiki && currentWiki !== wikiRootPath && (
                  <span className="shrink-0 text-[var(--color-text-tertiary)]">（{currentWiki}）</span>
                )}
              </div>
            </div>
          </label>
        </section>

        {/* 思考模式 */}
        <section>
          <h3 className="text-[16.5px] font-semibold leading-tight text-[var(--color-text-primary)] mb-1" style={{ fontFamily: 'var(--font-headline)' }}>
            思考模式
          </h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-3">
            关闭思考模式可加快知识库问答响应。该设置写入 ~/.claude/settings.json，对所有会话生效。
          </p>
          <label className="relative flex items-start gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3 cursor-pointer hover:border-[var(--color-border-focus)] transition-colors">
            <input
              type="checkbox"
              checked={thinkingEnabled}
              onChange={(e) => void setThinkingEnabled(e.target.checked)}
              className={SETTINGS_CHECKBOX_INPUT_CLASS}
            />
            <SettingsCheckboxMark checked={thinkingEnabled} />
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                启用思考模式
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-1 leading-5">
                关闭后模型直接回答，不再进行推理思考。
              </div>
            </div>
          </label>
        </section>

        {/* 固化状态提示 */}
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            save
          </span>
          所有设置修改后自动保存到本地并固化到 ~/.claude/settings.json
        </p>
      </div>
    </Modal>
  )
}
