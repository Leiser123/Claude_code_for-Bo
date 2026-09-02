import { useState } from 'react'
import { useProjectStore, type ProcessDevelopmentTab } from '../../stores/projectStore'
import { useProcessFlowStore, MODE_LABELS, type WorkflowMode } from './processFlowStore'
import { ProcessFlowEditor } from './ProcessFlowEditor'
import { CpTable } from './CpTable'
import { AiImportPanel } from './AiImportPanel'

const TABS: { key: ProcessDevelopmentTab; label: string; icon: string; description: string }[] = [
  {
    key: 'processFlow',
    label: 'Process Flow',
    icon: 'account_tree',
    description: '工艺流程设计与管理，定义产品制造的步骤序列',
  },
  {
    key: 'pfmea',
    label: 'PFMEA',
    icon: 'analytics',
    description: '过程失效模式与影响分析，识别工艺潜在风险',
  },
  {
    key: 'cp',
    label: 'CP',
    icon: 'fact_check',
    description: '控制计划 (Control Plan)，定义工艺参数与检验方法',
  },
  {
    key: 'wi',
    label: 'WI',
    icon: 'description',
    description: '作业指导书 (Work Instruction)，标准化操作步骤文档',
  },
]

const TAB_TO_MODE: Record<ProcessDevelopmentTab, WorkflowMode> = {
  processFlow: 'process',
  pfmea: 'pfmea',
  cp: 'cp',
  wi: 'wi',
}

export function ProcessDevelopmentPage() {
  const processDevActiveTab = useProjectStore((s) => s.processDevActiveTab)
  const setProcessDevActiveTab = useProjectStore((s) => s.setProcessDevActiveTab)
  const setMode = useProcessFlowStore((s) => s.setMode)
  const toggleLock = useProcessFlowStore((s) => s.toggleLock)
  const mode = TAB_TO_MODE[processDevActiveTab]
  const modeLockState = useProcessFlowStore((s) => s.modeLockState)
  const locked = modeLockState[mode]
  const [aiOpen, setAiOpen] = useState(false)

  const activeTab = TABS.find((t) => t.key === processDevActiveTab) ?? TABS[0]!

  // 切换标签 = 切换工作模式，前置流程未锁定则禁止进入
  const handleTabClick = (tab: ProcessDevelopmentTab) => {
    const target = TAB_TO_MODE[tab]
    const ok = setMode(target)
    if (!ok) {
      const missing = (['process', 'pfmea', 'cp'] as WorkflowMode[])
        .slice(0, (['process', 'pfmea', 'cp', 'wi'] as WorkflowMode[]).indexOf(target))
        .filter((m) => !useProcessFlowStore.getState().modeLockState[m])
      alert(`⚠ 无法切换到 ${MODE_LABELS[target]}\n\n请先锁定前道工序：${missing.map((m) => MODE_LABELS[m]).join(' → ')}`)
      return
    }
    setProcessDevActiveTab(tab)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ==== Tabs Bar ==== */}
      <div className="shrink-0 border-b border-[var(--color-border-separator)]">
        <div className="flex items-center gap-1 px-5 py-2 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = processDevActiveTab === tab.key
            const tabMode = TAB_TO_MODE[tab.key]
            const tabLocked = modeLockState[tabMode]
            return (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                onContextMenu={(e) => {
                  // 右键标签直接切换该工序的锁定状态（后道已锁定时会一并解锁）
                  e.preventDefault()
                  toggleLock(tabMode)
                }}
                title={tabLocked ? `${tab.label} 已锁定 · 右键直接解锁` : `${tab.label} · 右键直接锁定`}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                  transition-all cursor-pointer whitespace-nowrap shrink-0
                  ${isActive
                    ? 'bg-[var(--color-brand)]/12 text-[var(--color-brand)] shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-container-low)]'
                  }
                `}
              >
                <span className="material-symbols-outlined text-[18px]">{tabLocked ? 'lock' : tab.icon}</span>
                <span>{tab.label}</span>
                {tabLocked && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-[#CA8A04]/12 text-[#CA8A04]">已锁定</span>
                )}
              </button>
            )
          })}
          <div className="flex-1" />
          {/* 锁定 / AI */}
          <button
            onClick={() => toggleLock(mode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              locked
                ? 'bg-[#CA8A04]/12 text-[#CA8A04]'
                : 'text-[var(--color-text-secondary)] bg-[var(--color-surface-container-low)] hover:bg-[var(--color-surface-container)]'
            }`}
            title={locked ? '解锁当前模式' : `锁定 ${MODE_LABELS[mode]}（锁定后可进入后道工序）`}
          >
            <span className="material-symbols-outlined text-[14px]">{locked ? 'lock' : 'lock_open'}</span>
            {locked ? '已锁定' : '锁定'}
          </button>
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-brand)] bg-[var(--color-brand)]/10 hover:bg-[var(--color-brand)]/15 transition-colors"
            title="读取知识库并自动填写当前页面内容"
          >
            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
            AI 生成
          </button>
        </div>
      </div>

      {/* ==== Content Area ==== */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {processDevActiveTab === 'processFlow' || processDevActiveTab === 'pfmea' ? (
          <ProcessFlowEditor />
        ) : processDevActiveTab === 'cp' ? (
          <CpTable />
        ) : (
          <div className="h-full overflow-y-auto px-6 py-6">
            <TabPlaceholder tabKey={processDevActiveTab} tab={activeTab} />
          </div>
        )}
      </div>

      <AiImportPanel open={aiOpen} onClose={() => setAiOpen(false)} mode={mode} />
    </div>
  )
}

function TabPlaceholder({
  tabKey,
  tab,
}: {
  tabKey: ProcessDevelopmentTab
  tab: (typeof TABS)[number]
}) {
  return (
    <div className="h-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--color-brand)', opacity: 0.08 }}
        >
          <span className="material-symbols-outlined text-[38px]" style={{ color: 'var(--color-brand)' }}>
            {tab.icon}
          </span>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{tab.label}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-relaxed">
            {tab.description}
          </p>
        </div>
        <span
          className="px-3 py-1 rounded-full text-[11px] font-semibold shrink-0"
          style={{ backgroundColor: '#eab30815', color: '#eab308', border: '1px solid #eab30830' }}
        >
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">build</span>
            Coming Soon
          </span>
        </span>
      </div>

      <div
        className="rounded-2xl border border-dashed p-8"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-container-lowest)' }}
      >
        <div className="flex flex-col items-center justify-center text-center py-10">
          <span className="material-symbols-outlined text-6xl mb-5" style={{ color: 'var(--color-text-tertiary)' }}>
            {tab.icon}
          </span>
          <h3 className="text-base font-semibold text-[var(--color-text-secondary)] mb-2">
            {tab.label} 模块
          </h3>
          <p className="text-sm text-[var(--color-text-tertiary)] max-w-md leading-relaxed">
            {tab.description}。此功能正在开发中，后续将提供完整的管理界面。
          </p>

          <div className="mt-8 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFeatureCards(tabKey).map((f, i) => (
              <div
                key={i}
                className="p-4 rounded-xl text-left transition-all hover:shadow-sm"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--color-brand)12' }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--color-brand)' }}>
                    {f.icon}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{f.title}</h4>
                <p className="text-[11px] text-[var(--color-text-tertiary)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getFeatureCards(tabKey: ProcessDevelopmentTab) {
  switch (tabKey) {
    case 'processFlow':
      return [
        { icon: 'account_tree', title: '工艺节点管理', desc: '添加、编辑、删除工艺步骤节点，支持拖拽排序' },
        { icon: 'schema', title: '流程可视化', desc: '流程图展示工艺顺序与依赖关系' },
        { icon: 'badge', title: '版本控制', desc: '工艺流程版本历史记录与对比' },
      ]
    case 'pfmea':
      return [
        { icon: 'list_alt', title: '失效模式库', desc: '建立和维护工艺失效模式知识库' },
        { icon: 'query_stats', title: '风险评估', desc: 'S/O/D 评分计算 RPN 风险优先数' },
        { icon: 'shield', title: '预防措施', desc: '记录预防与探测措施及有效性' },
      ]
    case 'cp':
      return [
        { icon: 'tune', title: '参数定义', desc: '定义工艺特性参数、规格限和公差' },
        { icon: 'science', title: '控制方法', desc: 'SPC 控制图、首检、巡检等控制策略' },
        { icon: 'reaction', title: '反应计划', desc: '超差时的应急处理步骤与责任人' },
      ]
    case 'wi':
      return [
        { icon: 'edit_document', title: '文档编辑', desc: '富文本编辑器支持图文混排作业指导' },
        { icon: 'format_list_numbered', title: '步骤分解', desc: '标准化工步、工时和关键点标注' },
        { icon: 'safety_check', title: '安全警示', desc: '安全警示标识与危险提醒' },
      ]
  }
}
