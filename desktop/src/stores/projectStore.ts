import { create } from 'zustand'
import { expertSettingsApi } from '../api/expertSettings'

export type ProjectSection = 'project' | 'expert' | 'meeting' | 'manufacturing' | 'processDevelopment' | 'secretary' | 'settings'

export type ProcessDevelopmentTab = 'processFlow' | 'pfmea' | 'cp' | 'wi'

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
  startDate?: string
  notes: string
}

/** 汽车电机开发项目分类（对应参考页 WS/TS/PA/CA/2WP） */
export type ProjectCategory = 'WS' | 'TS' | 'PA' | 'CA' | '2WP'
/** 项目生命周期状态：进行中 / 已完成 / 挂起 */
export type ProjectLifecycle = 'in_development' | 'completed' | 'on_hold'

export interface ProjectTeamMember {
  id: string
  name: string
  role: string
  degree: string
  email: string
  phone: string
  lead?: boolean
}

export type ProjectDocKind = 'pdf' | 'word' | 'excel' | 'ppt'

export interface ProjectDocItem {
  id: string
  name: string
  kind: ProjectDocKind
  size: string
  date: string
}

export interface ProjectData {
  id: string
  name: string
  category: ProjectCategory
  /** 生命周期状态：in_development / completed / on_hold */
  state: ProjectLifecycle
  description: string
  /** 卡片展示的业务编号，如 WS-2023-042 */
  projectCode: string
  timeline: string
  completion: number
  /** 卡片第 3 个规格字段（不同项目不同：Power/Torque/...） */
  specLabel: string
  specValue: string
  voltage: string
  keyFeatures: string[]
  objectives?: string[]
  location?: string
  startDate?: string
  expectedCompletion?: string
  manager?: { name: string; email: string; phone: string }
  budgetCode?: string
  totalBudget?: string
  priority?: number // 1-5
  taskStats?: { planned: number; completed: number; inProgress: number; notStarted: number; delayed: number }
  team: ProjectTeamMember[]
  docs: ProjectDocItem[]
  processes: ProcessNode[]
}

// 单个专家的配置（对应 Agent 的字段 + 额外字段）
export interface ExpertConfig {
  id: string
  name: string
  description: string
  avatar: string // emoji 或本地图片路径
  avatarPath?: string // 从文件夹选择的头像文件路径
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
  knowledgeRepoPath?: string // 指定的知识库地址（优先于 knowledgeRepo）
  enabled: boolean // 是否激活：关闭后不出现在 Ask expert / Meeting 中
  isManager?: boolean // 是否项目经理（负责会议模板与进度）
}

// 会议模板：项目经理管理的标准议程
export interface MeetingTemplate {
  id: string
  name: string
  agenda: string[]
  createdAt: number
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
  // 项目经理（也是专家），负责会议模板与进度
  projectManagerId: string | null
  setProjectManagerId: (id: string | null) => void
  // 会议模板（项目经理管理）
  meetingTemplates: MeetingTemplate[]
  addMeetingTemplate: (template: MeetingTemplate) => void
  updateMeetingTemplate: (id: string, data: Partial<MeetingTemplate>) => void
  removeMeetingTemplate: (id: string) => void
  // 从 ~/.claude/cc-haha/expert-settings/ 加载与固化
  loadFromClaude: () => Promise<void>

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

  // Process Development 功能
  processDevActiveTab: ProcessDevelopmentTab
  setProcessDevActiveTab: (tab: ProcessDevelopmentTab) => void
}

export interface MeetingMessage {
  expertId: string
  expertName: string
  expertAvatar: string
  content: string
  timestamp: number
}

// ── 样例数据构造器（桌面端内置演示，仿照 Automotive Small Motor Development 参考页）──
let seq = 100
const p = (
  name: string,
  status: ProcessStatus,
  progress: number,
  assignee: string,
  dueDate: string,
  startDate?: string,
): ProcessNode => ({
  id: `st${++seq}`,
  name,
  order: seq - 100,
  status,
  progress,
  assignee,
  dueDate,
  notes: '',
  ...(startDate ? { startDate } : {}),
})
const m = (name: string, role: string, degree: string, lead?: boolean): ProjectTeamMember => ({
  id: `mm${++seq}`,
  name,
  role,
  degree,
  email: `${name.toLowerCase().replace(/[ .]/g, '.')}@motor.example.com`,
  phone: '+86 138-0000-0000',
  ...(lead ? { lead: true } : {}),
})
const d = (name: string, kind: ProjectDocKind, size: string, date: string): ProjectDocItem => ({
  id: `dc${++seq}`,
  name,
  kind,
  size,
  date,
})

const DEFAULT_PROJECTS: ProjectData[] = [
  {
    id: 'ws-2023-042',
    name: 'Window Lift Motor',
    category: 'WS',
    state: 'in_development',
    description:
      'High-efficiency window lift motor with improved durability and reduced noise levels for premium vehicle models.',
    projectCode: 'WS-2023-042',
    timeline: 'Mar 2023 - Jan 2024',
    completion: 68,
    specLabel: 'Power',
    specValue: '80-120W',
    voltage: '12V DC',
    keyFeatures: ['Noise reduction below 45dB', 'Overload protection system', 'IP67 waterproof rating'],
    objectives: ['提升升降电机耐久性', '将噪音降至 45dB 以下', '满足 IP67 防护'],
    location: 'Shanghai Industrial Park',
    startDate: '2023-06-15',
    expectedCompletion: '2024-03-30',
    manager: { name: 'Michael Zhang', email: 'michael.zhang@motor.example.com', phone: '+86 138-0000-5678' },
    priority: 4,
    taskStats: { planned: 62, completed: 26, inProgress: 14, notStarted: 22, delayed: 1 },
    team: [
      m('Michael Zhang', 'Project Manager', 'Mechanical Engineering PhD', true),
      m('David Li', 'Engineering Director', 'Electrical Engineering MSc'),
      m('Sarah Wang', 'Quality Control Manager', 'Industrial Engineering BSc'),
    ],
    docs: [
      d('QG Categories Specification.pdf', 'pdf', '3.2 MB', '2023-06-05'),
      d('Regular Meeting Minutes Summary.xlsx', 'excel', '845 KB', '2023-08-15'),
    ],
    processes: [
      p('Shaft Pressing into Rotor', 'in_progress', 85, 'David Li', '2023-08-30', '2023-06-15'),
      p('Rotor Winding', 'in_progress', 60, 'Emily Chen', '2023-09-15', '2023-07-10'),
      p('Rotor Varnishing', 'in_progress', 30, 'Robert Zhao', '2023-10-10', '2023-08-01'),
      p('Final Assembly & Testing', 'not_started', 0, 'Sarah Wang', '2024-03-30', '2023-12-01'),
    ],
  },
  {
    id: 'ts-2023-018',
    name: 'Tailgate Servo Motor',
    category: 'TS',
    state: 'completed',
    description:
      'High-torque servo motor for automated tailgate systems with precise position control and safety features.',
    projectCode: 'TS-2023-018',
    timeline: 'Jan 2023 - Jun 2023',
    completion: 100,
    specLabel: 'Torque',
    specValue: '4.5-6.0 Nm',
    voltage: '12V DC',
    keyFeatures: ['Obstacle detection system', 'Soft-close functionality', 'Adjustable speed settings'],
    objectives: ['伺服位置精度 ±0.1°', '含障碍检测与软关', '支持速度档位调节'],
    location: 'Shanghai Industrial Park',
    startDate: '2023-01-10',
    expectedCompletion: '2023-06-30',
    manager: { name: 'David Li', email: 'david.li@motor.example.com', phone: '+86 138-0000-5678' },
    priority: 5,
    taskStats: { planned: 48, completed: 48, inProgress: 0, notStarted: 0, delayed: 0 },
    team: [
      m('David Li', 'Engineering Director', 'Electrical Engineering MSc', true),
      m('Emily Chen', 'Automation Specialist', 'Mechatronics Engineering MSc'),
    ],
    docs: [d('QG Contracting Agreement.docx', 'word', '2.1 MB', '2023-06-12')],
    processes: [
      p('Gearbox Assembly', 'completed', 100, 'Robert Zhao', '2023-03-20', '2023-01-10'),
      p('Motor Winding', 'completed', 100, 'Emily Chen', '2023-04-15', '2023-02-01'),
      p('Control Unit Calibration', 'completed', 100, 'David Li', '2023-05-20', '2023-03-15'),
      p('Endurance & EOL Test', 'completed', 100, 'Sarah Wang', '2023-06-30', '2023-05-01'),
    ],
  },
  {
    id: 'pa-2023-029',
    name: 'Seat Adjustment Motor',
    category: 'PA',
    state: 'in_development',
    description:
      'Compact multi-axis power adjustment motor for premium automotive seating with memory function.',
    projectCode: 'PA-2023-029',
    timeline: 'May 2023 - Mar 2024',
    completion: 45,
    specLabel: 'Current',
    specValue: '2.5-3.8A',
    voltage: '12V DC',
    keyFeatures: ['16-way adjustment capability', 'Integrated position sensors', 'Energy-saving standby mode'],
    objectives: ['16 向调节能力', '集成位置传感器', '低功耗待机'],
    location: 'Suzhou Motor Industrial Park',
    startDate: '2023-05-01',
    expectedCompletion: '2024-03-31',
    manager: { name: 'Sarah Wang', email: 'sarah.wang@motor.example.com', phone: '+86 138-0000-5678' },
    priority: 3,
    taskStats: { planned: 55, completed: 25, inProgress: 12, notStarted: 18, delayed: 2 },
    team: [
      m('Sarah Wang', 'Quality Control Manager', 'Industrial Engineering BSc', true),
      m('Robert Zhao', 'Production Supervisor', 'Manufacturing Engineering BSc'),
      m('Jason Liu', 'Logistics Coordinator', 'Supply Chain Management BSc'),
    ],
    docs: [d('Process Optimization Presentation.pptx', 'ppt', '4.7 MB', '2023-07-28')],
    processes: [
      p('Lead Screw Mechanism', 'in_progress', 70, 'Robert Zhao', '2023-11-20', '2023-05-01'),
      p('Housing & Gear Train', 'in_progress', 45, 'David Li', '2023-12-10', '2023-07-01'),
      p('Controller & Sensor', 'in_progress', 20, 'Emily Chen', '2024-02-01', '2023-10-01'),
      p('Memory Function Test', 'not_started', 0, 'Sarah Wang', '2024-03-31', '2023-12-15'),
    ],
  },
  {
    id: 'ca-2023-015',
    name: 'Climate Control Motor',
    category: 'CA',
    state: 'on_hold',
    description:
      'Precision motor for automotive climate control systems with variable speed and position control.',
    projectCode: 'CA-2023-015',
    timeline: 'Feb 2023 - Nov 2023',
    completion: 32,
    specLabel: 'Speed Range',
    specValue: '500-3000 RPM',
    voltage: '12V DC',
    keyFeatures: ['0.1° position accuracy', 'Low power consumption', 'Wide temperature operation'],
    objectives: ['0.1° 位置精度', '低功耗设计', '宽温域工作 -40~85℃'],
    location: 'Shanghai Industrial Park',
    startDate: '2023-02-01',
    expectedCompletion: '2023-11-30',
    manager: { name: 'Jason Liu', email: 'jason.liu@motor.example.com', phone: '+86 138-0000-5678' },
    priority: 2,
    taskStats: { planned: 40, completed: 13, inProgress: 6, notStarted: 18, delayed: 4 },
    team: [
      m('Jason Liu', 'Logistics Coordinator', 'Supply Chain Management BSc', true),
      m('Emily Chen', 'Automation Specialist', 'Mechatronics Engineering MSc'),
    ],
    docs: [],
    processes: [
      p('Blower Motor Assembly', 'in_progress', 40, 'Robert Zhao', '2023-08-30', '2023-02-01'),
      p('Damper Actuator', 'not_started', 0, 'David Li', '2023-09-30', '2023-05-01'),
      p('Vane Position Control', 'not_started', 0, 'Emily Chen', '2023-11-30', '2023-07-01'),
    ],
  },
  {
    id: 'wp2-2023-037',
    name: 'Dual Window Motor',
    category: '2WP',
    state: 'in_development',
    description:
      'Synchronized dual motor system for panoramic sunroof applications with anti-pinch safety features.',
    projectCode: '2WP-2023-037',
    timeline: 'Apr 2023 - Dec 2023',
    completion: 76,
    specLabel: 'Sync Accuracy',
    specValue: '±2mm',
    voltage: '12V DC',
    keyFeatures: ['Dual-motor synchronization', 'Anti-pinch safety system', 'Weather-sealed design'],
    objectives: ['双电机同步 ±2mm', '防夹安全功能', '防水密封设计'],
    location: 'Suzhou Motor Industrial Park',
    startDate: '2023-04-01',
    expectedCompletion: '2023-12-31',
    manager: { name: 'Robert Zhao', email: 'robert.zhao@motor.example.com', phone: '+86 138-0000-5678' },
    priority: 4,
    taskStats: { planned: 60, completed: 45, inProgress: 8, notStarted: 7, delayed: 0 },
    team: [
      m('Robert Zhao', 'Production Supervisor', 'Manufacturing Engineering BSc', true),
      m('Michael Zhang', 'Project Manager', 'Mechanical Engineering PhD'),
      m('Sarah Wang', 'Quality Control Manager', 'Industrial Engineering BSc'),
    ],
    docs: [],
    processes: [
      p('Gear Housing Molding', 'completed', 100, 'Robert Zhao', '2023-07-15', '2023-04-01'),
      p('Twin Motor Assembly', 'in_progress', 85, 'David Li', '2023-09-30', '2023-06-01'),
      p('Sync Calibration', 'in_progress', 60, 'Emily Chen', '2023-11-15', '2023-08-01'),
      p('Anti-pinch EOL Test', 'not_started', 0, 'Sarah Wang', '2023-12-31', '2023-10-01'),
    ],
  },
  {
    id: 'ca-2022-098',
    name: 'Central Locking Motor',
    category: 'CA',
    state: 'completed',
    description:
      'High-security central locking motor with anti-theft features and remote operation capability.',
    projectCode: 'CA-2022-098',
    timeline: 'Sep 2022 - Mar 2023',
    completion: 100,
    specLabel: 'Cycle Life',
    specValue: '100,000+ operations',
    voltage: '12V DC',
    keyFeatures: ['Anti-theft locking mechanism', 'Remote control integration', 'Emergency override system'],
    objectives: ['十万次以上寿命', '集成遥控开锁', '紧急机械解锁'],
    location: 'Shanghai Industrial Park',
    startDate: '2022-09-01',
    expectedCompletion: '2023-03-31',
    manager: { name: 'Emily Chen', email: 'emily.chen@motor.example.com', phone: '+86 138-0000-5678' },
    priority: 3,
    taskStats: { planned: 35, completed: 35, inProgress: 0, notStarted: 0, delayed: 0 },
    team: [
      m('Emily Chen', 'Automation Specialist', 'Mechatronics Engineering MSc', true),
      m('Jason Liu', 'Logistics Coordinator', 'Supply Chain Management BSc'),
    ],
    docs: [d('QG Categories Specification.pdf', 'pdf', '3.2 MB', '2022-09-10')],
    processes: [
      p('Actuator Motor Assembly', 'completed', 100, 'Robert Zhao', '2022-12-20', '2022-09-01'),
      p('Locking Mechanism', 'completed', 100, 'David Li', '2023-01-31', '2022-10-15'),
      p('Remote & EOL Validation', 'completed', 100, 'Sarah Wang', '2023-03-31', '2022-12-01'),
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
      enabled: true,
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
      enabled: true,
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
      enabled: true,
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
      enabled: true,
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
      enabled: true,
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
      enabled: true,
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
      enabled: true,
    },
  ],
  addExpert: (expert) => {
    set((state) => ({ experts: [...state.experts, expert] }))
    persistToClaude()
  },
  updateExpert: (id, partial) => {
    set((state) => ({
      experts: state.experts.map((e) =>
        e.id === id ? { ...e, ...partial } : e,
      ),
    }))
    persistToClaude()
  },
  removeExpert: (id) => {
    set((state) => ({
      experts: state.experts.filter((e) => e.id !== id),
      selectedExpertId:
        state.selectedExpertId === id ? null : state.selectedExpertId,
      projectManagerId:
        state.projectManagerId === id ? null : state.projectManagerId,
    }))
    persistToClaude()
  },

  projectManagerId: null,
  setProjectManagerId: (id) => {
    // 同时维护各专家的 isManager 标记，保证与 projectManagerId 一致
    set((state) => ({
      projectManagerId: id,
      experts: state.experts.map((e) => ({ ...e, isManager: e.id === id })),
    }))
    persistToClaude()
  },

  meetingTemplates: [],
  addMeetingTemplate: (template) => {
    set((state) => ({ meetingTemplates: [...state.meetingTemplates, template] }))
    persistToClaude()
  },
  updateMeetingTemplate: (id, data) => {
    set((state) => ({
      meetingTemplates: state.meetingTemplates.map((t) =>
        t.id === id ? { ...t, ...data } : t,
      ),
    }))
    persistToClaude()
  },
  removeMeetingTemplate: (id) => {
    set((state) => ({
      meetingTemplates: state.meetingTemplates.filter((t) => t.id !== id),
    }))
    persistToClaude()
  },

  loadFromClaude: async () => {
    try {
      const data = await expertSettingsApi.get()
      if (data.experts.length === 0) return
      set({
        experts: data.experts,
        projectManagerId: data.projectManagerId,
        meetingTemplates: data.meetingTemplates,
      })
    } catch {
      // 首次运行或服务端不可用时使用内置默认专家
    }
  },

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

  processDevActiveTab: 'processFlow',
  setProcessDevActiveTab: (tab) => set({ processDevActiveTab: tab }),
}))

// 把专家/项目经理/会议模板固化到 ~/.claude/cc-haha/expert-settings/settings.json
function persistToClaude() {
  const state = useProjectStore.getState()
  void expertSettingsApi
    .save({
      experts: state.experts,
      projectManagerId: state.projectManagerId,
      meetingTemplates: state.meetingTemplates,
    })
    .catch(() => {
      // 服务端不可用时静默失败，内存态仍可用
    })
}
