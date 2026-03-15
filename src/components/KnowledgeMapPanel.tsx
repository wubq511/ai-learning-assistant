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
        background: '#ffffff',
        color: '#1e293b',
        border: '1px solid #cbd5e1',
        borderRadius: 4,
        width: 150,
        fontSize: 12,
      },
    }))

    const edges: Edge[] = workspace.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
      style: { stroke: '#94a3b8' },
      labelStyle: { fill: '#64748b', fontSize: 11 },
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
        <p className="empty-copy">还没有生成知识地图。</p>
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
                  <em>
                    联动页码：P.{node.reference.page}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation()
                        jumpToNodePage(node.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          jumpToNodePage(node.id)
                        }
                      }}
                    >
                      {' '}· 跳转
                    </span>
                  </em>
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
              <Background color="#cbd5e1" />
            </ReactFlow>
          </div>
        )}
      </div>
    </aside>
  )
}
