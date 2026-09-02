import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SettingsCheckboxMark, SETTINGS_CHECKBOX_INPUT_CLASS } from '@/pages/settings/shared'
import { useProjectStore, type ExpertConfig } from '../../stores/projectStore'
import { useWikiStore } from '../../stores/wikiStore'
import { wikiApi, type BrowseEntry } from '../../api/wikiClient'
import { skillsApi } from '../../api/skills'
import type { SkillMeta } from '../../types/skill'
import { localFileUrl } from '../../lib/handlePreviewLink'
import { getServerBaseUrl } from '../../lib/desktopRuntime'

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
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']

type Props = {
  open: boolean
  initial: ExpertConfig | null
  onClose: () => void
}

function emptyForm(): ExpertConfig {
  return {
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
    enabled: true,
    isManager: false,
  }
}

export function ExpertFormModal({ open, initial, onClose }: Props) {
  const { addExpert, updateExpert, setProjectManagerId } = useProjectStore()
  const { repos, fetchRepos } = useWikiStore()
  const [skills, setSkills] = useState<SkillMeta[]>([])
  const [form, setForm] = useState<ExpertConfig>(emptyForm())
  const [showPicker, setShowPicker] = useState(false)
  const [pickerPath, setPickerPath] = useState('')
  const [pickerFiles, setPickerFiles] = useState<BrowseEntry[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)

  // 弹窗打开时同步表单，并拉取知识库与技能
  useEffect(() => {
    if (!open) return
    setForm(initial ? { ...emptyForm(), ...initial } : emptyForm())
    setShowPicker(false)
    void fetchRepos()
    void skillsApi.list().then((res) => setSkills(res.skills)).catch(() => {})
  }, [open, initial, fetchRepos])

  const loadPickerDir = async (dirPath?: string) => {
    setPickerLoading(true)
    try {
      const result = await wikiApi.browseDir(dirPath)
      setPickerPath(result.currentPath)
      setPickerFiles(result.files)
    } catch {
      // 目录不可读时忽略
    } finally {
      setPickerLoading(false)
    }
  }

  const openPicker = () => {
    setShowPicker(true)
    void loadPickerDir()
  }

  const pickImage = (entry: BrowseEntry) => {
    const ext = (entry.name.split('.').pop() || '').toLowerCase()
    if (!IMAGE_EXTS.includes(ext)) return
    setForm((prev) => ({
      ...prev,
      avatar: entry.name,
      avatarPath: entry.fullPath,
    }))
    setShowPicker(false)
  }

  const avatarUrl = form.avatarPath
    ? localFileUrl(getServerBaseUrl(), form.avatarPath)
    : null

  const handleSave = () => {
    if (!form.name.trim()) return
    if (form.isManager && form.id) {
      // 设为项目经理：由 store 统一维护 projectManagerId 与 isManager 标记
      setProjectManagerId(form.id)
    }
    if (initial) {
      updateExpert(initial.id, { ...form, isManager: form.isManager })
      if (initial.isManager && !form.isManager) setProjectManagerId(null)
    } else {
      const id = `expert-${Date.now()}`
      addExpert({ ...form, id })
      if (form.isManager) setProjectManagerId(id)
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? '编辑专家' : '新增专家'} width={620}>
      <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* 头像 */}
        <section>
          <span className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">头像</span>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-3xl shrink-0"
              style={{
                backgroundColor: (AGENT_COLORS[form.color] || '#a855f7') + '18',
                border: `2px solid ${(AGENT_COLORS[form.color] || '#a855f7')}25`,
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={form.name || '头像'} className="w-full h-full object-cover" />
              ) : (
                form.avatar
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap max-w-[440px]">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, avatar: emoji, avatarPath: undefined }))}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-base transition-all ${
                      form.avatar === emoji && !form.avatarPath
                        ? 'bg-[var(--color-brand)]/10 ring-2 ring-[var(--color-brand)]'
                        : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <Button variant="secondary" size="sm" icon={<span className="material-symbols-outlined text-[14px]">folder_open</span>} onClick={openPicker}>
                从文件夹选择图片作为头像
              </Button>
            </div>
          </div>

          {/* 文件夹图片选择器 */}
          {showPicker && (
            <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => void loadPickerDir()}
                  className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                  title="根目录"
                >
                  <span className="material-symbols-outlined text-[16px]">home</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const parent = pickerPath.split(/[\\/]/).slice(0, -1).join('\\') || 'root'
                    void loadPickerDir(parent)
                  }}
                  className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                  title="上一级"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                </button>
                <code className="flex-1 truncate text-xs text-[var(--color-text-tertiary)]">{pickerPath}</code>
              </div>
              <div className="max-h-[180px] overflow-y-auto grid grid-cols-4 gap-2">
                {pickerFiles
                  .filter((entry) => entry.isDirectory || IMAGE_EXTS.includes((entry.name.split('.').pop() || '').toLowerCase()))
                  .map((entry) => (
                    <button
                      key={entry.fullPath}
                      type="button"
                      onClick={() => (entry.isDirectory ? void loadPickerDir(entry.fullPath) : pickImage(entry))}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)] transition-all"
                      title={entry.fullPath}
                    >
                      <span className={`material-symbols-outlined text-[20px] ${entry.isDirectory ? 'text-[#eab308]' : 'text-[var(--color-brand)]'}`}>
                        {entry.isDirectory ? 'folder' : 'image'}
                      </span>
                      <span className="w-full truncate text-[10px] text-[var(--color-text-secondary)] text-center">{entry.name}</span>
                    </button>
                  ))}
              </div>
              {pickerLoading && (
                <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">正在加载...</p>
              )}
            </div>
          )}
        </section>

        {/* 名称 / 描述 / 范围 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="名称"
            required
            value={form.name}
            placeholder="输入专家名称"
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">配置范围</span>
            <select
              value={form.scope}
              onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value as 'user' | 'project' }))}
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="user">用户</option>
              <option value="project">项目</option>
            </select>
          </div>
        </div>
        <Input
          label="描述"
          value={form.description}
          placeholder="描述这个专家的职责"
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
        />

        {/* 模型 / 推理强度 / 工具 / 颜色 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">模型</span>
            <select
              value={form.model}
              onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
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
              onChange={(e) => setForm((prev) => ({ ...prev, effort: e.target.value }))}
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="inherit">继承</option>
              {EFFORTS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">工具</span>
            <select
              value={form.toolAccess}
              onChange={(e) => setForm((prev) => ({ ...prev, toolAccess: e.target.value as 'inherit' | 'none' | 'custom' }))}
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
              onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
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
            onChange={(e) => setForm((prev) => ({ ...prev, tools: e.target.value }))}
          />
        )}
        {form.model === 'custom' && (
          <Input
            label="自定义模型 ID"
            value={form.customModel}
            placeholder="输入模型 ID"
            onChange={(e) => setForm((prev) => ({ ...prev, customModel: e.target.value }))}
          />
        )}

        {/* 系统提示词 */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">系统提示词</span>
          <textarea
            value={form.systemPrompt}
            rows={5}
            placeholder="输入系统提示词..."
            onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
            className="min-h-[110px] resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
          />
        </div>

        {/* Skills */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">使用的 Skills</span>
          {skills.length === 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)]">暂无可用 Skill</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto p-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
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
                        setForm((prev) => ({ ...prev, skills: [...prev.skills, skill.name] }))
                      } else {
                        setForm((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill.name) }))
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

        {/* 知识库：下拉选择（显示地址）或指定地址 */}
        <section>
          <span className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">知识库</span>
          <select
            value={form.knowledgeRepo}
            onChange={(e) => setForm((prev) => ({ ...prev, knowledgeRepo: e.target.value, knowledgeRepoPath: undefined }))}
            className="w-full h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="">不选择知识库</option>
            {repos.map((repo) => (
              <option key={repo.name} value={repo.name}>{repo.name}</option>
            ))}
          </select>
          {form.knowledgeRepo && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)] break-all">
              <span className="material-symbols-outlined shrink-0 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>folder_open</span>
              <code className="font-mono">{repos.find((r) => r.name === form.knowledgeRepo)?.path || ''}</code>
            </div>
          )}
          <div className="mt-3">
            <Input
              label="或指定知识库地址"
              value={form.knowledgeRepoPath ?? ''}
              placeholder="输入知识库文件夹的绝对路径（优先于下拉选择）"
              onChange={(e) => setForm((prev) => ({ ...prev, knowledgeRepoPath: e.target.value || undefined }))}
            />
          </div>
        </section>

        {/* 激活 / 项目经理 */}
        <section className="flex flex-col gap-2">
          <label className="relative flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3 cursor-pointer hover:border-[var(--color-border-focus)] transition-colors">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
              className={SETTINGS_CHECKBOX_INPUT_CLASS}
            />
            <SettingsCheckboxMark checked={form.enabled} />
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">激活该专家</div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5 leading-5">
                关闭后该专家不会出现在 Ask expert 与 Meeting 的候选中。
              </div>
            </div>
          </label>
          <label className="relative flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3 cursor-pointer hover:border-[var(--color-border-focus)] transition-colors">
            <input
              type="checkbox"
              checked={form.isManager ?? false}
              onChange={(e) => setForm((prev) => ({ ...prev, isManager: e.target.checked }))}
              className={SETTINGS_CHECKBOX_INPUT_CLASS}
            />
            <SettingsCheckboxMark checked={form.isManager ?? false} />
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">设为项目经理 (PM)</div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5 leading-5">
                项目经理也是专家，负责会议模板管理与会议进度推进。
              </div>
            </div>
          </label>
        </section>

        {/* 操作 */}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="primary" onClick={handleSave}>保存</Button>
          <Button variant="secondary" onClick={onClose}>取消</Button>
        </div>
      </div>
    </Modal>
  )
}
