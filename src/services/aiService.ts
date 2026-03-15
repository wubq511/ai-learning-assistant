import { getLearningAssistantBridge } from './learningAssistantBridge'
import type { ConversationMessage } from '../types/workspace'

export interface ExplainNodePayload {
  title: string
  summary: string
  sourceText: string
  question?: string
  history?: ConversationMessage[]
}

function formatConversationHistory(history: ConversationMessage[] | undefined) {
  if (!history || history.length === 0) {
    return ''
  }

  return history
    .slice(-6)
    .map((message) => `${message.role === 'assistant' ? '老师' : '学生'}：${message.content}`)
    .join('\n')
}

function createQuestionPayload(question: string | undefined, history: ConversationMessage[] | undefined) {
  const trimmedQuestion = question?.trim()
  if (!trimmedQuestion) {
    return undefined
  }

  const historyText = formatConversationHistory(history)
  if (!historyText) {
    return trimmedQuestion
  }

  return `以下是当前节点最近的对话历史：\n${historyText}\n\n请结合上面的上下文，继续回答这个追问：${trimmedQuestion}`
}

export async function explainNode(payload: ExplainNodePayload) {
  const response = await getLearningAssistantBridge().explainNode({
    title: payload.title,
    summary: payload.summary,
    sourceText: payload.sourceText,
    question: createQuestionPayload(payload.question, payload.history),
  })
  return response.content
}

function createStreamRequestId() {
  return `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function streamExplainNode(
  payload: ExplainNodePayload,
  options?: {
    onDelta?: (content: string, delta: string) => void
    signal?: AbortSignal
  },
) {
  const bridge = getLearningAssistantBridge()
  const requestId = createStreamRequestId()

  return new Promise<string>((resolve, reject) => {
    let currentContent = ''
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      options?.signal?.removeEventListener('abort', handleAbort)
      callback()
    }

    const cleanup = bridge.onExplainNodeStreamEvent((event) => {
      if (event.requestId !== requestId) {
        return
      }

      if (event.type === 'delta' && event.delta) {
        currentContent = event.content ?? `${currentContent}${event.delta}`
        options?.onDelta?.(currentContent, event.delta)
        return
      }

      if (event.type === 'done') {
        finish(() => resolve(event.content ?? currentContent))
        return
      }

      if (event.type === 'error') {
        finish(() => reject(new Error(event.error ?? 'AI 流式请求失败。')))
      }
    })

    const handleAbort = () => {
      void bridge.cancelExplainNodeStream(requestId)
      finish(() => reject(new Error('已取消当前 AI 回复。')))
    }

    if (options?.signal) {
      if (options.signal.aborted) {
        handleAbort()
        return
      }

      options.signal.addEventListener('abort', handleAbort, { once: true })
    }

    void bridge
      .streamExplainNode({
        requestId,
        title: payload.title,
        summary: payload.summary,
        sourceText: payload.sourceText,
        question: createQuestionPayload(payload.question, payload.history),
      })
      .catch((error) => {
        finish(() => reject(error instanceof Error ? error : new Error('AI 流式请求失败。')))
      })
  })
}
