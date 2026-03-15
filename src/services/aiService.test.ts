import { describe, expect, it } from 'vitest'
import { explainNode } from './aiService'

describe('explainNode', () => {
  it('returns content from the Electron bridge', async () => {
    window.learningAssistant = {
      getAppInfo: async () => ({ name: '人工智能学习助手', version: '0.0.0', platform: 'win32' }),
      getConfig: async () => ({ apiKey: '', baseURL: '', model: 'gpt-4o-mini', configured: false }),
      setConfig: async (payload: { apiKey?: string; baseURL?: string; model?: string }) => ({
        apiKey: '',
        baseURL: payload.baseURL ?? '',
        model: payload.model ?? 'gpt-4o-mini',
        configured: Boolean(payload.apiKey),
      }),
      openPdf: async () => null,
      readPdfFile: async () => ({ data: '' }),
      explainNode: async () => ({ content: '真实接口返回的讲解内容' }),
    }

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

    window.learningAssistant = {
      getAppInfo: async () => ({ name: '人工智能学习助手', version: '0.0.0', platform: 'win32' }),
      getConfig: async () => ({ apiKey: '', baseURL: '', model: 'gpt-4o-mini', configured: false }),
      setConfig: async (payload: { apiKey?: string; baseURL?: string; model?: string }) => ({
        apiKey: '',
        baseURL: payload.baseURL ?? '',
        model: payload.model ?? 'gpt-4o-mini',
        configured: Boolean(payload.apiKey),
      }),
      openPdf: async () => null,
      readPdfFile: async () => ({ data: '' }),
      explainNode: explainBridgeMock,
    }

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
})
