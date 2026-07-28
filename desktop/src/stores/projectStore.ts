import { create } from 'zustand'

export type ProjectSection = 'project' | 'expert' | 'meeting' | 'manufacturing' | 'secretary' | 'settings'

// ===== 项目与工艺管理 =====

export type ProcessStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'at_risk'

export interface ProcessNode {
  id: string
  name: string
  order: number
  status: ProcessStatus
  progress: number
  assignee: string
  dueDate: string
  notes: string
}

export interface ProjectData {
  id: string
  name: string
  processes: ProcessNode[]
}

// 单个专家的配置（对应 Agent 的字段 + 额外字段）
export interface ExpertConfig {
  id: string
  name: string
  description: string
  avatar: string // emoji
  color: string
  model: string // 'inherit' | 'haiku' | 'sonnet' | 'opus' | custom model id
  customModel: string
  effort: string
  toolAccess: 'inherit' | 'none' | 'custom'
  tools: string
  scope: 'user' | 'project'
  systemPrompt: string
  skills: string[] // 选中的 skill 名称列表
  knowledgeRepo: string // 选中的知识库名称
}

type ProjectStore = {
  activeSection: ProjectSection | null
  switchSection: (section: ProjectSection) => void

  // ===== 项目与工艺管理 =====
  projects: ProjectData[]
  addProject: (project: ProjectData) => void
  updateProject: (id: string, data: Partial<ProjectData>) => void
  removeProject: (id: string) => void
  activeProjectId: string | null
  setActiveProject: (id: string | null) => void
  activeProcessId: string | null
  setActiveProcess: (id: string | null) => void
  updateProcess: (projectId: string, processId: string, data: Partial<ProcessNode>) => void
  addProcess: (projectId: string, process: ProcessNode) => void
  removeProcess: (projectId: string, processId: string) => void

  // Expert 配置列表（设置中管理的多个专家）
  experts: ExpertConfig[]
  addExpert: (expert: ExpertConfig) => void
  updateExpert: (id: string, expert: Partial<ExpertConfig>) => void
  removeExpert: (id: string) => void

  // 当前选中的 expert（问专家时使用的那个）
  selectedExpertId: string | null
  setSelectedExpertId: (id: string | null) => void
  // 当前是否显示专家选择界面（true=显示卡片选择，false=显示聊天）
  showExpertSelector: boolean
  setShowExpertSelector: (show: boolean) => void

  // Meeting 功能
  meetingParticipants: string[] // expert IDs
  addMeetingParticipant: (id: string) => void
  removeMeetingParticipant: (id: string) => void
  meetingTopic: string
  setMeetingTopic: (topic: string) => void
  meetingMessages: MeetingMessage[]
  addMeetingMessage: (msg: MeetingMessage) => void
  clearMeetingMessages: () => void
}

export interface MeetingMessage {
  expertId: string
  expertName: string
  expertAvatar: string
  content: string
  timestamp: number
}

const DEFAULT_PROJECTS: ProjectData[] = [
  {
    id: 'ecom-r290',
    name: 'eCom R290/IPU',
    processes: [
      { id: 'p1', name: 'A轴承压装', order: 1, status: 'completed', progress: 100, assignee: '张三', dueDate: '2026-07-15', notes: '' },
      { id: 'p2', name: '防旋销压装', order: 2, status: 'in_progress', progress: 60, assignee: '李四', dueDate: '2026-07-28', notes: '等待检具到位' },
      { id: 'p3', name: '卡簧压装', order: 3, status: 'not_started', progress: 0, assignee: '', dueDate: '', notes: '' },
      { id: 'p4', name: '涂脂', order: 4, status: 'not_started', progress: 0, assignee: '', dueDate: '', notes: '' },
      { id: 'p5', name: '气密性测试', order: 5, status: 'not_started', progress: 0, assignee: '', dueDate: '', notes: '' },
      { id: 'p6', name: '标识与包装', order: 6, status: 'not_started', progress: 0, assignee: '', dueDate: '', notes: '' },
    ],
  },
  {
    id: 'project-x',
    name: 'Project X 压缩机产线',
    processes: [
      { id: 'x1', name: '定子压入', order: 1, status: 'in_progress', progress: 30, assignee: '王五', dueDate: '2026-08-05', notes: '' },
      { id: 'x2', name: '转子组装', order: 2, status: 'not_started', progress: 0, assignee: '', dueDate: '', notes: '' },
      { id: 'x3', name: '端盖螺栓拧紧', order: 3, status: 'not_started', progress: 0, assignee: '', dueDate: '', notes: '' },
    ],
  },
]

export const useProjectStore = create<ProjectStore>((set) => ({
  activeSection: null,
  switchSection: (section) => set({ activeSection: section, activeProjectId: null, activeProcessId: null }),

  // ===== 项目与工艺管理 =====
  projects: DEFAULT_PROJECTS,
  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  updateProject: (id, data) => set((s) => ({
    projects: s.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
  })),
  removeProject: (id) => set((s) => ({
    projects: s.projects.filter((p) => p.id !== id),
    activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    activeProcessId: s.activeProjectId === id ? null : s.activeProcessId,
  })),
  activeProjectId: null,
  setActiveProject: (id) => set({ activeProjectId: id, activeProcessId: null }),
  activeProcessId: null,
  setActiveProcess: (id) => set({ activeProcessId: id }),
  updateProcess: (projectId, processId, data) => set((s) => ({
    projects: s.projects.map((p) =>
      p.id === projectId
        ? { ...p, processes: p.processes.map((pr) => (pr.id === processId ? { ...pr, ...data } : pr)) }
        : p,
    ),
  })),
  addProcess: (projectId, process) => set((s) => ({
    projects: s.projects.map((p) =>
      p.id === projectId ? { ...p, processes: [...p.processes, process] } : p,
    ),
  })),
  removeProcess: (projectId, processId) => set((s) => ({
    projects: s.projects.map((p) =>
      p.id === projectId
        ? { ...p, processes: p.processes.filter((pr) => pr.id !== processId) }
        : p,
    ),
  })),

  experts: [
    {
      id: 'mechanical-design',
      name: '机械设计专家',
      description: '擅长机械结构设计、材料选择、DFM 分析。精通 SolidWorks / FreeCAD / CATIA，支持 STEP/STL 导出与 3D 打印优化。',
      avatar: '⚙️',
      color: 'blue',
      model: 'sonnet',
      customModel: '',
      effort: 'inherit',
      toolAccess: 'inherit',
      tools: '',
      scope: 'user',
      systemPrompt: '你是一位资深机械设计工程师，精通机械结构设计、材料科学、制造工艺。回答时使用中文，给出具体可操作的工程建议。',
      skills: [],
      knowledgeRepo: '',
    },
    {
      id: 'tolerance-analysis',
      name: '公差分析专家',
      description: '精通 GD&T / ISO 公差标准、尺寸链分析、RSS 与 WC 计算、干涉配合（DIN 7190）。擅长公差仿真与优化。',
      avatar: '📐',
      color: 'green',
      model: 'sonnet',
      customModel: '',
      effort: 'inherit',
      toolAccess: 'inherit',
      tools: '',
      scope: 'user',
      systemPrompt: '你是一位公差分析专家，精通 GD&T、ISO 公差标准、尺寸链分析。回答时使用中文，结合具体数据和标准给出建议。',
      skills: [],
      knowledgeRepo: '',
    },
    {
      id: 'fem-simulation',
      name: 'FEM 仿真专家',
      description: '精通有限元分析（Static / Modal / Thermal），熟练使用 Ansys / Abaqus / FreeCAD FEM。擅长网格划分与结果解读。',
      avatar: '📊',
      color: 'purple',
      model: 'sonnet',
      customModel: '',
      effort: 'inherit',
      toolAccess: 'inherit',
      tools: '',
      scope: 'user',
      systemPrompt: '你是一位 FEM 仿真专家，精通有限元分析理论、网格划分、边界条件设置、结果解读。回答时使用中文。',
      skills: [],
      knowledgeRepo: '',
    },
    {
      id: 'gdpt-expert',
      name: 'GD&T 标注专家',
      description: '精通 ASME Y14.5 / ISO 1101 几何公差标注，基准系统设计，检具方案。擅长复杂形位公差分析。',
      avatar: '🎯',
      color: 'orange',
      model: 'sonnet',
      customModel: '',
      effort: 'inherit',
      toolAccess: 'inherit',
      tools: '',
      scope: 'user',
      systemPrompt: '你是一位 GD&T 标注专家，精通 ASME Y14.5 和 ISO 1101 几何公差标准。回答时使用中文。',
      skills: [],
      knowledgeRepo: '',
    },
    {
      id: 'dfm-analysis',
      name: 'DFM 可制造性分析',
      description: '擅长可制造性设计分析，涵盖注塑/钣金/机加/铸造工艺。精通 DFM 报告编制与成本优化。',
      avatar: '🔧',
      color: 'red',
      model: 'sonnet',
      customModel: '',
      effort: 'inherit',
      toolAccess: 'inherit',
      tools: '',
      scope: 'user',
      systemPrompt: '你是一位 DFM 可制造性设计专家，精通各类制造工艺的可制造性分析。回答时使用中文，给出具体的工艺改进建议。',
      skills: [],
      knowledgeRepo: '',
    },
    {
      id: 'material-engineering',
      name: '材料工程专家',
      description: '精通金属/非金属材料选型、热处理工艺、表面处理技术。熟悉 Bosch N28 材料规范与 adhesive 选型。',
      avatar: '🧪',
      color: 'cyan',
      model: 'sonnet',
      customModel: '',
      effort: 'inherit',
      toolAccess: 'inherit',
      tools: '',
      scope: 'user',
      systemPrompt: '你是一位材料工程专家，精通工程材料选型、热处理、表面处理。回答时使用中文，结合材料标准和工程实践给出建议。',
      skills: [],
      knowledgeRepo: '',
    },
    {
      id: 'quality-process',
      name: '工艺放行专家',
      description: '精通 Bosch PKD / 工艺放行流程、PFMEA、控制计划、SPC、Ishikawa 分析。擅长 QG gate 评审。',
      avatar: '✅',
      color: 'green',
      model: 'sonnet',
      customModel: '',
      effort: 'inherit',
      toolAccess: 'inherit',
      tools: '',
      scope: 'user',
      systemPrompt: '你是一位工艺放行(PKD)和质量专家，精通 Bosch 工艺放行流程、PFMEA、控制计划、SPC 和质量工具。回答时使用中文。',
      skills: [],
      knowledgeRepo: '',
    },
  ],
  addExpert: (expert) =>
    set((state) => ({ experts: [...state.experts, expert] })),
  updateExpert: (id, partial) =>
    set((state) => ({
      experts: state.experts.map((e) =>
        e.id === id ? { ...e, ...partial } : e,
      ),
    })),
  removeExpert: (id) =>
    set((state) => ({
      experts: state.experts.filter((e) => e.id !== id),
      selectedExpertId:
        state.selectedExpertId === id ? null : state.selectedExpertId,
    })),

  selectedExpertId: null,
  setSelectedExpertId: (id) => set({ selectedExpertId: id }),
  showExpertSelector: true,
  setShowExpertSelector: (show) => set({ showExpertSelector: show }),

  meetingParticipants: [],
  addMeetingParticipant: (id) =>
    set((state) => {
      if (state.meetingParticipants.includes(id)) return state
      return { meetingParticipants: [...state.meetingParticipants, id] }
    }),
  removeMeetingParticipant: (id) =>
    set((state) => ({
      meetingParticipants: state.meetingParticipants.filter((p) => p !== id),
    })),
  meetingTopic: '',
  setMeetingTopic: (topic) => set({ meetingTopic: topic }),
  meetingMessages: [],
  addMeetingMessage: (msg) =>
    set((state) => ({
      meetingMessages: [...state.meetingMessages, msg],
    })),
  clearMeetingMessages: () => set({ meetingMessages: [] }),
}))
