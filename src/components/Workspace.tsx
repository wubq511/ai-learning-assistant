import { Suspense, lazy } from 'react'
import { useSetAtom } from 'jotai'
import { returnHomeAtom } from '../store/appStore'
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
        <p>{props.description}</p>
      </div>
    </section>
  )
}

export function Workspace() {
  const returnHome = useSetAtom(returnHomeAtom)

  return (
    <main className="workspace-shell">
      <header className="workspace-shell__topbar">
        <div>
          <span className="eyebrow">当前学习会话</span>
          <h1>系统化深度学习工作台</h1>
        </div>
        <button className="ghost-button" type="button" onClick={returnHome}>
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
