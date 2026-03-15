import { Suspense, lazy } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { returnHomeAtom, workspaceAtom } from '../store/appStore'
import { AiPanel } from './AiPanel'

const KnowledgeMapPanel = lazy(async () => {
  const module = await import('./KnowledgeMapPanel')
  return { default: module.KnowledgeMapPanel }
})

const PdfPanel = lazy(async () => {
  const module = await import('./PdfPanel')
  return { default: module.PdfPanel }
})

function WorkspacePanelFallback(props: {
  sectionClassName: string
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <section className={`workspace-panel ${props.sectionClassName}`}>
      <header className="workspace-panel__header">
        <div>
          <span className="eyebrow">{props.eyebrow}</span>
          <h2>{props.title}</h2>
        </div>
      </header>
      <div className="panel-empty-state">
        <div className="panel-empty-state__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2>{props.title}</h2>
        <p>{props.description}</p>
      </div>
    </section>
  )
}

export function Workspace() {
  const returnHome = useSetAtom(returnHomeAtom)
  const workspace = useAtomValue(workspaceAtom)

  return (
    <main className="workspace-shell">
      <header className="workspace-shell__topbar">
        <div>
          <span className="eyebrow">
            {workspace ? (workspace.sourceType === 'pdf' ? 'PDF 学习会话' : workspace.sourceType === 'notes' ? '笔记学习会话' : '主题学习会话') : '当前学习会话'}
          </span>
          <h1>{workspace?.title || '系统化深度学习工作台'}</h1>
        </div>
        <button className="ghost-button" type="button" onClick={returnHome}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          退出工作台
        </button>
      </header>

      <div className="workspace-grid">
        <Suspense
          fallback={
            <WorkspacePanelFallback
              sectionClassName="workspace-panel--map"
              eyebrow="知识地图"
              title="层级图"
              description="正在装载结构视图与关系图…"
            />
          }
        >
          <KnowledgeMapPanel />
        </Suspense>
        <Suspense
          fallback={
            <WorkspacePanelFallback
              sectionClassName="workspace-panel--pdf"
              eyebrow="PDF 阅读区"
              title="PDF 阅读器"
              description="正在装载文档阅读器…"
            />
          }
        >
          <PdfPanel />
        </Suspense>
        <AiPanel />
      </div>
    </main>
  )
}
