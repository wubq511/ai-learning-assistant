import { getLearningAssistantBridge } from './learningAssistantBridge'
import type { ConversationMessage } from '../types/workspace'

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

export async function explainNode(payload: {
  title: string
  summary: string
  sourceText: string
  question?: string
  history?: ConversationMessage[]
}) {
  const response = await getLearningAssistantBridge().explainNode({
    title: payload.title,
    summary: payload.summary,
    sourceText: payload.sourceText,
    question: createQuestionPayload(payload.question, payload.history),
  })
  return response.content
}
