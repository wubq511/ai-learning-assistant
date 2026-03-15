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
}

interface PdfTextContentLike {
  items: PdfTextContentItem[]
}

interface PdfPageLike {
  getTextContent: () => Promise<PdfTextContentLike>
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
  pageText: string[],
  depth = 0,
): Promise<PdfSection[]> {
  const sections: PdfSection[] = []

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const page = (await resolveDestinationPage(document, item.dest)) ?? index + 1
    sections.push({
      id: `${depth}-${index}-${page}`,
      title: normalizeTitle(item.title, index),
      page,
      excerpt: createExcerpt(pageText[page - 1] ?? ''),
    })

    if (item.items && item.items.length > 0) {
      const childSections = await flattenOutline(document, item.items, pageText, depth + 1)
      sections.push(...childSections)
    }
  }

  return sections
}

function normalizePageText(content: PdfTextContentLike) {
  return content.items
    .map((item) => item.str?.trim() ?? '')
    .filter((item) => item.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
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
      return normalizePageText(content)
    }),
  )

  return pages
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
  const sections =
    outline && outline.length > 0
      ? await flattenOutline(document, outline, pageText)
      : createFallbackSections(document.numPages).map((section) => ({
          ...section,
          excerpt: createExcerpt(pageText[section.page - 1] ?? ''),
        }))

  const documentText = pageText.filter((page) => page.length > 0).join('\n\n').trim()

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
