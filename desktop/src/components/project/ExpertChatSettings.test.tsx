import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

const mocks = vi.hoisted(() => ({
  saveExpertSettings: vi.fn(async () => {}),
  getExpertSettings: vi.fn(async () => ({ experts: [], projectManagerId: null, meetingTemplates: [] })),
  fetchRepos: vi.fn(async () => {}),
}))

vi.mock('../../api/expertSettings', () => ({
  expertSettingsApi: {
    save: mocks.saveExpertSettings,
    get: mocks.getExpertSettings,
  },
}))

vi.mock('../../api/wikiClient', () => ({
  wikiApi: {},
  auditApi: {},
  stateApi: {},
}))

import { ExpertChatSettings } from './ExpertChatSettings'
import { useProjectStore } from '../../stores/projectStore'
import { useWikiStore } from '../../stores/wikiStore'
import type { ExpertConfig } from '../../stores/projectStore'

const initialProjectState = useProjectStore.getState()
const initialWikiState = useWikiStore.getState()

const EXPERT: ExpertConfig = {
  id: 'expert-1',
  name: '测试专家',
  description: '',
  avatar: '🤖',
  color: 'blue',
  model: 'sonnet',
  customModel: '',
  effort: 'inherit',
  toolAccess: 'inherit',
  tools: '',
  scope: 'user',
  systemPrompt: '',
  skills: [],
  knowledgeRepo: '',
  knowledgeRepoPath: '',
  enabled: true,
}

describe('ExpertChatSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectStore.setState(initialProjectState, true)
    useWikiStore.setState(initialWikiState, true)
    useProjectStore.setState({
      experts: [EXPERT],
      selectedExpertId: 'expert-1',
    })
    useWikiStore.setState({
      // 替换 fetchRepos，避免打开弹窗时真实拉取知识库清单覆盖测试数据
      fetchRepos: mocks.fetchRepos,
      repos: [
        { name: 'wiki-a', path: 'C:\\wikis\\a', status: 'active' },
        { name: 'wiki-b', path: 'C:\\wikis\\b', status: 'inactive' },
      ],
    })
  })

  afterEach(() => {
    cleanup()
    useProjectStore.setState(initialProjectState, true)
    useWikiStore.setState(initialWikiState, true)
  })

  it('打开时以当前专家的系统提示词与知识库初始化表单', () => {
    useProjectStore.setState({
      experts: [{ ...EXPERT, systemPrompt: '专家提示词', knowledgeRepo: 'wiki-a' }],
    })

    render(<ExpertChatSettings open onClose={() => {}} />)

    expect(screen.getByDisplayValue('专家提示词')).toBeInTheDocument()
    // 已选知识库的地址显示在路径行
    expect(screen.getByText('C:\\wikis\\a')).toBeInTheDocument()
  })

  it('保存时把系统提示词与选中的知识库写入专家配置', () => {
    render(<ExpertChatSettings open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('例如：请结合行业标准给出具体参数建议。'), {
      target: { value: '新的提示词' },
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'wiki-b' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    const updated = useProjectStore.getState().experts.find((e) => e.id === 'expert-1')
    expect(updated?.systemPrompt).toBe('新的提示词')
    expect(updated?.knowledgeRepo).toBe('wiki-b')
    // 下拉选择知识库后清除手动指定的地址
    expect(updated?.knowledgeRepoPath).toBeUndefined()
  })

  it('保存指定知识库地址时写入 knowledgeRepoPath（优先于下拉选择）', () => {
    render(<ExpertChatSettings open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('输入知识库文件夹的绝对路径（优先于下拉选择）'), {
      target: { value: 'D:\\custom\\wiki' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    const updated = useProjectStore.getState().experts.find((e) => e.id === 'expert-1')
    expect(updated?.knowledgeRepoPath).toBe('D:\\custom\\wiki')
  })
})
