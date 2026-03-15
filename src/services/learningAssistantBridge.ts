const previewPdfFiles = new Map<string, string>()

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const [, base64 = ''] = result.split(',')
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('浏览器预览环境读取 PDF 失败。'))
    reader.readAsDataURL(file)
  })
}

function buildPreviewExplanation(payload: { title: string; summary: string; question?: string }) {
  const summary = payload.summary.trim() || `先从「${payload.title}」的定义和作用入手。`
  const followUp = payload.question?.trim() || `它和相邻概念有什么区别？`

  return [
    '一、概念讲解',
    `${summary} 建议先结合知识地图定位它在整章中的位置，再回到原始资料核对定义与公式。`,
    '',
    '二、追问提示',
    `可以继续追问：${followUp}`,
    '',
    '三、一句总结',
    `先抓住「${payload.title}」的核心定义，再把它放回题目或材料里验证理解。`,
    '',
    '（当前是浏览器预览模式；桌面端接入配置后可获得真实 AI 讲解与本地文件能力。）',
  ].join('\n')
}

async function selectPreviewPdf() {
  return new Promise<{ path: string; name: string } | null>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,application/pdf'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      try {
        const base64 = await readFileAsBase64(file)
        const pseudoPath = `web-preview://${Date.now()}-${file.name}`
        previewPdfFiles.set(pseudoPath, base64)
        resolve({
          path: pseudoPath,
          name: file.name,
        })
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}

function createFallbackBridge() {
  return {
    getAppInfo: async () => ({
      name: '人工智能学习助手',
      version: 'preview',
      platform: 'web-preview',
    }),
    getConfig: async () => ({
      apiKey: '',
      baseURL: '',
      model: 'gpt-4o-mini',
      configured: false,
    }),
    setConfig: async (payload: { apiKey?: string; baseURL?: string; model?: string }) => ({
      apiKey: '',
      baseURL: payload.baseURL ?? '',
      model: payload.model ?? 'gpt-4o-mini',
      configured: Boolean(payload.apiKey),
    }),
    openPdf: async () => selectPreviewPdf(),
    readPdfFile: async (path: string) => {
      const data = previewPdfFiles.get(path)
      if (!data) {
        throw new Error('预览模式下未找到对应的 PDF 文件，请重新选择。')
      }

      return { data }
    },
    explainNode: async (payload: { title: string; summary: string; question?: string }) => ({
      content: buildPreviewExplanation(payload),
    }),
  }
}

export function getLearningAssistantBridge() {
  return window.learningAssistant ?? createFallbackBridge()
}
