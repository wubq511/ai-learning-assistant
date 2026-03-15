import { Provider, createStore } from 'jotai'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AiPanel } from './AiPanel'
import { workspaceAtom } from '../store/appStore'
import { buildWorkspace } from '../services/workspaceBuilder'

const { explainNodeMock } = vi.hoisted(() => ({
  explainNodeMock: vi.fn(async () => '这是自动讲解结果。'),
}))

vi.mock('../services/aiService', () => ({
  streamExplainNode: explainNodeMock,
}))

describe('AiPanel', () => {
  beforeEach(() => {
    explainNodeMock.mockClear()
    explainNodeMock.mockResolvedValue('这是自动讲解结果。')
  })

  it('renders auto explanation into persistent conversation history', async () => {
    const store = createStore()
    store.set(
      workspaceAtom,
      buildWorkspace({
        sourceType: 'topic',
        title: '电场强度',
        sourceText: '定义：电场强度描述电场对单位正电荷的作用。\n公式：E=F/q。',
      }),
    )

    render(
      <Provider store={store}>
        <AiPanel />
      </Provider>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('这是自动讲解结果。').length).toBeGreaterThan(0)
    })

    expect(screen.getByRole('log', { name: 'AI 对话历史' })).toBeInTheDocument()
    expect(explainNodeMock).toHaveBeenCalledTimes(1)
  })

  it('sends follow-up questions with history context and appends dialogue', async () => {
    const store = createStore()
    store.set(
      workspaceAtom,
      buildWorkspace({
        sourceType: 'topic',
        title: '电场强度',
        sourceText: '定义：电场强度描述电场对单位正电荷的作用。\n公式：E=F/q。',
      }),
    )

    explainNodeMock
      .mockResolvedValueOnce('第一轮自动讲解')
      .mockResolvedValueOnce('这是对追问的回答')

    render(
      <Provider store={store}>
        <AiPanel />
      </Provider>,
    )

    await waitFor(() => {
      expect(screen.getByText('第一轮自动讲解')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('继续追问这个概念，例如“为什么这里可以这样推导？”'), {
      target: { value: '它为什么成立？' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送问题' }))

    await waitFor(() => {
      expect(screen.getByText('这是对追问的回答')).toBeInTheDocument()
    })

    expect(screen.getByText('它为什么成立？')).toBeInTheDocument()
    expect(explainNodeMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        question: '它为什么成立？',
        history: expect.arrayContaining([
          expect.objectContaining({ role: 'assistant', content: '第一轮自动讲解' }),
          expect.objectContaining({ role: 'user', content: '它为什么成立？' }),
        ]),
      }),
      expect.objectContaining({ onDelta: expect.any(Function) }),
    )
  })

  it('captures assistant and manual study notes inside workspace session', async () => {
    const store = createStore()
    store.set(
      workspaceAtom,
      buildWorkspace({
        sourceType: 'topic',
        title: '动量守恒',
        sourceText: '定义：系统合外力为零时总动量守恒。\n应用：碰撞问题常先看系统动量。',
      }),
    )

    explainNodeMock.mockResolvedValue('可保存的 AI 讲解内容')

    render(
      <Provider store={store}>
        <AiPanel />
      </Provider>,
    )

    await waitFor(() => {
      expect(screen.getByText('可保存的 AI 讲解内容')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '保存最近回复' }))

    await waitFor(() => {
      expect(screen.getByText('来自 AI')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('把当前节点的重要理解整理成自己的学习笔记'), {
      target: { value: '手动整理：先判断系统是否满足合外力为零。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存手动笔记' }))

    await waitFor(() => {
      expect(screen.getByText('手动整理')).toBeInTheDocument()
      expect(screen.getAllByText('手动整理：先判断系统是否满足合外力为零。').length).toBeGreaterThan(0)
    })
  })
})
