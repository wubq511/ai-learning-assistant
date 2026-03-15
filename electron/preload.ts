import { contextBridge, ipcRenderer } from 'electron'

const bridge = {
  getAppInfo: () => ipcRenderer.invoke('app:get-info') as Promise<{
    name: string
    version: string
    platform: string
  }>,
  getConfig: () =>
    ipcRenderer.invoke('config:get') as Promise<{
      apiKey: string
      baseURL: string
      model: string
      configured: boolean
    }>,
  setConfig: (payload: { apiKey?: string; baseURL?: string; model?: string }) =>
    ipcRenderer.invoke('config:set', payload) as Promise<{
      apiKey: string
      baseURL: string
      model: string
      configured: boolean
    }>,
  testConfigConnection: (payload: { apiKey?: string; baseURL?: string; model?: string }) =>
    ipcRenderer.invoke('config:test-connection', payload) as Promise<{
      connected: boolean
      configured: boolean
      baseURL: string
      model: string
      message: string
    }>,
  openPdf: () =>
    ipcRenderer.invoke('dialog:open-pdf') as Promise<
      | {
          path: string
          name: string
        }
      | null
    >,
  readPdfFile: (path: string) =>
    ipcRenderer.invoke('pdf:read-file', path) as Promise<{
      data: string
    }>,
  listWorkspaces: () =>
    ipcRenderer.invoke('workspace:list') as Promise<
      Array<{
        id: string
        title: string
        sourceType: 'topic' | 'notes' | 'pdf'
        createdAt: string
        updatedAt: string
        noteCount: number
        nodeCount: number
        selectedNodeTitle: string
        hasPdfDocument: boolean
      }>
    >,
  saveWorkspace: (workspace: import('../src/services/workspacePersistence').PersistedWorkspaceModel) =>
    ipcRenderer.invoke('workspace:save', workspace) as Promise<
      Array<{
        id: string
        title: string
        sourceType: 'topic' | 'notes' | 'pdf'
        createdAt: string
        updatedAt: string
        noteCount: number
        nodeCount: number
        selectedNodeTitle: string
        hasPdfDocument: boolean
      }>
    >,
  loadWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('workspace:load', workspaceId) as Promise<
      import('../src/services/workspacePersistence').PersistedWorkspaceModel | null
    >,
  deleteWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('workspace:delete', workspaceId) as Promise<
      Array<{
        id: string
        title: string
        sourceType: 'topic' | 'notes' | 'pdf'
        createdAt: string
        updatedAt: string
        noteCount: number
        nodeCount: number
        selectedNodeTitle: string
        hasPdfDocument: boolean
      }>
    >,
  streamExplainNode: (payload: {
    requestId: string
    title: string
    summary: string
    sourceText: string
    question?: string
  }) =>
    ipcRenderer.invoke('ai:stream-explain-node', payload) as Promise<{
      started: boolean
    }>,
  cancelExplainNodeStream: (requestId: string) =>
    ipcRenderer.invoke('ai:stream-cancel', requestId) as Promise<{
      cancelled: boolean
    }>,
  onExplainNodeStreamEvent: (
    callback: (event: { requestId: string; type: 'delta' | 'done' | 'error'; delta?: string; content?: string; error?: string }) => void,
  ) => {
    const listener = (
      _event: unknown,
      payload: { requestId: string; type: 'delta' | 'done' | 'error'; delta?: string; content?: string; error?: string },
    ) => callback(payload)

    ipcRenderer.on('ai:stream-event', listener)

    return () => {
      ipcRenderer.removeListener('ai:stream-event', listener)
    }
  },
  explainNode: (payload: { title: string; summary: string; sourceText: string; question?: string }) =>
    ipcRenderer.invoke('ai:explain-node', payload) as Promise<{
      content: string
    }>,
}

contextBridge.exposeInMainWorld('learningAssistant', bridge)
