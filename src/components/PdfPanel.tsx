import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { useAtomValue, useSetAtom } from 'jotai'
import { jumpToNodePageAtom, selectedNodeAtom, setCurrentPageAtom, workspaceAtom } from '../store/appStore'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

export function PdfPanel() {
  const workspace = useAtomValue(workspaceAtom)
  const selectedNode = useAtomValue(selectedNodeAtom)
  const setCurrentPage = useSetAtom(setCurrentPageAtom)
  const jumpToNodePage = useSetAtom(jumpToNodePageAtom)
  const [pageInput, setPageInput] = useState('')
  const [pdfError, setPdfError] = useState('')

  if (!workspace) {
    return (
      <section className="workspace-panel workspace-panel--pdf">
        <div className="panel-empty-state">
          <div className="panel-empty-state__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <h2>PDF 阅读器</h2>
          <p>导入讲义后，这里会显示文档页面、章节导航与节点页码联动。</p>
        </div>
      </section>
    )
  }

  const hasPdf = workspace.sourceType === 'pdf'

  return (
    <section className="workspace-panel workspace-panel--pdf">
      <header className="workspace-panel__header">
        <div>
          <span className="eyebrow">PDF 阅读区</span>
          <h2>{workspace.pdfDocument?.name ?? '当前没有 PDF'}</h2>
        </div>
        <div className="page-chip">第 {workspace.currentPage} / {workspace.pdfDocument?.pageCount ?? 1} 页</div>
      </header>

      <div className="pdf-canvas pdf-canvas--enhanced">
        {hasPdf ? (
          <>
            <section className="ai-card pdf-context-card">
              <div className="ai-card__header-row">
                <span className="ai-card__label">当前联动</span>
                {selectedNode?.reference?.page ? (
                  <button className="ghost-button" type="button" onClick={() => jumpToNodePage(selectedNode.id)}>
                    跳到节点页
                  </button>
                ) : null}
              </div>
              <p>同步节点：{selectedNode?.title ?? '未选中节点'}</p>
              <p>章节：{selectedNode?.reference?.chapterTitle ?? '未标注章节'}</p>
              {selectedNode?.reference?.excerpt ? (
                <blockquote className="source-excerpt">{selectedNode.reference.excerpt}</blockquote>
              ) : null}
            </section>

            <section className="pdf-navigation-card">
              <div className="pdf-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setCurrentPage(Math.max(1, workspace.currentPage - 1))}
                  disabled={workspace.currentPage <= 1}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  上一页
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() =>
                    setCurrentPage(
                      Math.min(workspace.pdfDocument?.pageCount ?? workspace.currentPage, workspace.currentPage + 1),
                    )
                  }
                  disabled={workspace.currentPage >= (workspace.pdfDocument?.pageCount ?? 1)}
                >
                  下一页
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
                <div className="pdf-page-jump">
                  <input
                    className="text-input text-input--small"
                    inputMode="numeric"
                    placeholder="页码"
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        const page = Number(pageInput)
                        if (Number.isFinite(page) && page > 0) {
                          setCurrentPage(Math.min(page, workspace.pdfDocument?.pageCount ?? page))
                          setPageInput('')
                        }
                      }
                    }}
                  />
                  <button
                    className="secondary-button secondary-button--small"
                    type="button"
                    onClick={() => {
                      const page = Number(pageInput)
                      if (!Number.isFinite(page) || page <= 0) {
                        return
                      }

                      setCurrentPage(Math.min(page, workspace.pdfDocument?.pageCount ?? page))
                      setPageInput('')
                    }}
                  >
                    跳转
                  </button>
                </div>
              </div>

              <div className="pdf-section-list" aria-label="PDF 章节导航">
                {workspace.nodes.map((node) => {
                  const isSelected = selectedNode?.id === node.id

                  return (
                    <button
                      key={node.id}
                      className={`pdf-section-item ${isSelected ? 'pdf-section-item--active' : ''}`}
                      type="button"
                      onClick={() => jumpToNodePage(node.id)}
                    >
                      <strong>{node.title}</strong>
                      <span>P.{node.reference?.page ?? '-'}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <div className="pdf-page">
              <div className="pdf-document-shell">
                {pdfError ? <div className="panel-empty-state"><p>{pdfError}</p></div> : null}
                <Document
                  key={workspace.pdfDocument?.path ?? workspace.id}
                  file={{ data: workspace.pdfDocument?.data }}
                  loading={<div className="panel-empty-state"><p>正在加载 PDF 页面…</p></div>}
                  onLoadSuccess={() => setPdfError('')}
                  onLoadError={(error) => setPdfError(error instanceof Error ? `PDF 加载失败：${error.message}` : 'PDF 加载失败。')}
                >
                  <Page pageNumber={workspace.currentPage} width={560} />
                </Document>
              </div>
            </div>
          </>
        ) : (
          <div className="panel-empty-state">
            <div className="panel-empty-state__icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
            </div>
            <h2>当前会话没有 PDF</h2>
            <p>您可以使用主题或笔记生成知识地图；如果在首页导入 PDF，这里会自动联动章节和页码。</p>
          </div>
        )}
      </div>
    </section>
  )
}
