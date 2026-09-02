import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useProjectStore, type ProjectCategory, type ProjectLifecycle } from '../../stores/projectStore'
import { CATEGORIES } from './projectBoardMeta'

type Props = { open: boolean; onClose: () => void }

export function ProjectEditModal({ open, onClose }: Props) {
  const addProject = useProjectStore((s) => s.addProject)
  const [form, setForm] = useState({
    name: '',
    projectCode: '',
    category: 'WS' as ProjectCategory,
    state: 'in_development' as ProjectLifecycle,
    description: '',
    completion: 0,
    specLabel: 'Power',
    specValue: '',
    timeline: '',
    voltage: '12V DC',
    features: '',
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const handleSave = () => {
    if (!form.name.trim()) return
    addProject({
      id: `prj-${Date.now()}`,
      name: form.name.trim(),
      projectCode: form.projectCode.trim() || `NEW-${Date.now().toString().slice(-6)}`,
      category: form.category,
      state: form.state,
      description: form.description.trim(),
      timeline: form.timeline.trim(),
      completion: Math.max(0, Math.min(100, Number(form.completion) || 0)),
      specLabel: form.specLabel.trim() || 'Power',
      specValue: form.specValue.trim(),
      voltage: form.voltage.trim() || '12V DC',
      keyFeatures: form.features
        .split(/[\n,;；]/)
        .map((s) => s.trim())
        .filter(Boolean),
      team: [],
      docs: [],
      processes: [],
    })
    onClose()
  }

  const selectCls =
    'h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新建项目"
      width={620}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!form.name.trim()}>
            创建项目
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="项目名称" required value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="例如：Window Lift Motor" />
          <Input label="项目编号 (Project ID)" value={form.projectCode} onChange={(e) => set({ projectCode: e.target.value })} placeholder="例如：WS-2023-042" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">类别</span>
            <select className={selectCls} value={form.category} onChange={(e) => set({ category: e.target.value as ProjectCategory })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">状态</span>
            <select className={selectCls} value={form.state} onChange={(e) => set({ state: e.target.value as ProjectLifecycle })}>
              <option value="in_development">In Development</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">完成度 %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={form.completion}
              onChange={(e) => set({ completion: Number(e.target.value) })}
              className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
            />
          </div>
        </div>
        <Input label="简介" value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="一句话描述项目目标" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="规格字段名" value={form.specLabel} onChange={(e) => set({ specLabel: e.target.value })} placeholder="Power / Torque / Current ..." />
          <Input label="规格值" value={form.specValue} onChange={(e) => set({ specValue: e.target.value })} placeholder="例如：80-120W" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="时间线" value={form.timeline} onChange={(e) => set({ timeline: e.target.value })} placeholder="例如：Mar 2023 - Jan 2024" />
          <Input label="电压" value={form.voltage} onChange={(e) => set({ voltage: e.target.value })} placeholder="12V DC" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">关键特性（每行一条）</span>
          <textarea
            value={form.features}
            rows={3}
            onChange={(e) => set({ features: e.target.value })}
            placeholder={'Noise reduction below 45dB\nIP67 waterproof rating'}
            className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-brand)]"
          />
        </div>
      </div>
    </Modal>
  )
}
