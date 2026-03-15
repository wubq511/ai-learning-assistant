import dotenv from 'dotenv'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI from 'openai'
import { readAppConfig, resolveAiConfig, writeAppConfig } from './config'
import { deleteWorkspaceSnapshot, listWorkspaceSummaries, loadWorkspaceSnapshot, saveWorkspaceSnapshot } from './workspaces'
import { getMainWindowOptions, getRendererEntry } from './windowConfig'
import type { PersistedWorkspaceModel } from '../src/services/workspacePersistence'

const __dirname = dirname(fileURLToPath(import.meta.url))
const aiStreamControllers = new Map<string, AbortController>()

dotenv.config()

function buildExplainMessages(payload: {
  title: string
  summary: string
  sourceText: string
  question?: string
}) {
  const compactSourceText = payload.sourceText.slice(0, 6000)

  return [
    {
      role: 'system' as const,
      content:
        '你是一位理工科 AI 老师。回答必须使用中文，并按以下结构输出：一、概念讲解；二、一个追问提示；三、一句总结。回答要准确、克制、适合学习助手。',
    },
    {
      role: 'user' as const,
      content: `主题：${payload.title}\n节点摘要：${payload.summary}\n参考内容：${compactSourceText}\n用户追问：${payload.question ?? '请先根据当前节点自动讲解。'}`,
    },
  ]
}

async function verifyAiConnection(payload?: {
  apiKey?: string
  baseURL?: string
  model?: string
}) {
  const aiConfig = await resolveAiConfig(payload)
  if (!aiConfig.apiKey) {
    return {
      connected: false,
      configured: false,
      baseURL: aiConfig.baseURL,
      model: aiConfig.model,
      message: '缺少 API Key，请先输入并保存或直接测试当前配置。',
    }
  }

  const client = new OpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.baseURL || undefined,
  })

  try {
    await client.chat.completions.create({
      model: aiConfig.model,
      messages: [
        {
          role: 'user',
          content: '请仅回复“ok”。',
        },
      ],
      max_tokens: 4,
    })

    return {
      connected: true,
      configured: true,
      baseURL: aiConfig.baseURL,
      model: aiConfig.model,
      message: '连接测试成功，当前模型可用。',
    }
  } catch (error) {
    return {
      connected: false,
      configured: true,
      baseURL: aiConfig.baseURL,
      model: aiConfig.model,
      message: error instanceof Error ? error.message : '连接测试失败。',
    }
  }
}

function registerIpcHandlers() {
  ipcMain.handle('app:get-info', () => ({
    name: '人工智能学习助手',
    version: app.getVersion(),
    platform: process.platform,
  }))

  ipcMain.handle('config:get', async () => {
    const config = await readAppConfig()
    const aiConfig = await resolveAiConfig()

    return {
      apiKey: '',
      baseURL: config.baseURL,
      model: config.model,
      configured: aiConfig.configured,
    }
  })

  ipcMain.handle(
    'config:set',
    async (
      _event,
      payload: {
        apiKey?: string
        baseURL?: string
        model?: string
      },
    ) => {
      const nextConfig = await writeAppConfig(payload)
      const aiConfig = await resolveAiConfig()

      return {
        apiKey: '',
        baseURL: nextConfig.baseURL,
        model: nextConfig.model,
        configured: aiConfig.configured,
      }
    },
  )

  ipcMain.handle(
    'config:test-connection',
    async (
      _event,
      payload: {
        apiKey?: string
        baseURL?: string
        model?: string
      },
    ) => verifyAiConnection(payload),
  )

  ipcMain.handle('dialog:open-pdf', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择 PDF 讲义',
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return {
      path: result.filePaths[0],
      name: result.filePaths[0].split(/[\\/]/).pop() ?? 'lecture.pdf',
    }
  })

  ipcMain.handle('pdf:read-file', async (_event, path: string) => {
    const fileBuffer = await readFile(path)

    return {
      data: fileBuffer.toString('base64'),
    }
  })

  ipcMain.handle('workspace:list', async () => listWorkspaceSummaries())

  ipcMain.handle('workspace:save', async (_event, workspace: PersistedWorkspaceModel) => {
    return saveWorkspaceSnapshot(workspace)
  })

  ipcMain.handle('workspace:load', async (_event, workspaceId: string) => {
    return loadWorkspaceSnapshot(workspaceId)
  })

  ipcMain.handle('workspace:delete', async (_event, workspaceId: string) => {
    return deleteWorkspaceSnapshot(workspaceId)
  })

  ipcMain.handle(
    'ai:explain-node',
    async (
      _event,
      payload: {
        title: string
        summary: string
        sourceText: string
        question?: string
      },
    ) => {
      const aiConfig = await resolveAiConfig()
      if (!aiConfig.apiKey) {
        throw new Error('缺少 OPENAI_API_KEY，无法调用真实 AI 接口。')
      }

      const client = new OpenAI({
        apiKey: aiConfig.apiKey,
        baseURL: aiConfig.baseURL || undefined,
      })

      try {
        const completion = await client.chat.completions.create({
          model: aiConfig.model,
          messages: buildExplainMessages(payload),
        })

        return {
          content: completion.choices[0]?.message?.content?.trim() ?? '模型没有返回内容。',
        }
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'OpenAI 请求失败。')
      }
    },
  )

  ipcMain.handle(
    'ai:stream-explain-node',
    async (
      event,
      payload: {
        requestId: string
        title: string
        summary: string
        sourceText: string
        question?: string
      },
    ) => {
      const aiConfig = await resolveAiConfig()
      if (!aiConfig.apiKey) {
        throw new Error('缺少 OPENAI_API_KEY，无法调用真实 AI 接口。')
      }

      const sender = event.sender
      const controller = new AbortController()
      aiStreamControllers.set(payload.requestId, controller)

      const client = new OpenAI({
        apiKey: aiConfig.apiKey,
        baseURL: aiConfig.baseURL || undefined,
      })

      void (async () => {
        let accumulatedContent = ''

        try {
          const stream = await client.chat.completions.create(
            {
              model: aiConfig.model,
              messages: buildExplainMessages(payload),
              stream: true,
            },
            { signal: controller.signal },
          )

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? ''
            if (!delta) {
              continue
            }

            accumulatedContent += delta
            sender.send('ai:stream-event', {
              requestId: payload.requestId,
              type: 'delta',
              delta,
              content: accumulatedContent,
            })
          }

          sender.send('ai:stream-event', {
            requestId: payload.requestId,
            type: 'done',
            content: accumulatedContent,
          })
        } catch (error) {
          sender.send('ai:stream-event', {
            requestId: payload.requestId,
            type: 'error',
            error: controller.signal.aborted
              ? '已取消当前 AI 回复。'
              : error instanceof Error
                ? error.message
                : 'OpenAI 请求失败。',
          })
        } finally {
          aiStreamControllers.delete(payload.requestId)
        }
      })()

      return { started: true }
    },
  )

  ipcMain.handle('ai:stream-cancel', async (_event, requestId: string) => {
    const controller = aiStreamControllers.get(requestId)
    if (controller) {
      controller.abort()
      aiStreamControllers.delete(requestId)
    }

    return {
      cancelled: Boolean(controller),
    }
  })
}

async function createWindow() {
  const preloadPath = join(__dirname, 'preload.mjs')
  const window = new BrowserWindow(getMainWindowOptions(preloadPath))
  const rendererEntry = getRendererEntry(process.env.VITE_DEV_SERVER_URL)

  if (rendererEntry.mode === 'url') {
    await window.loadURL(rendererEntry.target)
  } else {
    await window.loadFile(rendererEntry.target)
  }
}

app.whenReady().then(async () => {
  registerIpcHandlers()
  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
