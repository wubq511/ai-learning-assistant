import type {
  ConversationThread,
  IngestionInput,
  KnowledgeEdge,
  KnowledgeNode,
  PdfSection,
  WorkspaceModel,
} from '../types/workspace'

const MAX_NODE_SUMMARY_LENGTH = 220
const MAX_REFERENCE_EXCERPT_LENGTH = 320

function createEdge(id: string, source: string, target: string, label: string): KnowledgeEdge {
  return { id, source, target, label }
}

function normalizeWhitespace(text: string) {
  return text.replace(/\r/g, '').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncate(text: string, maxLength: number) {
  const normalized = normalizeWhitespace(text)
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength).trimEnd()}…`
}

function deriveReadableTitle(text: string, fallback: string) {
  const baseText = normalizeWhitespace(text).replace(/^[-*•]\s*/, '').trim()
  const labelMatch = baseText.match(/^(定义|定理|性质|例题|证明|推论|应用|方法|总结|注意|公式|结论)[:：-]?\s*(.+)$/u)
  const normalized = (labelMatch?.[2] ?? baseText).trim()

  if (!normalized) {
    return fallback
  }

  const firstClause = normalized.split(/[，。；;]/)[0]?.trim() ?? normalized
  const semanticHead = firstClause
    .split(/(?=是|描述|说明|表示|指出|用于|讨论|研究|体现|满足|适用于|来源于)/)[0]
    ?.trim()

  const candidate = semanticHead || firstClause || normalized
  if (/^[A-Za-z0-9=+\-/*()^., ]{2,24}$/.test(candidate)) {
    return candidate.trim()
  }

  return truncate(candidate, 24) || fallback
}

function createNodeId(prefix: string, index: number, title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

  return `${prefix}-${index + 1}${slug ? `-${slug}` : ''}`
}

function createWorkspaceId(sourceType: IngestionInput['sourceType']) {
  return `${sourceType}-workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isGenericHeadingLabel(text: string) {
  return /^(定义|定理|性质|例题|证明|推论|应用|方法|总结|注意|公式|结论)$/u.test(text.trim())
}

function inferDepth(title: string, sourceType: IngestionInput['sourceType']) {
  if (sourceType === 'pdf') {
    return 1
  }

  if (/^(第[一二三四五六七八九十0-9]+[章节部分讲]|chapter|section|part)\b/i.test(title)) {
    return 0
  }

  if (/^(定义|定理|性质|例题|证明|推论|应用|注意|总结|步骤|方法|思路)[:：-]/.test(title)) {
    return 1
  }

  return 1
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[。！？!?；;])\s+|\n+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 0)
}

function buildSummaryFromText(text: string) {
  const sentences = splitSentences(text)
  if (sentences.length === 0) {
    return '当前片段暂无足够文本，可结合原文继续补充。'
  }

  return truncate(sentences.slice(0, 2).join(' '), MAX_NODE_SUMMARY_LENGTH)
}

function createConversationSeed(nodeId: string, summary: string): ConversationThread {
  return {
    nodeId,
    status: 'idle',
    error: '',
    messages: [
      {
        id: `${nodeId}-seed`,
        role: 'assistant',
        content: summary,
        createdAt: new Date(0).toISOString(),
      },
    ],
  }
}

function extractTopicFromHeading(line: string) {
  return line
    .replace(/^[-*•]\s*/, '')
    .replace(/^(第[一二三四五六七八九十0-9]+[章节部分讲]\s*)/, '')
    .replace(/^(定义|定理|性质|例题|证明|推论|应用|方法|总结|注意)[:：-]?\s*/u, '')
    .trim()
}

function chunkPlainText(text: string, sourceType: IngestionInput['sourceType']) {
  const normalized = text.replace(/\r/g, '').trim()
  if (!normalized) {
    return [] as Array<{ title: string; body: string; depth: number }>
  }

  const rawBlocks = normalized
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)

  const blocks = rawBlocks.length > 1 ? rawBlocks : normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean)

  const chunks = blocks.flatMap((block, blockIndex) => {
    const lines = block.split(/\n+/).map((line) => line.trim()).filter(Boolean)
    const firstLine = lines[0] ?? ''
    const restText = lines.slice(1).join(' ')
    const hasExplicitHeading = /[:：]/.test(firstLine) || /^(第[一二三四五六七八九十0-9]+[章节部分讲]|chapter|section|part|定义|定理|性质|例题|证明|推论|应用|方法|总结|注意)\b/i.test(firstLine)

    if (hasExplicitHeading) {
      const [rawTitle, ...inlineRemainder] = firstLine.split(/[:：]/)
      const body = [inlineRemainder.join('：').trim(), restText].filter(Boolean).join(' ')
      const extractedTitle = extractTopicFromHeading(rawTitle)
      const title =
        extractedTitle && !isGenericHeadingLabel(extractedTitle)
          ? extractedTitle
          : deriveReadableTitle(body || firstLine, `主题 ${blockIndex + 1}`)

      return [
        {
          title,
          body: body || firstLine,
          depth: inferDepth(rawTitle, sourceType),
        },
      ]
    }

    const sentences = splitSentences(block)
    if (sentences.length <= 2) {
      return [
        {
          title: deriveReadableTitle(firstLine, `主题 ${blockIndex + 1}`),
          body: block,
          depth: blockIndex === 0 ? 0 : 1,
        },
      ]
    }

    return sentences.map((sentence, sentenceIndex) => ({
      title:
        sentenceIndex === 0
          ? deriveReadableTitle(firstLine, `主题 ${blockIndex + 1}`)
          : deriveReadableTitle(sentence, `主题 ${blockIndex + 1}-${sentenceIndex + 1}`),
      body: sentence,
      depth: blockIndex === 0 && sentenceIndex === 0 ? 0 : 1,
    }))
  })

  return chunks.filter((chunk) => chunk.body.trim().length > 0)
}

function buildTopicNodes(title: string, sourceText: string, sourceType: 'topic' | 'notes'): KnowledgeNode[] {
  const normalizedTitle = title.trim() || (sourceType === 'topic' ? '当前主题' : '课堂笔记')
  const chunks = chunkPlainText(sourceText, sourceType)

  if (chunks.length === 0) {
    return [
      {
        id: `${sourceType}-1-overview`,
        title: normalizedTitle,
        summary: '暂未识别到足够内容，请补充更完整的主题描述或课堂笔记。',
        depth: 0,
        reference: {
          chapterTitle: normalizedTitle,
          excerpt: sourceText.trim(),
        },
      },
    ]
  }

  return chunks.map((chunk, index) => ({
    id: createNodeId(sourceType, index, chunk.title),
    title: index === 0 ? (chunk.title.startsWith('主题 ') ? normalizedTitle : chunk.title || normalizedTitle) : chunk.title,
    summary: buildSummaryFromText(chunk.body),
    depth: index === 0 ? 0 : chunk.depth,
    reference: {
      chapterTitle: chunk.title || normalizedTitle,
      excerpt: truncate(chunk.body, MAX_REFERENCE_EXCERPT_LENGTH),
    },
  }))
}

function buildNodesFromSections(title: string, sections: PdfSection[]): KnowledgeNode[] {
  if (sections.length === 0) {
    return [
      {
        id: 'pdf-1-overview',
        title: title.trim() || 'PDF 文档',
        summary: '未从 PDF 中提取到目录或可用章节，先从文档首页开始浏览。',
        depth: 0,
        reference: {
          page: 1,
          chapterTitle: '文档首页',
          excerpt: '当前 PDF 暂未提取到可用文本。',
        },
      },
    ]
  }

  return sections.map((section, index) => ({
    id: section.id || createNodeId('pdf', index, section.title),
    title: section.title,
    summary: buildSummaryFromText(section.excerpt),
    depth: Math.max(0, Math.min(section.level ?? (index === 0 ? 0 : 1), 3)),
    reference: {
      page: section.page,
      chapterTitle: section.title,
      excerpt: truncate(section.excerpt, MAX_REFERENCE_EXCERPT_LENGTH),
    },
  }))
}

function collectKeywords(node: KnowledgeNode) {
  const text = `${node.title} ${node.summary} ${node.reference?.chapterTitle ?? ''}`
  const matches = normalizeWhitespace(text)
    .toLowerCase()
    .match(/[\p{L}\p{N}=+/^*-]{2,}/gu)

  return new Set((matches ?? []).filter((keyword) => keyword.length >= 2))
}

function inferRelationLabel(node: KnowledgeNode) {
  const title = node.title.trim()
  if (/^(定义|概念)/u.test(title)) {
    return '定义'
  }

  if (/^(定理|性质|命题|结论)/u.test(title)) {
    return '结论'
  }

  if (/^(证明|推导)/u.test(title)) {
    return '证明'
  }

  if (/^(应用|例题|例|方法|步骤)/u.test(title)) {
    return '应用'
  }

  return '关联'
}

function createSemanticEdges(nodes: KnowledgeNode[]) {
  const edges: KnowledgeEdge[] = []

  for (let index = 1; index < nodes.length; index += 1) {
    const node = nodes[index]
    const previousNodes = nodes.slice(0, index)
    const siblingCandidates = previousNodes.filter((candidate) => candidate.depth === node.depth)
    const parentCandidate = [...previousNodes].reverse().find((candidate) => candidate.depth < node.depth)

    if (parentCandidate) {
      const parentLabel = inferRelationLabel(node) === '定义' ? '前置' : inferRelationLabel(node)
      edges.push(createEdge(`edge-parent-${parentCandidate.id}-${node.id}`, parentCandidate.id, node.id, parentLabel))
    }

    const keywordSource = collectKeywords(node)
    const relatedCandidate = [...previousNodes]
      .reverse()
      .find((candidate) => candidate.id !== parentCandidate?.id && [...collectKeywords(candidate)].some((keyword) => keywordSource.has(keyword)))

    if (relatedCandidate) {
      edges.push(createEdge(`edge-related-${relatedCandidate.id}-${node.id}`, relatedCandidate.id, node.id, '关联'))
    }

    const siblingCandidate = siblingCandidates[siblingCandidates.length - 1]
    if (siblingCandidate && siblingCandidate.id !== relatedCandidate?.id) {
      edges.push(createEdge(`edge-peer-${siblingCandidate.id}-${node.id}`, siblingCandidate.id, node.id, '并列'))
    }
  }

  return edges
}

function buildEdges(nodes: KnowledgeNode[]): KnowledgeEdge[] {
  if (nodes.length <= 1) {
    return []
  }

  const linearEdges = nodes.slice(1).flatMap((node, index) => {
    const edges: KnowledgeEdge[] = [createEdge(`edge-root-${index + 1}`, nodes[0].id, node.id, '展开')]
    const previousNode = nodes[index]

    if (previousNode && previousNode.id !== nodes[0].id) {
      edges.push(createEdge(`edge-seq-${index + 1}`, previousNode.id, node.id, '递进'))
    }

    return edges
  })

  const semanticEdges = createSemanticEdges(nodes)
  const dedupedEdges = new Map<string, KnowledgeEdge>()

  for (const edge of [...linearEdges, ...semanticEdges]) {
    const key = `${edge.source}-${edge.target}-${edge.label ?? ''}`
    if (!dedupedEdges.has(key)) {
      dedupedEdges.set(key, edge)
    }
  }

  return [...dedupedEdges.values()]
}

function buildConversations(nodes: KnowledgeNode[]) {
  return nodes.reduce<Record<string, ConversationThread>>((threads, node) => {
    threads[node.id] = createConversationSeed(node.id, node.summary)
    return threads
  }, {})
}

export function buildWorkspace(input: IngestionInput): WorkspaceModel {
  const timestamp = new Date().toISOString()
  const nodes =
    input.sourceType === 'pdf'
      ? buildNodesFromSections(input.title, input.pdfDocument.sections)
      : buildTopicNodes(input.title, input.sourceText, input.sourceType)

  const edges = buildEdges(nodes)
  const selectedNodeId = nodes[0]?.id ?? ''

  return {
    id: createWorkspaceId(input.sourceType),
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceType: input.sourceType,
    title: input.title,
    sourceText: input.sourceText,
    nodes,
    edges,
    selectedNodeId,
    currentPage: nodes[0]?.reference?.page ?? 1,
    conversations: buildConversations(nodes),
    studyNotes: [],
    pdfDocument: input.sourceType === 'pdf' ? input.pdfDocument : undefined,
  }
}
