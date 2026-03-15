import { useMemo } from 'react'
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  jumpToNodePageAtom,
  knowledgeMapModeAtom,
  selectedNodeAtom,
  toggleKnowledgeMapModeAtom,
  workspaceAtom,
  selectNodeAtom,
} from '../store/appStore'

function useFlowState() {
  const workspace = useAtomValue(workspaceAtom)

  return useMemo(() => {
    if (!workspace) {
      return { nodes: [] as Node[], edges: [] as Edge[] }
    }

    const nodes: Node[] = workspace.nodes.map((node, index) => ({
      id: node.id,
      position: { x: node.depth * 180, y: index * 110 },
      data: { label: node.title },
      style: {
        background: 'var(--bg-panel)',
        color: 'var(--text-main)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        width: 160,
        fontSize: 12,
        boxShadow: 'var(--shadow-sm)',
      },
    }))

    const edges: Edge[] = workspace.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
      style: { stroke: 'var(--text-muted)' },
      labelStyle: { fill: 'var(--text-muted)', fontSize: 11 },
    }))

    return { nodes, edges }
  }, [workspace])
}

export function KnowledgeMapPanel() {
  const workspace = useAtomValue(workspaceAtom)
  const selectedNode = useAtomValue(selectedNodeAtom)
  const mapMode = useAtomValue(knowledgeMapModeAtom)
  const toggleMapMode = useSetAtom(toggleKnowledgeMapModeAtom)
  const selectNode = useSetAtom(selectNodeAtom)
  const jumpToNodePage = useSetAtom(jumpToNodePageAtom)
  const flowState = useFlowState()

  if (!workspace) {
    return (
      <aside className="workspace-panel workspace-panel--map">
        <div className="panel-empty-state">
          <div className="panel-empty-state__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </div>
          <h2>知识地图</h2>
          <p>还没有生成知识地图。请从首页开始一个新的学习会话。</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="workspace-panel workspace-panel--map">
      <header className="workspace-panel__header">
        <div>
          <span className="eyebrow">知识地图</span>
          <h2>{mapMode === 'hierarchy' ? '层级图' : '关系概览'}</h2>
        </div>
        <button className="ghost-button" type="button" onClick={toggleMapMode}>
          切换到{mapMode === 'hierarchy' ? '关系图' : '层级图'}
        </button>
      </header>

      <div className="map-body">
        {mapMode === 'hierarchy' ? (
          workspace.nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id

            return (
              <button
                key={node.id}
                className={`map-node ${isSelected ? 'map-node--selected' : ''}`}
                type="button"
                onClick={() => selectNode(node.id)}
              >
                <span className="map-node__depth">层级 {node.depth}</span>
                <strong>{node.title}</strong>
                <span>{node.summary}</span>
                {node.reference?.page ? (
                  <div className="map-node__footer">
                    <em>联动页码：P.{node.reference.page}</em>
                    <button
                      className="map-node__jump"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        jumpToNodePage(node.id)
                      }}
                    >
                      查看原页
                    </button>
                  </div>
                ) : null}
              </button>
            )
          })
        ) : (
          <div className="flow-shell">
            <ReactFlow
              nodes={flowState.nodes}
              edges={flowState.edges}
              fitView
              onNodeClick={(_event, node) => selectNode(node.id)}
            >
              <MiniMap pannable zoomable />
              <Controls />
              <Background color="var(--border-color)" />
            </ReactFlow>
          </div>
        )}
      </div>
    </aside>
  )
}
