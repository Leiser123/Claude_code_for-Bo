import { useState } from 'react'
import { useProcessFlowStore } from './processFlowStore'

type CpRow = {
  id: string
  stepNo: string
  processName: string
  charType: string
  charName: string
  spec: string
  method: string
  sample: string
  reaction: string
}

const STORAGE_KEY = 'cc-haha-cp'

function buildRowsFromFlow(): CpRow[] {
  const { nodes } = useProcessFlowStore.getState()
  const rows: CpRow[] = []
  for (const node of nodes) {
    if (node.type !== 'operation' && node.type !== 'inspection') continue
    const base = {
      id: `cp-${node.id}`,
      stepNo: node.stepNo || node.code || node.name,
      processName: node.name,
      method: node.type === 'inspection' ? '检验' : '首末件 + 巡检',
      sample: node.type === 'inspection' ? '每件' : '每班首件',
      reaction: '隔离可疑品，通知工艺工程师',
    }
    const chars = node.productChars.length > 0
      ? node.productChars
      : node.processParams.length > 0
        ? node.processParams
        : ['']
    rows.push(
      ...chars.map((c, i) => ({
        ...base,
        id: `${base.id}-${i}`,
        charType: i === 0 && node.productChars.length > 0 ? '产品特性' : '过程参数',
        charName: c,
        spec: '',
      })),
    )
  }
  return rows
}

function loadRows(): CpRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // ignore
  }
  return buildRowsFromFlow()
}

function persist(rows: CpRow[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  } catch {
    // ignore
  }
}

export function CpTable() {
  const [rows, setRows] = useState<CpRow[]>(loadRows)

  const updateRow = (id: string, patch: Partial<CpRow>) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    setRows(next)
    persist(next)
  }

  const addRow = () => {
    const next = [
      ...rows,
      { id: `cp-${Date.now()}`, stepNo: '', processName: '', charType: '过程参数', charName: '', spec: '', method: '', sample: '', reaction: '' },
    ]
    setRows(next)
    persist(next)
  }

  const removeRow = (id: string) => {
    const next = rows.filter((r) => r.id !== id)
    setRows(next)
    persist(next)
  }

  const regenerate = () => {
    const next = buildRowsFromFlow()
    setRows(next)
    persist(next)
  }

  return (
    <div className="h-full overflow-auto p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-headline)' }}>
            CP · 控制计划 (Control Plan)
          </h2>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            基于工艺流程自动生成，可手动编辑调整。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={regenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container)] transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
            从流程重新生成
          </button>
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-brand)] bg-[var(--color-brand)]/10 hover:bg-[var(--color-brand)]/15 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            新增行
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="text-left text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
              <th className="px-3 py-2 font-medium w-[80px]">工序号</th>
              <th className="px-3 py-2 font-medium">工序</th>
              <th className="px-3 py-2 font-medium w-[90px]">类型</th>
              <th className="px-3 py-2 font-medium">特性/参数</th>
              <th className="px-3 py-2 font-medium">规格</th>
              <th className="px-3 py-2 font-medium">控制方法</th>
              <th className="px-3 py-2 font-medium">抽样</th>
              <th className="px-3 py-2 font-medium">反应计划</th>
              <th className="px-3 py-2 w-[40px]" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-xs text-[var(--color-text-tertiary)]">
                  暂无控制计划数据。点击"从流程重新生成"或"新增行"开始。
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-border)]/50 last:border-0 hover:bg-[var(--color-surface-container-low)]/60">
                  <td className="px-2 py-1.5">
                    <input value={row.stepNo} onChange={(e) => updateRow(row.id, { stepNo: e.target.value })}
                      className="w-full bg-transparent px-1.5 py-1 rounded-md text-xs text-[var(--color-text-primary)] outline-none focus:bg-[var(--color-surface-container)]" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={row.processName} onChange={(e) => updateRow(row.id, { processName: e.target.value })}
                      className="w-full bg-transparent px-1.5 py-1 rounded-md text-xs text-[var(--color-text-primary)] outline-none focus:bg-[var(--color-surface-container)]" />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={row.charType}
                      onChange={(e) => updateRow(row.id, { charType: e.target.value })}
                      className="w-full bg-transparent px-1 py-1 rounded-md text-xs text-[var(--color-text-primary)] outline-none focus:bg-[var(--color-surface-container)]"
                    >
                      <option value="产品特性">产品特性</option>
                      <option value="过程参数">过程参数</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={row.charName} onChange={(e) => updateRow(row.id, { charName: e.target.value })}
                      className="w-full bg-transparent px-1.5 py-1 rounded-md text-xs text-[var(--color-text-primary)] outline-none focus:bg-[var(--color-surface-container)]" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={row.spec} onChange={(e) => updateRow(row.id, { spec: e.target.value })}
                      className="w-full bg-transparent px-1.5 py-1 rounded-md text-xs text-[var(--color-text-primary)] outline-none focus:bg-[var(--color-surface-container)]" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={row.method} onChange={(e) => updateRow(row.id, { method: e.target.value })}
                      className="w-full bg-transparent px-1.5 py-1 rounded-md text-xs text-[var(--color-text-primary)] outline-none focus:bg-[var(--color-surface-container)]" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={row.sample} onChange={(e) => updateRow(row.id, { sample: e.target.value })}
                      className="w-full bg-transparent px-1.5 py-1 rounded-md text-xs text-[var(--color-text-primary)] outline-none focus:bg-[var(--color-surface-container)]" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={row.reaction} onChange={(e) => updateRow(row.id, { reaction: e.target.value })}
                      className="w-full bg-transparent px-1.5 py-1 rounded-md text-xs text-[var(--color-text-primary)] outline-none focus:bg-[var(--color-surface-container)]" />
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => removeRow(row.id)}
                      className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/5"
                      title="删除该行">
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
