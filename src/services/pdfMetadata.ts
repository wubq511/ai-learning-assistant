import type { PdfSection } from '../types/workspace'
import * as pdfjsLib from 'pdfjs-dist'

type DestinationReference = string | readonly unknown[] | null | undefined

interface PdfOutlineItem {
  title?: string
  dest?: DestinationReference
  items?: PdfOutlineItem[]
}

interface PdfDocumentLike {
  numPages: number
  getOutline: () => Promise<PdfOutlineItem[] | null>
  getDestination: (destination: string) => Promise<readonly unknown[] | null>
  getPageIndex: (reference: object) => Promise<number>
  getPage: (pageNumber: number) => Promise<PdfPageLike>
}

interface PdfTextContentItem {
  str?: string
  transform?: number[]
  hasEOL?: boolean
}

interface PdfTextContentLike {
  items: PdfTextContentItem[]
}

interface PdfPageLike {
  getTextContent: () => Promise<PdfTextContentLike>
}

interface PageTextSnapshot {
  fullText: string
  lines: string[]
}

async function getPdfjs() {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  return pdfjsLib
}

function normalizeTitle(title: string | undefined, index: number) {
  const trimmed = title?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : `章节 ${index + 1}`
}

async function resolveDestinationPage(document: PdfDocumentLike, destination: DestinationReference) {
  let resolvedDestination = destination

  if (typeof destination === 'string') {
    resolvedDestination = await document.getDestination(destination)
  }

  if (!resolvedDestination || resolvedDestination.length === 0) {
    return undefined
  }

  const rawReference = resolvedDestination[0]
  if (typeof rawReference === 'object' && rawReference !== null) {
    const pageIndex = await document.getPageIndex(rawReference)
    return pageIndex + 1
  }

  if (typeof rawReference === 'number') {
    return rawReference + 1
  }

  return undefined
}

async function flattenOutline(
  document: PdfDocumentLike,
  items: PdfOutlineItem[],
  pageText: PageTextSnapshot[],
  level = 0,
): Promise<PdfSection[]> {
  const sections: PdfSection[] = []

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const page = (await resolveDestinationPage(document, item.dest)) ?? index + 1
    sections.push({
      id: `${level}-${index}-${page}`,
      title: normalizeTitle(item.title, index),
      page,
      excerpt: createExcerpt(pageText[page - 1]?.fullText ?? ''),
      level,
    })

    if (item.items && item.items.length > 0) {
      const childSections = await flattenOutline(document, item.items, pageText, level + 1)
      sections.push(...childSections)
    }
  }

  return sections
}

function normalizeLine(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function buildPageTextSnapshot(content: PdfTextContentLike): PageTextSnapshot {
  const groupedLines: string[] = []
  let currentLine = ''
  let lastY: number | null = null

  for (const item of content.items) {
    const chunk = item.str?.trim() ?? ''
    if (!chunk) {
      continue
    }

    const y = Array.isArray(item.transform) ? item.transform[5] : null
    const shouldBreakLine =
      item.hasEOL === true ||
      (typeof y === 'number' && lastY !== null && Math.abs(y - lastY) > 4)

    if (shouldBreakLine && currentLine) {
      const normalizedLine = normalizeLine(currentLine)
      if (normalizedLine) {
        groupedLines.push(normalizedLine)
      }
      currentLine = ''
    }

    currentLine = currentLine ? `${currentLine} ${chunk}` : chunk
    lastY = typeof y === 'number' ? y : lastY
  }

  if (currentLine) {
    const normalizedLine = normalizeLine(currentLine)
    if (normalizedLine) {
      groupedLines.push(normalizedLine)
    }
  }

  const fullText = groupedLines.join(' ').trim()

  return {
    fullText,
    lines: groupedLines,
  }
}

function createExcerpt(text: string, maxLength = 180) {
  const normalized = text.trim()
  if (!normalized) {
    return '当前页暂未提取到可用文本。'
  }

  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}…`
}

async function extractPageText(document: PdfDocumentLike) {
  const pages = await Promise.all(
    Array.from({ length: document.numPages }, async (_value, index) => {
      const page = await document.getPage(index + 1)
      const content = await page.getTextContent()
      return buildPageTextSnapshot(content)
    }),
  )

  return pages
}

function inferSectionLevel(title: string) {
  if (/^(第[一二三四五六七八九十百千万0-9]+[编部篇章节]|chapter\s+\d+|part\s+\d+)/i.test(title)) {
    return 0
  }

  if (/^([0-9]+(\.[0-9]+){0,2}|[一二三四五六七八九十]+[、.])\s*/u.test(title)) {
    return 1
  }

  if (/^(定义|定理|性质|命题|证明|例题|例|推论|应用|方法|总结|注意|公式)[:：\s-]?/u.test(title)) {
    return 2
  }

  return 1
}

function looksLikeHeading(line: string) {
  const normalized = normalizeLine(line)
  if (!normalized || normalized.length > 36) {
    return false
  }

  if (/^(第[一二三四五六七八九十百千万0-9]+[编部篇章节]|chapter\s+\d+|section\s+\d+|part\s+\d+)/i.test(normalized)) {
    return true
  }

  if (/^([0-9]+(\.[0-9]+){0,2}|[一二三四五六七八九十]+[、.])\s*\S+/u.test(normalized)) {
    return true
  }

  if (/^(定义|定理|性质|命题|证明|例题|例|推论|应用|方法|总结|注意|公式)[:：\s-]?\S*/u.test(normalized)) {
    return true
  }

  const noPunctuation = !/[，。；：！？!?]/.test(normalized)
  return noPunctuation && normalized.length >= 4 && normalized.length <= 20
}

export function deriveSectionsFromPageText(pageText: PageTextSnapshot[]): PdfSection[] {
  const sections: PdfSection[] = []
  const seen = new Set<string>()

  for (let pageIndex = 0; pageIndex < pageText.length; pageIndex += 1) {
    const snapshot = pageText[pageIndex]
    const heading = snapshot.lines.find(looksLikeHeading)

    if (!heading) {
      continue
    }

    const normalizedHeading = normalizeLine(heading)
    const key = `${pageIndex + 1}:${normalizedHeading}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    sections.push({
      id: `derived-${pageIndex + 1}`,
      title: normalizedHeading,
      page: pageIndex + 1,
      excerpt: createExcerpt(snapshot.fullText),
      level: inferSectionLevel(normalizedHeading),
    })
  }

  return sections
}

function createFallbackSections(pageCount: number): PdfSection[] {
  const safePageCount = Math.max(pageCount, 1)
  const desiredSections = Math.min(4, safePageCount)
  const step = Math.max(1, Math.ceil(safePageCount / desiredSections))
  const sections: PdfSection[] = []

  for (let page = 1; page <= safePageCount; page += step) {
    sections.push({
      id: `fallback-${page}`,
      title: `第 ${page} 页附近内容`,
      page,
      excerpt: '当前页暂未提取到可用文本。',
      level: page === 1 ? 0 : 1,
    })
  }

  return sections
}

export async function extractPdfMetadata(data: Uint8Array): Promise<{
  pageCount: number
  documentText: string
  sections: PdfSection[]
}> {
  const pdfjs = await getPdfjs()
  const loadingTask = pdfjs.getDocument({ data })
  const document = (await loadingTask.promise) as unknown as PdfDocumentLike
  const pageText = await extractPageText(document)
  const outline = await document.getOutline()
  const derivedSections = deriveSectionsFromPageText(pageText)
  const sections =
    outline && outline.length > 0
      ? await flattenOutline(document, outline, pageText)
      : derivedSections.length > 0
        ? derivedSections
        : createFallbackSections(document.numPages).map((section) => ({
            ...section,
            excerpt: createExcerpt(pageText[section.page - 1]?.fullText ?? ''),
          }))

  const documentText = pageText.map((page) => page.fullText).filter((page) => page.length > 0).join('\n\n').trim()

  return {
    pageCount: document.numPages,
    documentText,
    sections,
  }
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = window.atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
