import { Provider, createStore } from 'jotai'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Home } from './Home'
import { workspaceAtom } from '../store/appStore'

const { bridgeMock } = vi.hoisted(() => ({
  bridgeMock: {
    getAppInfo: vi.fn(async () => ({ name: 'AI Learning Assistant', version: '0.0.0', platform: 'win32' })),
    getConfig: vi.fn(async () => ({ apiKey: '', baseURL: '', model: 'gpt-4o-mini', configured: false })),
    setConfig: vi.fn(async (payload: { apiKey?: string; baseURL?: string; model?: string }) => ({
      apiKey: '',
      baseURL: payload.baseURL ?? '',
      model: payload.model ?? 'gpt-4o-mini',
      configured: Boolean(payload.apiKey),
    })),
    openPdf: vi.fn(async () => ({ path: 'C:/lesson.pdf', name: 'lesson.pdf' })),
    readPdfFile: vi.fn(async () => ({
      data: 'JVBERi0xLjQKJcTl8uXr',
    })),
    explainNode: vi.fn(async () => ({ content: '讲解内容' })),
  },
}))

vi.mock('../services/pdfMetadata', () => ({
  base64ToUint8Array: () => new Uint8Array([1, 2, 3]),
  extractPdfMetadata: async () => ({
    pageCount: 12,
    documentText: '这是 PDF 提取出的真实文档摘要。',
    sections: [
      { id: 'pdf-1', title: '绪论', page: 1, excerpt: '绪论页的真实摘录' },
      { id: 'pdf-2', title: '应用', page: 5, excerpt: '应用页的真实摘录' },
    ],
  }),
}))

describe('Home', () => {
  beforeEach(() => {
    window.learningAssistant = bridgeMock
    bridgeMock.getConfig.mockResolvedValue({ apiKey: '', baseURL: '', model: 'gpt-4o-mini', configured: false })
    bridgeMock.setConfig.mockImplementation(async (payload: { apiKey?: string; baseURL?: string; model?: string }) => ({
      apiKey: '',
      baseURL: payload.baseURL ?? '',
      model: payload.model ?? 'gpt-4o-mini',
      configured: Boolean(payload.apiKey),
    }))
  })

  it('renders the three entry points', () => {
    render(
      <Provider>
        <Home />
      </Provider>,
    )

    expect(screen.getByText('从概念开始')).toBeInTheDocument()
    expect(screen.getByText('从课堂笔记中学习')).toBeInTheDocument()
    expect(screen.getByText('阅读并分析 PDF')).toBeInTheDocument()
  })

  it('creates a topic workspace when starting from topic input', () => {
    const store = createStore()

    render(
      <Provider store={store}>
        <Home />
      </Provider>,
    )

    fireEvent.change(screen.getByLabelText('学习主题'), { target: { value: '牛顿第二定律' } })
    fireEvent.click(screen.getByRole('button', { name: '开始学习会话' }))

    const workspace = store.get(workspaceAtom)
    expect(workspace?.sourceType).toBe('topic')
    expect(workspace?.title).toBe('牛顿第二定律')
  })

  it('creates a pdf workspace when selecting a PDF', async () => {
    const store = createStore()

    render(
      <Provider store={store}>
        <Home />
      </Provider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '浏览 PDF' }))

    await waitFor(() => {
      const workspace = store.get(workspaceAtom)
      expect(workspace?.sourceType).toBe('pdf')
      expect(workspace?.pdfDocument?.pageCount).toBe(12)
      expect(workspace?.sourceText).toBe('这是 PDF 提取出的真实文档摘要。')
    })
  })

  it('loads and saves OpenAI-compatible config', async () => {
    bridgeMock.getConfig.mockResolvedValue({
      apiKey: '',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      configured: true,
    })

    render(
      <Provider>
        <Home />
      </Provider>,
    )

    expect(await screen.findByPlaceholderText('sk-...')).toHaveValue('')
    expect(screen.getByDisplayValue('https://api.openai.com/v1')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('API 密钥'), { target: { value: 'sk-new' } })
    fireEvent.change(screen.getByLabelText('API 地址'), { target: { value: 'https://example.com/v1' } })
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'gpt-4.1-mini' } })
    fireEvent.click(screen.getByRole('button', { name: '保存连接' }))

    await waitFor(() => {
      expect(bridgeMock.setConfig).toHaveBeenCalledWith({
        apiKey: 'sk-new',
        baseURL: 'https://example.com/v1',
        model: 'gpt-4.1-mini',
      })
      expect(screen.getByText('配置已保存')).toBeInTheDocument()
    })
  })
})
