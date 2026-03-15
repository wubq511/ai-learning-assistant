export {}

declare global {
  interface Window {
    learningAssistant: {
      getAppInfo: () => Promise<{
        name: string
        version: string
        platform: string
      }>
      getConfig: () => Promise<{
        apiKey: string
        baseURL: string
        model: string
        configured: boolean
      }>
      setConfig: (payload: { apiKey?: string; baseURL?: string; model?: string }) => Promise<{
        apiKey: string
        baseURL: string
        model: string
        configured: boolean
      }>
      openPdf: () => Promise<{
        path: string
        name: string
      } | null>
      readPdfFile: (path: string) => Promise<{
        data: string
      }>
      explainNode: (payload: { title: string; summary: string; sourceText: string; question?: string }) => Promise<{
        content: string
      }>
    }
  }
}
