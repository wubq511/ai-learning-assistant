import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useCallback, useMemo, useState } from 'react'
import { explainNode } from '../services/aiService'
import {
  addStudyNoteAtom,
  appendConversationMessageAtom,
  replaceConversationSeedAtom,
  selectedConversationAtom,
  selectedNodeAtom,
  selectedNodeNotesAtom,
  setConversationStatusAtom,
  workspaceAtom,
} from '../store/appStore'

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function extractNoteTitle(nodeTitle: string, content: string) {
  const firstLine = content
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean)

  return firstLine?.slice(0, 28) || `${nodeTitle} 学习笔记`
}

export function AiPanel() {
  const workspace = useAtomValue(workspaceAtom)
  const selectedNode = useAtomValue(selectedNodeAtom)
  const selectedConversation = useAtomValue(selectedConversationAtom)
  const selectedNotes = useAtomValue(selectedNodeNotesAtom)
  const setConversationStatus = useSetAtom(setConversationStatusAtom)
  const appendConversationMessage = useSetAtom(appendConversationMessageAtom)
  const replaceConversationSeed = useSetAtom(replaceConversationSeedAtom)
  const addStudyNote = useSetAtom(addStudyNoteAtom)
  const [question, setQuestion] = useState('')
  const [noteDraft, setNoteDraft] = useState('')

  const latestAssistantMessage = useMemo(
    () => [...(selectedConversation?.messages ?? [])].reverse().find((message) => message.role === 'assistant') ?? null,
    [selectedConversation?.messages],
  )

  const requestExplanation = useCallback(
    async (customQuestion?: string) => {
      if (!workspace || !selectedNode) {
        return
      }

      const nodeId = selectedNode.id
      const trimmedQuestion = customQuestion?.trim()

      const userMessage =
        trimmedQuestion && trimmedQuestion.length > 0
          ? {
              id: createMessageId('user'),
              role: 'user' as const,
              content: trimmedQuestion,
              createdAt: new Date().toISOString(),
            }
          : null

      if (userMessage) {
        appendConversationMessage({
          nodeId,
          message: userMessage,
        })
      }

      setConversationStatus({ nodeId, status: 'loading' })

      try {
        const sourceText = selectedNode.reference?.excerpt?.trim() || workspace.sourceText
        const nextExplanation = await explainNode({
          title: selectedNode.title,
          summary: selectedNode.summary,
          sourceText,
          question: trimmedQuestion || undefined,
          history: userMessage
            ? [...(workspace.conversations[nodeId]?.messages ?? []), userMessage]
            : workspace.conversations[nodeId]?.messages,
        })

        if (trimmedQuestion) {
          appendConversationMessage({
            nodeId,
            message: {
              id: createMessageId('assistant'),
              role: 'assistant',
              content: nextExplanation,
              createdAt: new Date().toISOString(),
            },
          })
        } else {
          replaceConversationSeed({ nodeId, content: nextExplanation })
        }

        setConversationStatus({ nodeId, status: 'idle' })
      } catch (error) {
        setConversationStatus({
          nodeId,
          status: 'error',
          error: error instanceof Error ? error.message : 'AI 请求失败。',
        })
      }
    },
    [workspace, selectedNode, appendConversationMessage, setConversationStatus, replaceConversationSeed],
  )

  useEffect(() => {
    if (!workspace || !selectedNode || !selectedConversation) {
      return
    }

    const autoExplanationPending =
      selectedConversation.status === 'idle' &&
      selectedConversation.messages.length === 1 &&
      selectedConversation.messages[0]?.id.endsWith('-seed') &&
      selectedConversation.messages[0]?.content === selectedNode.summary

    if (!autoExplanationPending) {
      return
    }

    void requestExplanation()
  }, [selectedConversation, selectedNode, workspace, requestExplanation])

  if (!workspace) {
    return (
      <aside className="workspace-panel workspace-panel--ai">
        <div className="panel-empty-state">
          <h2>AI 讲解区</h2>
          <p>进入学习主题后，这里会保留节点讲解、追问历史与会话内学习笔记。</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="workspace-panel workspace-panel--ai">
      <header className="workspace-panel__header">
        <div>
          <span className="eyebrow">AI 老师</span>
          <h2>{selectedNode?.title ?? workspace.title}</h2>
        </div>
      </header>

      <div className="ai-flow ai-flow--conversation">
        <section className="ai-card">
          <span className="ai-card__label">当前节点</span>
          <p>{selectedNode?.summary ?? '请选择一个节点开始讲解。'}</p>
          {selectedNode?.reference?.excerpt ? (
            <blockquote className="source-excerpt">{selectedNode.reference.excerpt}</blockquote>
          ) : null}
        </section>

        <section className="ai-card">
          <div className="ai-card__header-row">
            <span className="ai-card__label">对话历史</span>
            {selectedConversation?.status === 'loading' ? <span className="page-chip">AI 思考中</span> : null}
          </div>
          <div className="conversation-list" role="log" aria-label="AI 对话历史">
            {(selectedConversation?.messages ?? []).map((message) => (
              <article
                key={message.id}
                className={`conversation-message conversation-message--${message.role}`}
              >
                <strong>{message.role === 'assistant' ? 'AI 老师' : '你'}</strong>
                <p>{message.content}</p>
              </article>
            ))}
            {selectedConversation?.status === 'error' ? (
              <p className="conversation-error">{selectedConversation.error}</p>
            ) : null}
          </div>
        </section>

        <section className="ai-card">
          <div className="ai-card__header-row">
            <span className="ai-card__label">学习笔记</span>
            {latestAssistantMessage ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  addStudyNote({
                    nodeId: selectedNode?.id ?? '',
                    title: extractNoteTitle(selectedNode?.title ?? workspace.title, latestAssistantMessage.content),
                    content: latestAssistantMessage.content,
                    source: 'assistant',
                  })
                }}
              >
                保存最近回复
              </button>
            ) : null}
          </div>
          <textarea
            className="text-area text-area--compact"
            placeholder="把当前节点的重要理解整理成自己的学习笔记"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
          />
          <button
            className="secondary-button"
            type="button"
            disabled={!selectedNode || noteDraft.trim().length === 0}
            onClick={() => {
              if (!selectedNode || noteDraft.trim().length === 0) {
                return
              }

              addStudyNote({
                nodeId: selectedNode.id,
                title: extractNoteTitle(selectedNode.title, noteDraft),
                content: noteDraft,
                source: 'manual',
              })
              setNoteDraft('')
            }}
          >
            保存手动笔记
          </button>
          <div className="study-note-list">
            {selectedNotes.length === 0 ? (
              <p className="study-note-list__empty">当前节点还没有会话内学习笔记。</p>
            ) : (
              selectedNotes.map((note) => (
                <article key={note.id} className="study-note-card">
                  <div className="study-note-card__meta">
                    <strong>{note.title}</strong>
                    <span>{note.source === 'assistant' ? '来自 AI' : '手动整理'}</span>
                  </div>
                  <p>{note.content}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="ai-input-shell">
        <textarea
          className="text-area text-area--compact"
          placeholder="继续追问这个概念，例如“为什么这里可以这样推导？”"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button
          className="primary-button"
          type="button"
          disabled={selectedConversation?.status === 'loading' || question.trim().length === 0}
          onClick={async () => {
            const trimmedQuestion = question.trim()
            if (!trimmedQuestion) {
              return
            }

            await requestExplanation(trimmedQuestion)
            setQuestion('')
          }}
        >
          发送问题
        </button>
      </div>
    </aside>
  )
}
