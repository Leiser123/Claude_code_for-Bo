import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { ProcessDevelopmentPage } from './ProcessDevelopmentPage'
import { useProjectStore } from '../../stores/projectStore'
import { useProcessFlowStore, type WorkflowMode } from './processFlowStore'

type Tab = 'processFlow' | 'pfmea' | 'cp' | 'wi'

function setView(tab: Tab, mode: WorkflowMode) {
  act(() => {
    useProjectStore.getState().setProcessDevActiveTab(tab)
    useProcessFlowStore.setState({ mode })
  })
}

describe('ProcessDevelopmentPage', () => {
  beforeEach(() => {
    localStorage.clear()
    useProcessFlowStore.setState({
      nodes: [],
      edges: [],
      mode: 'process',
      modeLockState: { process: false, pfmea: false, cp: false, wi: false },
    })
    setView('processFlow', 'process')
  })

  afterEach(() => {
    cleanup()
    setView('processFlow', 'process')
  })

  it('Process Flow 标签页渲染画布编辑器与节点库', () => {
    render(<ProcessDevelopmentPage />)
    expect(screen.getAllByText('Process Flow').length).toBeGreaterThan(0)
    expect(screen.getByText('节点库')).toBeInTheDocument()
    // 不使用 iframe
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('PFMEA 标签页渲染失效模式库与生成按钮', () => {
    setView('pfmea', 'pfmea')
    render(<ProcessDevelopmentPage />)
    expect(screen.getAllByText('PFMEA').length).toBeGreaterThan(0)
    expect(screen.getByText('失效模式库')).toBeInTheDocument()
    expect(screen.getByTitle('从流程生成 PFMEA')).toBeInTheDocument()
  })

  it('CP 标签页渲染控制计划表格', () => {
    setView('cp', 'cp')
    render(<ProcessDevelopmentPage />)
    expect(screen.getByText('CP · 控制计划 (Control Plan)')).toBeInTheDocument()
  })

  it('标签页顶部提供锁定按钮与 AI 生成按钮', () => {
    render(<ProcessDevelopmentPage />)
    expect(screen.getByText('锁定')).toBeInTheDocument()
    expect(screen.getByText('AI 生成')).toBeInTheDocument()
  })
})
