import { useEffect, useState } from 'react'
import { useIngestion } from '../hooks/useIngestion'
import { getLearningAssistantBridge } from '../services/learningAssistantBridge'

export function Home() {
  const { startTopicSession, startNotesSession, startPdfSession } = useIngestion()
  const bridge = getLearningAssistantBridge()

  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [pdfStatus, setPdfStatus] = useState<string>('未导入 PDF')
  const [apiKey, setApiKey] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [configStatus, setConfigStatus] = useState('正在检查 AI 连接...')

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      try {
        const config = await bridge.getConfig()
        if (cancelled) {
          return
        }

        setApiKey(config.apiKey)
        setBaseURL(config.baseURL)
        setModel(config.model)
        setConfigStatus(config.configured ? 'AI 接口已连接' : '缺少 API Key')
      } catch (error) {
        if (!cancelled) {
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
    const selectedPdf = await bridge.openPdf()
    if (!selectedPdf) {
      setPdfStatus('已取消选择')
      return
    }

    setPdfStatus(`已选择: ${selectedPdf.name}`)

    try {
      await startPdfSession(selectedPdf)
    } catch (error) {
      setPdfStatus(error instanceof Error ? `PDF 解析失败: ${error.message}` : 'PDF 解析失败')
    }
  }

  async function handleSaveConfig() {
    setConfigStatus('正在保存 AI 配置...')

    try {
      const nextConfig = await bridge.setConfig({
        apiKey: apiKey.trim() || undefined,
        baseURL: baseURL.trim(),
        model: model.trim() || 'gpt-4o-mini',
      })

      setApiKey('')
      setBaseURL(nextConfig.baseURL)
      setModel(nextConfig.model)
      setConfigStatus(nextConfig.configured ? '配置已保存' : '已保存，但缺少 API Key')
    } catch (error) {
      setConfigStatus(error instanceof Error ? `保存失败: ${error.message}` : '保存失败')
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
          <button className="primary-button" type="button" onClick={() => startTopicSession(topic)}>
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
          <button className="primary-button" type="button" onClick={() => startNotesSession(notes)}>
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
          <button className="secondary-button" type="button" onClick={handleOpenPdf}>
            浏览 PDF
          </button>
        </article>

        <article className="entry-card" style={{ gridColumn: '1 / -1' }}>
          <div className="entry-card__header">
            <span className="entry-card__badge">设置</span>
            <h2>AI 连接</h2>
          </div>
          <p style={{ marginBottom: '1rem' }}>配置您的 OpenAI 兼容 API 以提供讲解动力。</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
            <span className="pdf-status">{configStatus}</span>
            <button className="secondary-button" type="button" onClick={handleSaveConfig}>
              保存连接
            </button>
          </div>
        </article>
      </section>
    </main>
  )
}
