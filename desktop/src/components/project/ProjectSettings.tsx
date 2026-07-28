import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  Plus,
  Save,
} from 'lucide-react'
import { useProjectStore, type ExpertConfig } from '../../stores/projectStore'
import { useWikiStore } from '../../stores/wikiStore'
import { skillsApi } from '../../api/skills'
import type { SkillMeta } from '../../types/skill'
import { Input } from '../shared/Input'
import { Button } from '../shared/Button'
import { ConfirmDialog } from '../shared/ConfirmDialog'

const AVATAR_OPTIONS = ['🤖', '🧠', '⚡', '🛡️', '🔬', '🎨', '📊', '🔧', '📝', '🎯', '💡', '🌟']
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
const BUILT_IN_MODELS = ['haiku', 'sonnet', 'opus', 'fable'] as const
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export function ProjectSettings() {
  const { experts, addExpert, updateExpert, removeExpert, switchSection, selectedExpertId, setSelectedExpertId } = useProjectStore()
  const { repos, fetchRepos } = useWikiStore()
  const [skills, setSkills] = useState<SkillMeta[]>([])
  const [editingExpert, setEditingExpert] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [form, setForm] = useState<ExpertConfig>({
    id: '',
    name: '',
    description: '',
    avatar: '🤖',
    color: '',
    model: 'inherit',
    customModel: '',
    effort: 'inherit',
    toolAccess: 'inherit',
    tools: '',
    scope: 'user',
    systemPrompt: '',
    skills: [],
    knowledgeRepo: '',
  })

  useEffect(() => {
    void fetchRepos()
    void skillsApi.list().then((res) => setSkills(res.skills)).catch(() => {})
  }, [fetchRepos])

  const resetForm = () => {
    setForm({
      id: '',
      name: '',
      description: '',
      avatar: '🤖',
      color: '',
      model: 'inherit',
      customModel: '',
      effort: 'inherit',
      toolAccess: 'inherit',
      tools: '',
      scope: 'user',
      systemPrompt: '',
      skills: [],
      knowledgeRepo: '',
    })
    setEditingExpert(null)
  }

  const handleEdit = (expert: ExpertConfig) => {
    setForm({ ...expert })
    setEditingExpert(expert.id)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editingExpert) {
      updateExpert(editingExpert, form)
    } else {
      const id = `expert-${Date.now()}`
      addExpert({ ...form, id })
    }
    resetForm()
  }

  const handleDelete = () => {
    if (deleteTarget) {
      removeExpert(deleteTarget)
      setDeleteTarget(null)
    }
  }

  const selectedExpert = experts.find((e) => e.id === selectedExpertId)

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

        {/* Expert list */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">专家 (Expert)</h2>
            <Button size="sm" icon={<Plus size={14} />} onClick={resetForm}>
              新增专家
            </Button>
          </div>

          {experts.length === 0 && !editingExpert ? (
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
                    selectedExpertId === expert.id
                      ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-container-low)] hover:border-[var(--color-border-focus)]'
                  }`}
                  onClick={() => setSelectedExpertId(expert.id)}
                >
                  <span className="text-2xl">{expert.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{expert.name}</span>
                      {expert.model !== 'inherit' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-container)] text-[var(--color-text-tertiary)]">
                          {expert.model}
                        </span>
                      )}
                      {selectedExpertId === expert.id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                          当前
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                      {expert.description || '暂无描述'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(expert) }}
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

        {/* Expert form */}
        {(editingExpert !== null || form.id === '') && (
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
              {editingExpert ? '编辑专家' : '新增专家'}
            </h3>
            <div className="grid gap-4">
              {/* Avatar */}
              <div>
                <span className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">头像</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {AVATAR_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setForm({ ...form, avatar: emoji })}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-all ${
                        form.avatar === emoji
                          ? 'bg-[var(--color-brand)]/10 ring-2 ring-[var(--color-brand)]'
                          : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Scope */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="名称"
                  required
                  value={form.name}
                  placeholder="输入专家名称"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">配置范围</span>
                  <select
                    value={form.scope}
                    onChange={(e) => setForm({ ...form, scope: e.target.value as 'user' | 'project' })}
                    className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
                  >
                    <option value="user">用户</option>
                    <option value="project">项目</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <Input
                label="描述"
                value={form.description}
                placeholder="描述这个专家的职责"
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              {/* Model & Effort */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">模型</span>
                  <select
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
                  >
                    <option value="inherit">继承</option>
                    {BUILT_IN_MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">推理强度</span>
                  <select
                    value={form.effort}
                    onChange={(e) => setForm({ ...form, effort: e.target.value })}
                    className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
                  >
                    <option value="inherit">继承</option>
                    {EFFORTS.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom model */}
              {form.model === 'custom' && (
                <Input
                  label="自定义模型 ID"
                  value={form.customModel}
                  placeholder="输入模型 ID"
                  onChange={(e) => setForm({ ...form, customModel: e.target.value })}
                />
              )}

              {/* Tools */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">工具</span>
                  <select
                    value={form.toolAccess}
                    onChange={(e) => setForm({ ...form, toolAccess: e.target.value as 'inherit' | 'none' | 'custom' })}
                    className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
                  >
                    <option value="inherit">继承（使用全部工具）</option>
                    <option value="none">禁用全部工具</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">颜色</span>
                  <select
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
                  >
                    <option value="">默认</option>
                    {Object.keys(AGENT_COLORS).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.toolAccess === 'custom' && (
                <Input
                  label="允许使用的工具"
                  value={form.tools}
                  placeholder="Read, Grep, Bash"
                  onChange={(e) => setForm({ ...form, tools: e.target.value })}
                />
              )}

              {/* System Prompt */}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">系统提示词</span>
                <textarea
                  value={form.systemPrompt}
                  rows={6}
                  placeholder="输入系统提示词..."
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  className="min-h-[120px] resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
                />
              </div>

              {/* Skills */}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">使用的 Skills</span>
                {skills.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-tertiary)]">暂无可用 Skill</p>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto p-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                    {skills.map((skill) => (
                      <label
                        key={skill.name}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                          form.skills.includes(skill.name)
                            ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)] border border-[var(--color-brand)]/20'
                            : 'bg-[var(--color-surface-container)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-focus)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.skills.includes(skill.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, skills: [...form.skills, skill.name] })
                            } else {
                              setForm({ ...form, skills: form.skills.filter((s) => s !== skill.name) })
                            }
                          }}
                          className="sr-only"
                        />
                        {skill.displayName || skill.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Knowledge Repo */}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Knowledge 仓库</span>
                <select
                  value={form.knowledgeRepo}
                  onChange={(e) => setForm({ ...form, knowledgeRepo: e.target.value })}
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
                >
                  <option value="">不选择</option>
                  {repos.map((repo) => (
                    <option key={repo.name} value={repo.name}>{repo.name}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button icon={<Save size={14} />} onClick={handleSave}>
                  保存
                </Button>
                <Button variant="secondary" onClick={resetForm}>
                  取消
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Current selection summary */}
        {selectedExpert && (
          <section className="mt-6 rounded-2xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/5 p-4">
            <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">当前选中的专家</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedExpert.avatar}</span>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{selectedExpert.name}</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  模型: {selectedExpert.model === 'inherit' ? '继承' : selectedExpert.customModel || selectedExpert.model}
                  {selectedExpert.knowledgeRepo && ` · 知识库: ${selectedExpert.knowledgeRepo}`}
                  {selectedExpert.skills.length > 0 && ` · ${selectedExpert.skills.length} 个 Skill`}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

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
