import { useAtomValue, useSetAtom } from 'jotai'
import { Suspense, lazy, useEffect } from 'react'
import { Home } from './components/Home'
import { useWorkspacePersistence } from './hooks/useWorkspacePersistence'
import { getLearningAssistantBridge } from './services/learningAssistantBridge'
import { appInfoAtom, screenAtom } from './store/appStore'

const Workspace = lazy(async () => {
  const module = await import('./components/Workspace')
  return { default: module.Workspace }
})

function App() {
  const screen = useAtomValue(screenAtom)
  const appInfo = useAtomValue(appInfoAtom)
  const setAppInfo = useSetAtom(appInfoAtom)

  useWorkspacePersistence()

  useEffect(() => {
    let cancelled = false
    const bridge = getLearningAssistantBridge()

    bridge.getAppInfo().then((nextInfo) => {
      if (!cancelled) {
        setAppInfo(nextInfo)
      }
    })

    return () => {
      cancelled = true
    }
  }, [setAppInfo])

  return (
    <div className="app-shell">
      <div className="window-chrome" data-drag-region>
        <div>
          <strong>{appInfo?.name ?? 'AI 学习助手'}</strong>
          <span style={{ opacity: 0.5 }}>/</span>
          <span>学习工作台</span>
        </div>
        <span>{appInfo ? `v${appInfo.version}` : '正在连接...'}</span>
      </div>
      {screen === 'home' ? (
        <Home />
      ) : (
        <Suspense
          fallback={
            <main className="workspace-shell">
              <div className="panel-empty-state">
                <h2>正在加载工作区</h2>
                <p>准备您的学习环境...</p>
              </div>
            </main>
          }
        >
          <Workspace />
        </Suspense>
      )}
    </div>
  )
}

export default App
