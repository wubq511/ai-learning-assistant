import { atom } from 'jotai'
import type { ConversationMessage, ConversationThread, KnowledgeMapMode, WorkspaceModel } from '../types/workspace'

export type Screen = 'home' | 'workspace'

export const screenAtom = atom<Screen>('home')
export const knowledgeMapModeAtom = atom<KnowledgeMapMode>('hierarchy')
export const appInfoAtom = atom<{ name: string; version: string; platform: string } | null>(null)
export const workspaceAtom = atom<WorkspaceModel | null>(null)

export const selectedNodeAtom = atom((get) => {
  const workspace = get(workspaceAtom)
  if (!workspace) {
    return null
  }

  return workspace.nodes.find((node) => node.id === workspace.selectedNodeId) ?? null
})

export const selectedConversationAtom = atom((get) => {
  const workspace = get(workspaceAtom)
  const selectedNode = get(selectedNodeAtom)

  if (!workspace || !selectedNode) {
    return null
  }

  return workspace.conversations[selectedNode.id] ?? null
})

export const selectedNodeNotesAtom = atom((get) => {
  const workspace = get(workspaceAtom)
  const selectedNode = get(selectedNodeAtom)

  if (!workspace || !selectedNode) {
    return []
  }

  return workspace.studyNotes.filter((note) => note.nodeId === selectedNode.id)
})

function updateWorkspace(
  workspace: WorkspaceModel | null,
  updater: (workspace: WorkspaceModel) => WorkspaceModel,
) {
  if (!workspace) {
    return null
  }

  return updater(workspace)
}

export const selectNodeAtom = atom(null, (get, set, nodeId: string) => {
  const workspace = get(workspaceAtom)
  if (!workspace) {
    return
  }

  const nextNode = workspace.nodes.find((node) => node.id === nodeId)
  if (!nextNode) {
    return
  }

  set(workspaceAtom, {
    ...workspace,
    selectedNodeId: nodeId,
    currentPage: nextNode.reference?.page ?? workspace.currentPage,
  })
})

export const setCurrentPageAtom = atom(null, (get, set, page: number) => {
  const workspace = get(workspaceAtom)
  if (!workspace || !workspace.pdfDocument) {
    return
  }

  const matchedNode =
    workspace.nodes.find((node) => node.reference?.page === page) ??
    [...workspace.nodes]
      .filter((node) => typeof node.reference?.page === 'number' && (node.reference?.page ?? 0) <= page)
      .sort((left, right) => (right.reference?.page ?? 0) - (left.reference?.page ?? 0))[0]

  set(workspaceAtom, {
    ...workspace,
    currentPage: page,
    selectedNodeId: matchedNode?.id ?? workspace.selectedNodeId,
  })
})

export const jumpToNodePageAtom = atom(null, (get, set, nodeId: string) => {
  const workspace = get(workspaceAtom)
  if (!workspace) {
    return
  }

  const node = workspace.nodes.find((item) => item.id === nodeId)
  if (!node) {
    return
  }

  set(workspaceAtom, {
    ...workspace,
    selectedNodeId: nodeId,
    currentPage: node.reference?.page ?? workspace.currentPage,
  })
})

export const setConversationStatusAtom = atom(
  null,
  (get, set, payload: { nodeId: string; status: ConversationThread['status']; error?: string }) => {
    const workspace = get(workspaceAtom)
    const nextWorkspace = updateWorkspace(workspace, (currentWorkspace) => ({
      ...currentWorkspace,
      conversations: {
        ...currentWorkspace.conversations,
        [payload.nodeId]: {
          ...(currentWorkspace.conversations[payload.nodeId] ?? {
            nodeId: payload.nodeId,
            status: 'idle',
            error: '',
            messages: [],
          }),
          status: payload.status,
          error: payload.error ?? '',
        },
      },
    }))

    if (nextWorkspace) {
      set(workspaceAtom, nextWorkspace)
    }
  },
)

export const appendConversationMessageAtom = atom(
  null,
  (get, set, payload: { nodeId: string; message: ConversationMessage }) => {
    const workspace = get(workspaceAtom)
    const nextWorkspace = updateWorkspace(workspace, (currentWorkspace) => {
      const existingThread = currentWorkspace.conversations[payload.nodeId] ?? {
        nodeId: payload.nodeId,
        status: 'idle' as const,
        error: '',
        messages: [],
      }

      return {
        ...currentWorkspace,
        conversations: {
          ...currentWorkspace.conversations,
          [payload.nodeId]: {
            ...existingThread,
            error: '',
            messages: [...existingThread.messages, payload.message],
          },
        },
      }
    })

    if (nextWorkspace) {
      set(workspaceAtom, nextWorkspace)
    }
  },
)

export const replaceConversationSeedAtom = atom(null, (get, set, payload: { nodeId: string; content: string }) => {
  const workspace = get(workspaceAtom)
  const nextWorkspace = updateWorkspace(workspace, (currentWorkspace) => {
    const existingThread = currentWorkspace.conversations[payload.nodeId]
    if (!existingThread) {
      return currentWorkspace
    }

    const hasOnlySeed = existingThread.messages.length === 1 && existingThread.messages[0]?.id.endsWith('-seed')
    if (!hasOnlySeed) {
      return currentWorkspace
    }

    return {
      ...currentWorkspace,
      conversations: {
        ...currentWorkspace.conversations,
        [payload.nodeId]: {
          ...existingThread,
          messages: [
            {
              ...existingThread.messages[0],
              content: payload.content,
            },
          ],
        },
      },
    }
  })

  if (nextWorkspace) {
    set(workspaceAtom, nextWorkspace)
  }
})

export const addStudyNoteAtom = atom(
  null,
  (
    get,
    set,
    payload: {
      nodeId: string
      title: string
      content: string
      source: 'assistant' | 'manual'
    },
  ) => {
    const workspace = get(workspaceAtom)
    const nextWorkspace = updateWorkspace(workspace, (currentWorkspace) => {
      const node = currentWorkspace.nodes.find((item) => item.id === payload.nodeId)
      if (!node) {
        return currentWorkspace
      }

      const createdAt = new Date().toISOString()

      return {
        ...currentWorkspace,
        studyNotes: [
          {
            id: `${payload.nodeId}-note-${createdAt}`,
            nodeId: payload.nodeId,
            title: payload.title.trim() || node.title,
            content: payload.content.trim(),
            createdAt,
            source: payload.source,
            page: node.reference?.page,
          },
          ...currentWorkspace.studyNotes,
        ],
      }
    })

    if (nextWorkspace) {
      set(workspaceAtom, nextWorkspace)
    }
  },
)

export const toggleKnowledgeMapModeAtom = atom(null, (get, set) => {
  const currentMode = get(knowledgeMapModeAtom)
  set(knowledgeMapModeAtom, currentMode === 'hierarchy' ? 'relationship' : 'hierarchy')
})

export const returnHomeAtom = atom(null, (_get, set) => {
  set(screenAtom, 'home')
})
