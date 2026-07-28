import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiListMock = vi.hoisted(() => vi.fn())
const apiCreateMock = vi.hoisted(() => vi.fn())
const apiUpdateMock = vi.hoisted(() => vi.fn())
const apiDeleteMock = vi.hoisted(() => vi.fn())
const apiReloadMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/agents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/agents')>()
  return {
    ...actual,
    agentsApi: {
      list: apiListMock,
      create: apiCreateMock,
      update: apiUpdateMock,
      delete: apiDeleteMock,
      reload: apiReloadMock,
    },
  }
})

vi.mock('../markdown/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}))

import type { AgentDefinition, AgentListResponse } from '../../api/agents'
import { useAgentStore } from '../../stores/agentStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { AgentManager } from './AgentManager'

const EMPTY_RESPONSE = { activeAgents: [], allAgents: [] }

function makeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    agentType: 'code_reviewer',
    description: 'Review code',
    systemPrompt: 'Review carefully.',
    model: 'opus',
    modelDisplay: 'claude-opus-4-6',
    effort: 'xhigh',
    tools: ['Read'],
    color: 'blue',
    source: 'userSettings',
    baseDir: '/Users/test/.claude/agents',
    target: 'nested/custom-agent-file.md',
    isActive: true,
    editable: true,
    ...overrides,
  }
}

function setProjectSession(cwd?: string) {
  useSessionStore.setState({
    sessions: cwd ? [{
      id: 'session-1',
      title: 'Project',
      createdAt: '',
      modifiedAt: '',
      messageCount: 0,
      projectPath: cwd,
      workDir: cwd,
      workDirExists: true,
    }] : [],
    activeSessionId: cwd ? 'session-1' : null,
  })
}

async function renderManager(response: AgentListResponse = EMPTY_RESPONSE) {
  apiListMock.mockResolvedValue(response)
  render(<AgentManager />)
  await waitFor(() => expect(apiListMock).toHaveBeenCalled())
}

describe('AgentManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiReloadMock.mockResolvedValue({
      ok: true,
      session: {
        applied: true,
        commands: 0,
        agents: 1,
        plugins: 0,
        mcpServers: 0,
        errors: 0,
      },
    })
    useSettingsStore.setState({ locale: 'en' })
    setProjectSession('/workspace/project')
    useAgentStore.setState({
      activeAgents: [],
      allAgents: [],
      isLoading: false,
      isMutating: false,
      error: null,
      mutationError: null,
      mutationWarning: null,
      selectedAgent: null,
      selectedAgentReturnTab: 'agents',
    })
  })

  it('keeps project scope disabled when there is no active project', async () => {
    setProjectSession()
    await renderManager()

    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }))

    expect(screen.getByRole('option', { name: 'Project' })).toBeDisabled()
    expect(screen.getByRole('option', { name: 'fable' })).toBeInTheDocument()
    expect(screen.getByText('Open a project session to create a project-scoped agent.')).toBeInTheDocument()
    expect(screen.getByLabelText('System prompt').parentElement).toHaveTextContent('System prompt*')
  })

  it('creates an underscore slug with custom model and effort, then selects the refreshed agent', async () => {
    const created = makeAgent({
      source: 'projectSettings',
      model: 'provider/custom-model',
      modelDisplay: 'provider/custom-model',
      tools: ['Agent(worker, researcher)', 'Read'],
      color: 'purple',
    })
    apiListMock
      .mockResolvedValueOnce(EMPTY_RESPONSE)
      .mockResolvedValueOnce({ activeAgents: [created], allAgents: [created] })
    apiCreateMock.mockResolvedValue({ agent: created })

    render(<AgentManager />)
    await waitFor(() => expect(apiListMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }))
    fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'project' } })
    expect(screen.getByText('Target project: /workspace/project')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'code_reviewer' } })
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: 'Review code' } })
    fireEvent.change(screen.getByLabelText('System prompt'), { target: { value: 'Review carefully.' } })
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'custom' } })
    fireEvent.change(screen.getByLabelText(/^Custom model ID/), { target: { value: 'provider/custom-model' } })
    fireEvent.change(screen.getByLabelText('Reasoning effort'), { target: { value: 'xhigh' } })
    fireEvent.change(screen.getByLabelText('Tools'), { target: { value: 'custom' } })
    fireEvent.change(screen.getByLabelText(/^Allowed tools/), {
      target: { value: 'Agent(worker, researcher), Read, Agent(worker, researcher)' },
    })
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'purple' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiCreateMock).toHaveBeenCalledWith({
      scope: 'project',
      cwd: '/workspace/project',
      name: 'code_reviewer',
      description: 'Review code',
      systemPrompt: 'Review carefully.',
      model: 'provider/custom-model',
      effort: 'xhigh',
      tools: ['Agent(worker, researcher)', 'Read'],
      color: 'purple',
    }))
    expect(apiReloadMock).toHaveBeenCalledWith('session-1')
    expect(await screen.findByText('Agent Profile')).toBeInTheDocument()
    expect(useAgentStore.getState().selectedAgent).toEqual(created)
  })

  it('uses the source project when the active worktree is no longer available', async () => {
    useSessionStore.setState({
      sessions: [{
        id: 'session-1',
        title: 'Removed worktree',
        createdAt: '',
        modifiedAt: '',
        messageCount: 0,
        projectPath: '/workspace/removed-worktree',
        projectRoot: '/workspace/source-project',
        workDir: '/workspace/removed-worktree',
        workDirExists: false,
        workspaceState: 'worktree_removed',
      }],
      activeSessionId: 'session-1',
    })
    await renderManager()

    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }))
    fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'project' } })

    expect(screen.getByText('Target project: /workspace/source-project')).toBeInTheDocument()
  })

  it('rejects names longer than 64 characters before calling the API', async () => {
    await renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }))
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: `a${'b'.repeat(64)}` } })
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: 'Review code' } })
    fireEvent.change(screen.getByLabelText('System prompt'), { target: { value: 'Review carefully.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText(/1–64 lowercase letters/)).toBeInTheDocument()
    expect(apiCreateMock).not.toHaveBeenCalled()
  })

  it('keeps same-name definitions with different targets independently selectable', async () => {
    const rootAgent = makeAgent({ description: 'Root definition', target: 'code-reviewer.md' })
    const nestedAgent = makeAgent({ description: 'Nested definition', target: 'nested/custom-agent-file.md' })
    await renderManager({
      activeAgents: [rootAgent, nestedAgent],
      allAgents: [rootAgent, nestedAgent],
    })

    expect(screen.getAllByText('code_reviewer')).toHaveLength(2)
    fireEvent.click(screen.getByText('Nested definition').closest('button')!)

    expect(useAgentStore.getState().selectedAgent).toBe(nestedAgent)
    expect(screen.getByText('nested/custom-agent-file.md')).toBeInTheDocument()
  })

  it('distinguishes inherited, disabled, and custom tool access', async () => {
    const inherited = makeAgent({
      agentType: 'all_tools',
      description: 'All tools',
      target: '/agents/all-tools.md',
      tools: undefined,
    })
    const disabled = makeAgent({
      agentType: 'no_tools',
      description: 'No tools',
      target: '/agents/no-tools.md',
      tools: [],
    })
    const custom = makeAgent({
      agentType: 'custom_tools',
      description: 'Custom tools',
      target: '/agents/custom-tools.md',
      tools: ['Read', 'Grep'],
    })
    await renderManager({
      activeAgents: [inherited, disabled, custom],
      allAgents: [inherited, disabled, custom],
    })

    expect(screen.getByText('No tool restriction')).toBeInTheDocument()
    expect(screen.getByText('No tools allowed')).toBeInTheDocument()
    expect(screen.getByText('2 tools')).toBeInTheDocument()

    fireEvent.click(screen.getByText('No tools').closest('button')!)
    expect(screen.getByText('/agents/no-tools.md')).toBeInTheDocument()
    expect(screen.getByText('No tools allowed')).toBeInTheDocument()
  })

  it('sends explicit nulls when an editable agent returns to inherited defaults', async () => {
    const agent = makeAgent()
    const updated = makeAgent({ model: undefined, effort: undefined, tools: undefined, color: undefined })
    apiListMock
      .mockResolvedValueOnce({ activeAgents: [agent], allAgents: [agent] })
      .mockResolvedValueOnce({ activeAgents: [updated], allAgents: [updated] })
    apiUpdateMock.mockResolvedValue({ agent: updated })
    useAgentStore.setState({ selectedAgent: agent, activeAgents: [agent], allAgents: [agent] })

    render(<AgentManager />)
    await waitFor(() => expect(apiListMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'inherit' } })
    fireEvent.change(screen.getByLabelText('Reasoning effort'), { target: { value: 'inherit' } })
    fireEvent.change(screen.getByLabelText('Tools'), { target: { value: 'inherit' } })
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiUpdateMock).toHaveBeenCalledWith('code_reviewer', {
      scope: 'user',
      cwd: '/workspace/project',
      target: 'nested/custom-agent-file.md',
      name: 'code_reviewer',
      description: 'Review code',
      systemPrompt: 'Review carefully.',
      model: null,
      effort: null,
      tools: null,
      color: null,
    }))
    expect(screen.getAllByText('Inherit').length).toBeGreaterThanOrEqual(2)
  })

  it('preserves an explicit empty tools list when editing only the description', async () => {
    const agent = makeAgent({ tools: [] })
    const updated = makeAgent({ tools: [], description: 'Updated review' })
    apiListMock.mockResolvedValue({ activeAgents: [updated], allAgents: [updated] })
    apiUpdateMock.mockResolvedValue({ agent: updated })
    useAgentStore.setState({ selectedAgent: agent, activeAgents: [agent], allAgents: [agent] })

    render(<AgentManager />)
    await waitFor(() => expect(apiListMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Tools')).toHaveValue('none')
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: 'Updated review' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiUpdateMock).toHaveBeenCalled())
    expect(apiUpdateMock.mock.calls[0]?.[1]).toMatchObject({
      description: 'Updated review',
      tools: [],
    })
  })

  it('preserves parenthesized tool names with commas when editing only the description', async () => {
    const originalTools = ['Agent(worker, researcher)', 'Read']
    const agent = makeAgent({ tools: originalTools })
    const updated = makeAgent({ tools: originalTools, description: 'Updated review' })
    apiListMock.mockResolvedValue({ activeAgents: [updated], allAgents: [updated] })
    apiUpdateMock.mockResolvedValue({ agent: updated })
    useAgentStore.setState({ selectedAgent: agent, activeAgents: [agent], allAgents: [agent] })

    render(<AgentManager />)
    await waitFor(() => expect(apiListMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText(/^Allowed tools/)).toHaveValue(
      'Agent(worker, researcher), Read',
    )
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: 'Updated review' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiUpdateMock).toHaveBeenCalled())
    expect(apiUpdateMock.mock.calls[0]?.[1]).toMatchObject({
      description: 'Updated review',
      tools: originalTools,
    })
  })

  it('preserves a legacy numeric effort when editing another field', async () => {
    const agent = makeAgent({ effort: 7 })
    apiListMock.mockResolvedValue({ activeAgents: [agent], allAgents: [agent] })
    apiUpdateMock.mockResolvedValue({ agent })
    useAgentStore.setState({ selectedAgent: agent, activeAgents: [agent], allAgents: [agent] })

    render(<AgentManager />)
    await waitFor(() => expect(apiListMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('option', { name: '7' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: 'Updated review' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiUpdateMock).toHaveBeenCalled())
    expect(apiUpdateMock.mock.calls[0]?.[1]).toMatchObject({ effort: 7, description: 'Updated review' })
  })

  it('allows a metadata-only edit when the existing system prompt body is empty', async () => {
    const agent = makeAgent({ systemPrompt: '', effort: 'medium' })
    const updated = makeAgent({ systemPrompt: '', effort: 'high' })
    apiListMock.mockResolvedValue({ activeAgents: [updated], allAgents: [updated] })
    apiUpdateMock.mockResolvedValue({ agent: updated })
    useAgentStore.setState({ selectedAgent: agent, activeAgents: [agent], allAgents: [agent] })

    render(<AgentManager />)
    await waitFor(() => expect(apiListMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const prompt = screen.getByLabelText('System prompt')
    expect(prompt).toHaveValue('')
    expect(prompt.parentElement).not.toHaveTextContent('System prompt*')
    fireEvent.change(screen.getByLabelText('Reasoning effort'), { target: { value: 'high' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(apiUpdateMock).toHaveBeenCalled())
    expect(apiUpdateMock.mock.calls[0]?.[1]).toMatchObject({
      systemPrompt: '',
      effort: 'high',
    })
  })

  it('deletes an editable project agent and returns to the refreshed list', async () => {
    const agent = makeAgent({ source: 'projectSettings' })
    apiListMock
      .mockResolvedValueOnce({ activeAgents: [agent], allAgents: [agent] })
      .mockResolvedValueOnce(EMPTY_RESPONSE)
    apiDeleteMock.mockResolvedValue(undefined)
    useAgentStore.setState({ selectedAgent: agent, activeAgents: [agent], allAgents: [agent] })

    render(<AgentManager />)
    await waitFor(() => expect(apiListMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('File: nested/custom-agent-file.md')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Agent' }))

    await waitFor(() => expect(apiDeleteMock).toHaveBeenCalledWith(
      'code_reviewer',
      'project',
      '/workspace/project',
      'nested/custom-agent-file.md',
    ))
    expect(apiReloadMock).toHaveBeenCalledWith('session-1')
    expect(await screen.findByText('No agents available yet.')).toBeInTheDocument()
    expect(useAgentStore.getState().selectedAgent).toBeNull()
  })

  it('keeps non-user and non-project agents read-only even if the API marks them editable', async () => {
    const agent = makeAgent({ source: 'built-in', editable: true })
    apiListMock.mockResolvedValue({ activeAgents: [agent], allAgents: [agent] })
    useAgentStore.setState({ selectedAgent: agent, activeAgents: [agent], allAgents: [agent] })

    await act(async () => render(<AgentManager />))

    expect(screen.getByText('Read only')).toBeInTheDocument()
    expect(screen.getByText('Configured model')).toBeInTheDocument()
    expect(screen.getByText('Configured effort')).toBeInTheDocument()
    expect(screen.getByText('Runtime may lower or omit this value when the selected model does not support it.')).toBeInTheDocument()
    expect(screen.getByText('opus')).toBeInTheDocument()
    expect(screen.queryByText('Resolved model')).not.toBeInTheDocument()
    expect(screen.queryByText('claude-opus-4-6')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('shows a non-blocking refresh warning with a retry action', async () => {
    const agent = makeAgent()
    await renderManager({ activeAgents: [agent], allAgents: [agent] })

    act(() => useAgentStore.setState({ mutationWarning: 'Refresh unavailable' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      'The change was saved, but the latest agent configuration could not be fully applied.',
    )
    expect(screen.getByRole('status')).toHaveTextContent('Refresh unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(apiListMock).toHaveBeenCalledTimes(2))
    expect(apiReloadMock).toHaveBeenCalledWith('session-1')
  })

  it('keeps the form open and shows a mutation error', async () => {
    apiCreateMock.mockRejectedValue(new Error('Agent already exists'))
    await renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Create Agent' }))
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'reviewer' } })
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: 'Review code' } })
    fireEvent.change(screen.getByLabelText('System prompt'), { target: { value: 'Review carefully.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Agent already exists')
    expect(apiCreateMock.mock.calls[0]?.[0]).not.toHaveProperty('tools')
    expect(screen.getByRole('dialog', { name: 'Create Agent' })).toBeInTheDocument()
  })
})
