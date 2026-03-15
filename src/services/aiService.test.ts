import { describe, expect, it, vi } from 'vitest'
import { explainNode, streamExplainNode } from './aiService'
import type { ExplainNodePayload } from './aiService'

function createLearningAssistantMock() {
  return {
    getAppInfo: async () => ({ name: '人工智能学习助手', version: '0.0.0', platform: 'win32' }),
    getConfig: async () => ({ apiKey: '', baseURL: '', model: 'gpt-4o-mini', configured: false }),
    setConfig: async (payload: { apiKey?: string; baseURL?: string; model?: string }) => ({
      apiKey: '',
      baseURL: payload.baseURL ?? '',
      model: payload.model ?? 'gpt-4o-mini',
      configured: Boolean(payload.apiKey),
    }),
    testConfigConnection: async (payload: { apiKey?: string; baseURL?: string; model?: string }) => ({
      connected: !!payload.apiKey,
      configured: !!payload.apiKey,
      baseURL: payload.baseURL ?? '',
      model: payload.model ?? 'gpt-4o-mini',
      message: payload.apiKey ? '连接测试成功，当前模型可用。' : '缺少 API Key，请先输入并保存或直接测试当前配置。',
    }),
    openPdf: async () => null,
    readPdfFile: async () => ({ data: '' }),
    listWorkspaces: async () => [],
    saveWorkspace: async () => [],
    loadWorkspace: async () => null,
    deleteWorkspace: async () => [],
    streamExplainNode: vi.fn(
      async (...args: [{
        requestId: string
        title: string
        summary: string
        sourceText: string
        question?: string
      }]) => {
        void args
        return { started: true }
      },
    ),
    cancelExplainNodeStream: vi.fn(async () => ({ cancelled: true })),
    onExplainNodeStreamEvent: vi.fn(
      (...args: [
        (event: {
          requestId: string
          type: 'delta' | 'done' | 'error'
          delta?: string
          content?: string
          error?: string
        }) => void,
      ]) => {
        void args
        return () => undefined
      },
    ),
    explainNode: async () => ({ content: '真实接口返回的讲解内容' }),
  }
}

describe('explainNode', () => {
  it('returns content from the Electron bridge', async () => {
    const bridge = createLearningAssistantMock()
    window.learningAssistant = bridge

    await expect(
      explainNode({
        title: '动量守恒',
        summary: '适用于系统外力合力为零的情形。',
        sourceText: '动量守恒',
      }),
    ).resolves.toBe('真实接口返回的讲解内容')
  })

  it('embeds recent conversation history into follow-up payloads', async () => {
    const explainBridgeMock = vi.fn(async () => ({ content: '带上下文的回答' }))
    const bridge = createLearningAssistantMock()
    bridge.explainNode = explainBridgeMock

    window.learningAssistant = bridge

    await explainNode({
      title: '动量守恒',
      summary: '适用于系统外力合力为零的情形。',
      sourceText: '动量守恒',
      question: '为什么先看系统？',
      history: [
        { id: '1', role: 'assistant', content: '先判断系统是否孤立。', createdAt: '2025-01-01T00:00:00.000Z' },
        { id: '2', role: 'user', content: '为什么？', createdAt: '2025-01-01T00:01:00.000Z' },
      ],
    })

    expect(explainBridgeMock).toHaveBeenCalledWith({
      title: '动量守恒',
      summary: '适用于系统外力合力为零的情形。',
      sourceText: '动量守恒',
      question: expect.stringContaining('老师：先判断系统是否孤立。'),
    })
  })

  it('streams explanation deltas through the bridge', async () => {
    const onDelta = vi.fn()
    const bridge = createLearningAssistantMock()
    let capturedRequestId = ''

    bridge.onExplainNodeStreamEvent = vi.fn((callback: (event: {
      requestId: string
      type: 'delta' | 'done' | 'error'
      delta?: string
      content?: string
      error?: string
    }) => void) => {
      queueMicrotask(() => callback({ requestId: capturedRequestId, type: 'delta', delta: '第一段', content: '第一段' }))
      queueMicrotask(() => callback({ requestId: capturedRequestId, type: 'delta', delta: '第二段', content: '第一段第二段' }))
      queueMicrotask(() => callback({ requestId: capturedRequestId, type: 'done', content: '第一段第二段' }))
      return () => undefined
    })
    bridge.streamExplainNode = vi.fn(async (payload: ExplainNodePayload & { requestId: string }) => {
      capturedRequestId = payload.requestId
      return { started: true }
    })

    window.learningAssistant = bridge

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.123456)
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890)

    await expect(
      streamExplainNode(
        {
          title: '动量守恒',
          summary: '适用于系统外力合力为零的情形。',
          sourceText: '动量守恒',
        },
        { onDelta },
      ),
    ).resolves.toBe('第一段第二段')

    expect(bridge.streamExplainNode).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'stream-1234567890-4fzyo8',
        title: '动量守恒',
      }),
    )
    expect(onDelta).toHaveBeenNthCalledWith(1, '第一段', '第一段')
    expect(onDelta).toHaveBeenNthCalledWith(2, '第一段第二段', '第二段')

    randomSpy.mockRestore()
    nowSpy.mockRestore()
  })
})
