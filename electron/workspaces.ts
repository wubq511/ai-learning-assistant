import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { WorkspaceSummary } from '../src/types/workspace'
import {
  createWorkspaceSummary,
  normalizeWorkspaceSummaries,
  type PersistedWorkspaceModel,
} from '../src/services/workspacePersistence'

interface WorkspaceStoreShape {
  workspaces: PersistedWorkspaceModel[]
}

const DEFAULT_STORE: WorkspaceStoreShape = {
  workspaces: [],
}

function getWorkspaceStorePath() {
  return join(app.getPath('userData'), 'workspaces.json')
}

async function readWorkspaceStore(): Promise<WorkspaceStoreShape> {
  try {
    const content = await readFile(getWorkspaceStorePath(), 'utf8')
    const parsed = JSON.parse(content) as Partial<WorkspaceStoreShape>
    return {
      workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
    }
  } catch {
    return DEFAULT_STORE
  }
}

async function writeWorkspaceStore(store: WorkspaceStoreShape) {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(getWorkspaceStorePath(), JSON.stringify(store, null, 2), 'utf8')
}

function toSummaries(workspaces: PersistedWorkspaceModel[]): WorkspaceSummary[] {
  return normalizeWorkspaceSummaries(workspaces.map((workspace) => createWorkspaceSummary(workspace)))
}

export async function listWorkspaceSummaries() {
  const store = await readWorkspaceStore()
  return toSummaries(store.workspaces)
}

export async function saveWorkspaceSnapshot(workspace: PersistedWorkspaceModel) {
  const store = await readWorkspaceStore()
  const filtered = store.workspaces.filter((item) => item.id !== workspace.id)
  const nextStore: WorkspaceStoreShape = {
    workspaces: [workspace, ...filtered].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  }

  await writeWorkspaceStore(nextStore)

  return toSummaries(nextStore.workspaces)
}

export async function loadWorkspaceSnapshot(workspaceId: string) {
  const store = await readWorkspaceStore()
  return store.workspaces.find((workspace) => workspace.id === workspaceId) ?? null
}

export async function deleteWorkspaceSnapshot(workspaceId: string) {
  const store = await readWorkspaceStore()
  const nextStore: WorkspaceStoreShape = {
    workspaces: store.workspaces.filter((workspace) => workspace.id !== workspaceId),
  }

  await writeWorkspaceStore(nextStore)

  return toSummaries(nextStore.workspaces)
}
