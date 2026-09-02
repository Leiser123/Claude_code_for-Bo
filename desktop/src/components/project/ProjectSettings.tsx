import { useState } from 'react'
import { ArrowLeft, Plus, Bot } from 'lucide-react'
import { useProjectStore, type ExpertConfig } from '../../stores/projectStore'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ExpertFormModal } from './ExpertFormModal'

const AGENT_COLORS: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
  cyan: '#06b6d4',
}

export function ProjectSettings() {
  const { experts, updateExpert, removeExpert, switchSection, selectedExpertId, setSelectedExpertId, projectManagerId, setProjectManagerId } = useProjectStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ExpertConfig | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // 激活/关闭开关：直接更新专家并固化到 ~/.claude
  const toggleEnabled = (expert: ExpertConfig) => {
    updateExpert(expert.id, { enabled: !expert.enabled })
  }

  const handleDelete = () => {
    if (deleteTarget) {
      removeExpert(deleteTarget)
      setDeleteTarget(null)
    }
  }

  const selectedExpert = experts.find((e) => e.id === selectedExpertId)
  const manager = experts.find((e) => e.id === projectManagerId)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => switchSection('project')}
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft size={16} />
            返回
          </button>
          <div className="h-5 w-px bg-[var(--color-border)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Project 设置</span>
        </div>

        {/* 功能说明 */}
        <section className="mb-8">
          <h2 className="text-[16.5px] font-semibold leading-tight text-[var(--color-text-primary)] mb-1" style={{ fontFamily: 'var(--font-headline)' }}>
            专家 (Expert)
          </h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            <p>
              管理参与 <b className="text-[var(--color-text-primary)]">Ask expert</b> 与{' '}
              <b className="text-[var(--color-text-primary)]">Meeting</b> 的专家。每个专家可配置独立的系统提示词、知识库与技能。
            </p>
            <p className="mt-2">
              设置会自动<b className="text-[var(--color-text-primary)]">固化到 ~/.claude/cc-haha/expert-settings/</b>，
              下次打开或重启后依然生效。
            </p>
          </div>
        </section>

        {/* 项目经理 */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16.5px] font-semibold leading-tight text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-headline)' }}>
              项目经理 (PM)
            </h2>
          </div>
          {manager ? (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/5 px-4 py-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{
                  backgroundColor: (AGENT_COLORS[manager.color] || '#a855f7') + '18',
                  border: `2px solid ${(AGENT_COLORS[manager.color] || '#a855f7')}25`,
                }}
              >
                {manager.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{manager.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                    项目经理
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                  负责管理会议模板与会议进度
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setProjectManagerId(null)}>
                取消
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-6 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">
                尚未设置项目经理。编辑任意专家并在弹窗中勾选"设为项目经理 (PM)"即可。
              </p>
            </div>
          )}
        </section>

        {/* 专家列表 */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16.5px] font-semibold leading-tight text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-headline)' }}>
              专家列表
            </h2>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => { setEditing(null); setModalOpen(true) }}>
              新增专家
            </Button>
          </div>

          {experts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-8 text-center">
              <Bot className="mx-auto mb-2 text-[var(--color-text-tertiary)]" size={32} />
              <p className="text-sm text-[var(--color-text-secondary)]">暂无专家，点击"新增专家"创建</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {experts.map((expert) => (
                <div
                  key={expert.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                    !expert.enabled
                      ? 'opacity-60 border-[var(--color-border)] bg-[var(--color-surface-container-low)]'
                      : selectedExpertId === expert.id
                        ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-container-low)] hover:border-[var(--color-border-focus)]'
                  }`}
                  onClick={() => setSelectedExpertId(expert.id)}
                >
                  <span className="text-2xl">{expert.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{expert.name}</span>
                      {expert.isManager && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                          PM
                        </span>
                      )}
                      {!expert.enabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-container)] text-[var(--color-text-tertiary)]">
                          已停用
                        </span>
                      )}
                      {expert.model !== 'inherit' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-container)] text-[var(--color-text-tertiary)]">
                          {expert.model}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                      {expert.description || '暂无描述'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* 激活开关 */}
                    <label
                      className="relative inline-flex items-center cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      title={expert.enabled ? '点击停用' : '点击激活'}
                    >
                      <input
                        type="checkbox"
                        checked={expert.enabled}
                        onChange={() => toggleEnabled(expert)}
                        className="sr-only peer"
                      />
                      <span className="w-9 h-5 rounded-full bg-[var(--color-surface-container)] border border-[var(--color-border)] peer-checked:bg-[var(--color-brand)] peer-checked:border-[var(--color-brand)] transition-colors" />
                      <span className="absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                    </label>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditing(expert); setModalOpen(true) }}
                      className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(expert.id) }}
                      className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 当前选中的专家摘要 */}
        {selectedExpert && (
          <section className="rounded-2xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/5 p-4">
            <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">当前选中的专家</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedExpert.avatar}</span>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{selectedExpert.name}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  模型: {selectedExpert.model === 'inherit' ? '继承' : selectedExpert.customModel || selectedExpert.model}
                  {selectedExpert.knowledgeRepo && ` · 知识库: ${selectedExpert.knowledgeRepo}`}
                  {selectedExpert.knowledgeRepoPath && ` · 知识库地址: ${selectedExpert.knowledgeRepoPath}`}
                  {selectedExpert.skills.length > 0 && ` · ${selectedExpert.skills.length} 个 Skill`}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      <ExpertFormModal
        open={modalOpen}
        initial={editing}
        onClose={() => { setModalOpen(false); setEditing(null) }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除专家"
        body="确定删除此专家吗？此操作不可撤销。"
        confirmLabel="删除"
        cancelLabel="取消"
      />
    </div>
  )
}
