export {}

import type { PersistedWorkspaceModel } from '../services/workspacePersistence'
import type { WorkspaceSummary } from './workspace'

declare global {
  interface Window {
    learningAssistant: {
      getAppInfo: () => Promise<{
        name: string
        version: string
        platform: string
      }>
      getConfig: () => Promise<{
        apiKey: string
        baseURL: string
        model: string
        configured: boolean
      }>
      setConfig: (payload: { apiKey?: string; baseURL?: string; model?: string }) => Promise<{
        apiKey: string
        baseURL: string
        model: string
        configured: boolean
      }>
      testConfigConnection: (payload: { apiKey?: string; baseURL?: string; model?: string }) => Promise<{
        connected: boolean
        configured: boolean
        baseURL: string
        model: string
        message: string
      }>
      openPdf: () => Promise<{
        path: string
        name: string
      } | null>
      readPdfFile: (path: string) => Promise<{
        data: string
      }>
      listWorkspaces: () => Promise<WorkspaceSummary[]>
      saveWorkspace: (workspace: PersistedWorkspaceModel) => Promise<WorkspaceSummary[]>
      loadWorkspace: (workspaceId: string) => Promise<PersistedWorkspaceModel | null>
      deleteWorkspace: (workspaceId: string) => Promise<WorkspaceSummary[]>
      streamExplainNode: (payload: {
        requestId: string
        title: string
        summary: string
        sourceText: string
        question?: string
      }) => Promise<{
        started: boolean
      }>
      cancelExplainNodeStream: (requestId: string) => Promise<{
        cancelled: boolean
      }>
      onExplainNodeStreamEvent: (
        callback: (event: {
          requestId: string
          type: 'delta' | 'done' | 'error'
          delta?: string
          content?: string
          error?: string
        }) => void,
      ) => () => void
      explainNode: (payload: { title: string; summary: string; sourceText: string; question?: string }) => Promise<{
        content: string
      }>
    }
  }
}
