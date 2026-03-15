import { useEffect, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useIngestion } from '../hooks/useIngestion'
import { base64ToUint8Array } from '../services/pdfMetadata'
import { getLearningAssistantBridge } from '../services/learningAssistantBridge'
import { hydratePersistedWorkspace } from '../services/workspacePersistence'
import { screenAtom, setWorkspaceAtom, setWorkspaceHistoryAtom, workspaceHistoryAtom } from '../store/appStore'

export function Home() {
  const { startTopicSession, startNotesSession, startPdfSession } = useIngestion()
  const bridge = getLearningAssistantBridge()
  const workspaceHistory = useAtomValue(workspaceHistoryAtom)
  const setWorkspace = useSetAtom(setWorkspaceAtom)
  const setWorkspaceHistory = useSetAtom(setWorkspaceHistoryAtom)
  const setScreen = useSetAtom(screenAtom)

  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [pdfStatus, setPdfStatus] = useState<string>('未导入 PDF')
  const [apiKey, setApiKey] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [configStatus, setConfigStatus] = useState('正在检查 AI 连接...')
  const [workspaceStatus, setWorkspaceStatus] = useState('')
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [activeWorkspaceAction, setActiveWorkspaceAction] = useState<'restore' | 'delete' | null>(null)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [isTestingConfig, setIsTestingConfig] = useState(false)
  const [hasConfiguredAi, setHasConfiguredAi] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      try {
        const config = await bridge.getConfig()
        if (cancelled) {
          return
        }

        setBaseURL(config.baseURL)
        setModel(config.model)
        setHasConfiguredAi(config.configured)
        setConfigStatus(config.configured ? '已检测到可用密钥，可继续测试连接。' : '尚未配置 API Key。')
      } catch (error) {
        if (!cancelled) {
          setHasConfiguredAi(false)
          setConfigStatus(error instanceof Error ? `配置错误: ${error.message}` : '配置错误')
        }
      }
    }

    void loadConfig()

    return () => {
      cancelled = true
    }
  }, [bridge])

  async function handleOpenPdf() {
    setIsPdfLoading(true)
    setPdfStatus('正在选择 PDF...')

    try {
      const selectedPdf = await bridge.openPdf()
      if (!selectedPdf) {
        setPdfStatus('已取消选择')
        return
      }

      setPdfStatus(`已选择: ${selectedPdf.name}，正在解析...`)
      await startPdfSession(selectedPdf)
      setPdfStatus(`已导入: ${selectedPdf.name}`)
    } catch (error) {
      setPdfStatus(error instanceof Error ? `PDF 解析失败: ${error.message}` : 'PDF 解析失败')
    } finally {
      setIsPdfLoading(false)
    }
  }

  function buildConfigPayload() {
    return {
      apiKey: apiKey.trim() || undefined,
      baseURL: baseURL.trim(),
      model: model.trim() || 'gpt-4o-mini',
    }
  }

  async function handleSaveConfig() {
    setIsSavingConfig(true)
    setConfigStatus('正在保存 AI 配置...')

    try {
      const nextConfig = await bridge.setConfig(buildConfigPayload())

      setApiKey('')
      setBaseURL(nextConfig.baseURL)
      setModel(nextConfig.model)
      setHasConfiguredAi(nextConfig.configured)
      setConfigStatus(nextConfig.configured ? '配置已保存。出于安全原因，密钥不会在界面中回显。' : '配置已保存，但当前仍缺少可用的 API Key。')
    } catch (error) {
      setConfigStatus(error instanceof Error ? `保存失败: ${error.message}` : '保存失败')
    } finally {
      setIsSavingConfig(false)
    }
  }

  async function handleTestConfig() {
    setIsTestingConfig(true)
    setConfigStatus('正在测试 AI 连接...')

    try {
      const result = await bridge.testConfigConnection(buildConfigPayload())
      setHasConfiguredAi(result.configured)
      setBaseURL(result.baseURL)
      setModel(result.model)
      setConfigStatus(result.message)
    } catch (error) {
      setConfigStatus(error instanceof Error ? `连接失败: ${error.message}` : '连接失败')
    } finally {
      setIsTestingConfig(false)
    }
  }

  async function handleRestoreWorkspace(workspaceId: string) {
    setActiveWorkspaceId(workspaceId)
    setActiveWorkspaceAction('restore')
    setWorkspaceStatus('正在恢复工作区...')

    try {
      const persistedWorkspace = await bridge.loadWorkspace(workspaceId)
      if (!persistedWorkspace) {
        setWorkspaceStatus('该工作区不存在，可能已被删除。')
        return
      }

      const hydratedWorkspace = await hydratePersistedWorkspace(
        persistedWorkspace,
        (path) => bridge.readPdfFile(path),
        base64ToUint8Array,
      )

      setWorkspace(hydratedWorkspace)
      setScreen('workspace')
      setWorkspaceStatus('工作区已恢复。')
    } catch (error) {
      setWorkspaceStatus(error instanceof Error ? `恢复失败: ${error.message}` : '恢复失败')
    } finally {
      setActiveWorkspaceId(null)
      setActiveWorkspaceAction(null)
    }
  }

  async function handleDeleteWorkspace(workspaceId: string) {
    setActiveWorkspaceId(workspaceId)
    setActiveWorkspaceAction('delete')
    setWorkspaceStatus('正在删除工作区...')

    try {
      const nextHistory = await bridge.deleteWorkspace(workspaceId)
      setWorkspaceHistory(nextHistory)
      setWorkspaceStatus('已删除该历史工作区。')
    } catch (error) {
      setWorkspaceStatus(error instanceof Error ? `删除失败: ${error.message}` : '删除失败')
    } finally {
      setActiveWorkspaceId(null)
      setActiveWorkspaceAction(null)
    }
  }

  return (
    <main className="home-shell">
      <section className="hero-panel">
        <span className="eyebrow">学习工作台</span>
        <h1>专注深度学习的环境</h1>
        <p className="hero-copy">
          将您的课程资料、PDF 和笔记带入统一空间，AI 将帮助您绘制概念图、提出问题并建立持久的理解。
        </p>
      </section>

      <section className="entry-grid" aria-label="学习切入点">
        <article className="entry-card">
          <div className="entry-card__header">
            <span className="entry-card__badge">主题</span>
            <h2>从概念开始</h2>
          </div>
          <p>从您想要掌握的具体概念开始。我们将生成学习地图来引导您。</p>
          <label className="field-label" htmlFor="topic-input">
            学习主题
          </label>
          <input
            id="topic-input"
            name="topic"
            className="text-input"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="例如：拉格朗日中值定理"
          />
          <button className="primary-button" type="button" onClick={() => startTopicSession(topic)} disabled={!topic.trim()}>
            开始学习会话
          </button>
        </article>

        <article className="entry-card">
          <div className="entry-card__header">
            <span className="entry-card__badge">笔记</span>
            <h2>从课堂笔记中学习</h2>
          </div>
          <p>粘贴您的原始讲义笔记或无结构想法。助手将逻辑地组织它们。</p>
          <label className="field-label" htmlFor="notes-input">
            原始笔记
          </label>
          <textarea
            id="notes-input"
            name="notes"
            className="text-area"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="在此粘贴公式、定义或要点"
          />
          <button className="primary-button" type="button" onClick={() => startNotesSession(notes)} disabled={!notes.trim()}>
            生成知识地图
          </button>
        </article>

        <article className="entry-card">
          <div className="entry-card__header">
            <span className="entry-card__badge">文档</span>
            <h2>阅读并分析 PDF</h2>
          </div>
          <p>导入教科书或幻灯片。工作区会将文档页面链接到映射的知识节点。</p>
          <div className="pdf-status" role="status">
            {pdfStatus}
          </div>
          <button className="secondary-button" type="button" onClick={handleOpenPdf} disabled={isPdfLoading}>
            {isPdfLoading ? '正在导入...' : '浏览 PDF'}
          </button>
        </article>

        <article className="entry-card entry-card--wide entry-card--spaced">
          <div className="entry-card__header">
            <span className="entry-card__badge">设置</span>
            <h2>AI 连接</h2>
          </div>
          <p className="entry-card__supporting-copy">配置您的 OpenAI 兼容 API 以提供讲解动力。已保存的密钥不会在界面中回显。</p>
          <div className="config-grid">
            <div>
              <label className="field-label" htmlFor="api-key-input">API 密钥</label>
              <input
                id="api-key-input"
                className="text-input"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="field-label" htmlFor="base-url-input">API 地址</label>
              <input
                id="base-url-input"
                className="text-input"
                value={baseURL}
                onChange={(event) => setBaseURL(event.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="model-input">模型</label>
              <input
                id="model-input"
                className="text-input"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-4o-mini"
              />
            </div>
          </div>
          <div className="status-row">
            <div className="status-row__meta">
              <span className="pdf-status">{configStatus}</span>
              {hasConfiguredAi ? <span className="page-chip">已存在可用密钥</span> : null}
            </div>
            <div className="status-row__actions">
              <button className="ghost-button" type="button" onClick={handleTestConfig} disabled={isSavingConfig || isTestingConfig}>
                {isTestingConfig ? '测试中...' : '测试连接'}
              </button>
              <button className="secondary-button" type="button" onClick={handleSaveConfig} disabled={isSavingConfig || isTestingConfig}>
                {isSavingConfig ? '保存中...' : '保存连接'}
              </button>
            </div>
          </div>
        </article>

        <article className="entry-card entry-card--wide">
          <div className="entry-card__header">
            <span className="entry-card__badge">历史</span>
            <h2>已保存工作区</h2>
          </div>
          <p>继续之前的学习现场，恢复节点、页码、AI 对话与会话内学习笔记。</p>
          {workspaceStatus ? <div className="pdf-status">{workspaceStatus}</div> : null}
          <div className="workspace-history-list" aria-label="已保存工作区列表">
            {workspaceHistory.length === 0 ? (
              <div className="study-note-list__empty">当前还没有历史工作区。开始一次学习后会自动保存到这里。</div>
            ) : (
              workspaceHistory.map((item) => (
                <article key={item.id} className="workspace-history-card">
                  <div className="workspace-history-card__meta">
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {item.sourceType === 'pdf' ? 'PDF' : item.sourceType === 'notes' ? '笔记' : '主题'}
                        {' · '}
                        {item.nodeCount} 个节点
                        {' · '}
                        {item.noteCount} 条笔记
                      </span>
                    </div>
                    <span className="page-chip">最近节点：{item.selectedNodeTitle}</span>
                  </div>
                  <div className="workspace-history-card__actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => handleRestoreWorkspace(item.id)}
                      disabled={activeWorkspaceId === item.id && activeWorkspaceAction !== null}
                    >
                      {activeWorkspaceId === item.id && activeWorkspaceAction === 'restore' ? '正在打开...' : '打开工作区'}
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => handleDeleteWorkspace(item.id)}
                      disabled={activeWorkspaceId === item.id && activeWorkspaceAction !== null}
                    >
                      {activeWorkspaceId === item.id && activeWorkspaceAction === 'delete' ? '正在删除...' : '删除'}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </main>
  )
}
