import { Provider, createStore } from 'jotai'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Workspace } from './Workspace'
import { workspaceAtom } from '../store/appStore'
import { buildWorkspace } from '../services/workspaceBuilder'

vi.mock('../services/aiService', () => ({
  streamExplainNode: async () => '这是由测试桩返回的讲解内容。',
}))

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  Document: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-document">{children}</div>,
  Page: ({ pageNumber }: { pageNumber: number }) => <div>PDF Page {pageNumber}</div>,
}))

describe('Workspace', () => {
  it('renders three workspace columns', async () => {
    const store = createStore()
    store.set(
      workspaceAtom,
      buildWorkspace({
        sourceType: 'pdf',
        title: 'lesson.pdf',
        sourceText: 'lesson pdf content',
        pdfDocument: {
          name: 'lesson.pdf',
          path: 'C:/lesson.pdf',
          data: new Uint8Array([1, 2, 3]),
          pageCount: 10,
          sections: [{ id: 'chapter-1', title: '绪论', page: 2, excerpt: '第 2 页的真实摘录' }],
        },
      }),
    )

    await act(async () => {
      render(
        <Provider store={store}>
          <Workspace />
        </Provider>,
      )
    })

    expect(screen.getByText('知识地图')).toBeInTheDocument()
    expect(screen.getByText('PDF 阅读区')).toBeInTheDocument()
    expect(screen.getAllByText('AI 老师').length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(screen.getByText('这是由测试桩返回的讲解内容。')).toBeInTheDocument()
    })
  })

  it('toggles the map mode label', async () => {
    const store = createStore()
    store.set(
      workspaceAtom,
      buildWorkspace({
        sourceType: 'topic',
        title: '矩阵',
        sourceText: '定义：矩阵是按长方阵列排列的数。\n运算：矩阵乘法不满足交换律。',
      }),
    )

    await act(async () => {
      render(
        <Provider store={store}>
          <Workspace />
        </Provider>,
      )
    })

    fireEvent.click(await screen.findByRole('button', { name: '切换到关系图' }))

    await waitFor(() => {
      expect(screen.getByText('关系概览')).toBeInTheDocument()
    })
  })

  it('supports pdf page jump and section synchronization', async () => {
    const store = createStore()
    store.set(
      workspaceAtom,
      buildWorkspace({
        sourceType: 'pdf',
        title: 'lesson.pdf',
        sourceText: '绪论\n应用',
        pdfDocument: {
          name: 'lesson.pdf',
          path: 'C:/lesson.pdf',
          data: new Uint8Array([1, 2, 3]),
          pageCount: 12,
          sections: [
            { id: 'chapter-1', title: '绪论', page: 2, excerpt: '第 2 页的真实摘录' },
            { id: 'chapter-2', title: '应用', page: 5, excerpt: '第 5 页的应用摘录' },
          ],
        },
      }),
    )

    await act(async () => {
      render(
        <Provider store={store}>
          <Workspace />
        </Provider>,
      )
    })

    await waitFor(() => {
      expect(screen.getByText('PDF Page 2')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('页码'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: '跳转' }))

    await waitFor(() => {
      expect(screen.getByText('PDF Page 5')).toBeInTheDocument()
      expect(screen.getByText('同步节点：应用')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /绪论P\.2/ }))

    await waitFor(() => {
      expect(screen.getByText('PDF Page 2')).toBeInTheDocument()
      expect(screen.getByText('同步节点：绪论')).toBeInTheDocument()
    })
  })
})
