import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { getLearningAssistantBridge } from '../services/learningAssistantBridge'
import { workspaceAtom, workspaceHistoryAtom, setWorkspaceHistoryAtom } from '../store/appStore'
import { toPersistedWorkspace } from '../services/workspacePersistence'

const SAVE_DELAY_MS = 500

export function useWorkspacePersistence() {
  const workspace = useAtomValue(workspaceAtom)
  const workspaceHistory = useAtomValue(workspaceHistoryAtom)
  const setWorkspaceHistory = useSetAtom(setWorkspaceHistoryAtom)

  useEffect(() => {
    let cancelled = false

    async function loadWorkspaceHistory() {
      const history = await getLearningAssistantBridge().listWorkspaces()
      if (!cancelled) {
        setWorkspaceHistory(history)
      }
    }

    void loadWorkspaceHistory()

    return () => {
      cancelled = true
    }
  }, [setWorkspaceHistory])

  useEffect(() => {
    if (!workspace) {
      return
    }

    const timeoutId = window.setTimeout(async () => {
      const nextHistory = await getLearningAssistantBridge().saveWorkspace(toPersistedWorkspace(workspace))
      const currentIds = workspaceHistory.map((item) => item.id).join('|')
      const nextIds = nextHistory.map((item) => item.id).join('|')

      if (currentIds !== nextIds || nextHistory[0]?.updatedAt !== workspaceHistory[0]?.updatedAt) {
        setWorkspaceHistory(nextHistory)
      }
    }, SAVE_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [setWorkspaceHistory, workspace, workspaceHistory])
}
