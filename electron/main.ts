import dotenv from 'dotenv'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI from 'openai'
import { readAppConfig, resolveAiConfig, writeAppConfig } from './config'
import { getMainWindowOptions, getRendererEntry } from './windowConfig'

const __dirname = dirname(fileURLToPath(import.meta.url))

dotenv.config()

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

      const compactSourceText = payload.sourceText.slice(0, 6000)
      const client = new OpenAI({
        apiKey: aiConfig.apiKey,
        baseURL: aiConfig.baseURL || undefined,
      })

      try {
        const completion = await client.chat.completions.create({
          model: aiConfig.model,
          messages: [
            {
              role: 'system',
              content:
                '你是一位理工科 AI 老师。回答必须使用中文，并按以下结构输出：一、概念讲解；二、一个追问提示；三、一句总结。回答要准确、克制、适合学习助手。',
            },
            {
              role: 'user',
              content: `主题：${payload.title}\n节点摘要：${payload.summary}\n参考内容：${compactSourceText}\n用户追问：${payload.question ?? '请先根据当前节点自动讲解。'}`,
            },
          ],
        })

        return {
          content: completion.choices[0]?.message?.content?.trim() ?? '模型没有返回内容。',
        }
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'OpenAI 请求失败。')
      }
    },
  )
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
