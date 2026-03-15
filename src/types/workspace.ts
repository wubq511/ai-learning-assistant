export type SourceType = 'topic' | 'notes' | 'pdf'

export type KnowledgeMapMode = 'hierarchy' | 'relationship'

export interface SourceReference {
  page?: number
  chapterTitle?: string
  excerpt?: string
}

export type ConversationRole = 'user' | 'assistant'

export type ConversationStatus = 'idle' | 'loading' | 'error'

export interface ConversationMessage {
  id: string
  role: ConversationRole
  content: string
  createdAt: string
}

export interface ConversationThread {
  nodeId: string
  status: ConversationStatus
  error: string
  messages: ConversationMessage[]
}

export interface StudyNote {
  id: string
  nodeId: string
  title: string
  content: string
  createdAt: string
  source: 'assistant' | 'manual'
  page?: number
}

export interface KnowledgeNode {
  id: string
  title: string
  summary: string
  depth: number
  reference?: SourceReference
}

export interface KnowledgeEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface PdfSection {
  id: string
  title: string
  page: number
  excerpt: string
  level?: number
}

export interface PdfDocumentState {
  name: string
  path: string
  data?: Uint8Array
  pageCount: number
  sections: PdfSection[]
}

export interface WorkspaceModel {
  id: string
  createdAt: string
  updatedAt: string
  sourceType: SourceType
  title: string
  sourceText: string
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  selectedNodeId: string
  currentPage: number
  conversations: Record<string, ConversationThread>
  studyNotes: StudyNote[]
  pdfDocument?: PdfDocumentState
}

export interface WorkspaceSummary {
  id: string
  title: string
  sourceType: SourceType
  createdAt: string
  updatedAt: string
  noteCount: number
  nodeCount: number
  selectedNodeTitle: string
  hasPdfDocument: boolean
}

export interface TopicIngestionInput {
  sourceType: 'topic'
  title: string
  sourceText: string
}

export interface NotesIngestionInput {
  sourceType: 'notes'
  title: string
  sourceText: string
}

export interface PdfIngestionInput {
  sourceType: 'pdf'
  title: string
  sourceText: string
  pdfDocument: PdfDocumentState
}

export type IngestionInput = TopicIngestionInput | NotesIngestionInput | PdfIngestionInput
