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
  explainNode: (payload: { title: string; summary: string; sourceText: string; question?: string }) =>
    ipcRenderer.invoke('ai:explain-node', payload) as Promise<{
      content: string
    }>,
}

contextBridge.exposeInMainWorld('learningAssistant', bridge)
