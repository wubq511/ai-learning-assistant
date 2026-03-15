import type { PdfDocumentState, WorkspaceModel, WorkspaceSummary } from '../types/workspace'

type PersistedPdfDocumentState = Omit<PdfDocumentState, 'data'>

export interface PersistedWorkspaceModel extends Omit<WorkspaceModel, 'pdfDocument'> {
  pdfDocument?: PersistedPdfDocumentState
}

function sortSummaries(summaries: WorkspaceSummary[]) {
  return [...summaries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function createWorkspaceSummary(workspace: WorkspaceModel): WorkspaceSummary {
  const selectedNode = workspace.nodes.find((node) => node.id === workspace.selectedNodeId)

  return {
    id: workspace.id,
    title: workspace.title,
    sourceType: workspace.sourceType,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    noteCount: workspace.studyNotes.length,
    nodeCount: workspace.nodes.length,
    selectedNodeTitle: selectedNode?.title ?? workspace.nodes[0]?.title ?? workspace.title,
    hasPdfDocument: Boolean(workspace.pdfDocument),
  }
}

export function toPersistedWorkspace(workspace: WorkspaceModel): PersistedWorkspaceModel {
  return {
    ...workspace,
    pdfDocument: workspace.pdfDocument
      ? {
          name: workspace.pdfDocument.name,
          path: workspace.pdfDocument.path,
          pageCount: workspace.pdfDocument.pageCount,
          sections: workspace.pdfDocument.sections,
        }
      : undefined,
  }
}

export async function hydratePersistedWorkspace(
  persistedWorkspace: PersistedWorkspaceModel,
  readPdfFile: (path: string) => Promise<{ data: string }>,
  base64ToUint8Array: (base64: string) => Uint8Array,
) {
  const hydratedPdf = await hydratePdfDocument(persistedWorkspace.pdfDocument, readPdfFile, base64ToUint8Array)

  return {
    ...persistedWorkspace,
    pdfDocument: hydratedPdf,
  } satisfies WorkspaceModel
}

async function hydratePdfDocument(
  pdfDocument: PersistedWorkspaceModel['pdfDocument'],
  readPdfFile: (path: string) => Promise<{ data: string }>,
  base64ToUint8Array: (base64: string) => Uint8Array,
) {
  if (!pdfDocument) {
    return undefined
  }

  try {
    const encoded = await readPdfFile(pdfDocument.path)
    return {
      ...pdfDocument,
      data: base64ToUint8Array(encoded.data),
    }
  } catch {
    return {
      ...pdfDocument,
      data: undefined,
    }
  }
}

export function mergeWorkspaceSummaries(
  currentSummaries: WorkspaceSummary[],
  nextSummary: WorkspaceSummary,
): WorkspaceSummary[] {
  const filtered = currentSummaries.filter((summary) => summary.id !== nextSummary.id)
  return sortSummaries([nextSummary, ...filtered])
}

export function normalizeWorkspaceSummaries(summaries: WorkspaceSummary[]) {
  return sortSummaries(summaries)
}
