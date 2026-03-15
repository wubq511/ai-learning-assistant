import { useSetAtom } from 'jotai'
import { buildWorkspace } from '../services/workspaceBuilder'
import { getLearningAssistantBridge } from '../services/learningAssistantBridge'
import { screenAtom, setWorkspaceAtom } from '../store/appStore'

function deriveNotesTitle(notes: string) {
  const firstLine = notes
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) {
    return '课堂笔记'
  }

  const stripped = firstLine
    .replace(/^[-*•]\s*/, '')
    .replace(/^(定义|定理|性质|例题|证明|推论|应用|方法|总结|注意|公式|结论)[:：-]?\s*/u, '')
    .trim()

  const semanticHead = (stripped.split(/[，。；;]/)[0] ?? stripped)
    .split(/(?=是|描述|说明|表示|指出|用于|讨论|研究|体现|满足|适用于|来源于)/)[0]
    ?.trim()

  const title = semanticHead || stripped || firstLine
  return title.length <= 18 ? title : `${title.slice(0, 18).trimEnd()}…`
}

export function useIngestion() {
  const setWorkspace = useSetAtom(setWorkspaceAtom)
  const setScreen = useSetAtom(screenAtom)

  function openWorkspace() {
    setScreen('workspace')
  }

  function startTopicSession(topic: string) {
    const title = topic.trim() || '未命名主题'
    setWorkspace(
      buildWorkspace({
        sourceType: 'topic',
        title,
        sourceText: topic,
      }),
    )
    openWorkspace()
  }

  function startNotesSession(notes: string) {
    const title = deriveNotesTitle(notes)
    setWorkspace(
      buildWorkspace({
        sourceType: 'notes',
        title,
        sourceText: notes,
      }),
    )
    openWorkspace()
  }

  async function startPdfSession(file: { path: string; name: string }) {
    const { base64ToUint8Array, extractPdfMetadata } = await import('../services/pdfMetadata')
    const encoded = await getLearningAssistantBridge().readPdfFile(file.path)
    const data = base64ToUint8Array(encoded.data)
    const metadata = await extractPdfMetadata(data)
    const sourceText =
      metadata.documentText.trim() ||
      metadata.sections
        .map((section) => section.excerpt)
        .filter((excerpt) => excerpt && excerpt !== '当前页暂未提取到可用文本。')
        .join('\n\n') ||
      '当前 PDF 暂未提取到可用文本。'

    setWorkspace(
      buildWorkspace({
        sourceType: 'pdf',
        title: file.name,
        sourceText,
        pdfDocument: {
          name: file.name,
          path: file.path,
          data,
          pageCount: metadata.pageCount,
          sections: metadata.sections,
        },
      }),
    )
    openWorkspace()
  }

  return {
    startTopicSession,
    startNotesSession,
    startPdfSession,
  }
}
