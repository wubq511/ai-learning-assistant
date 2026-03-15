import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'

export interface AppConfig {
  apiKey: string
  baseURL: string
  model: string
}

function pickString(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const DEFAULT_CONFIG: AppConfig = {
  apiKey: '',
  baseURL: '',
  model: 'gpt-4o-mini',
}

function getConfigPath() {
  return join(app.getPath('userData'), 'config.json')
}

export async function readAppConfig(): Promise<AppConfig> {
  try {
    const fileContent = await readFile(getConfigPath(), 'utf8')
    const parsed = JSON.parse(fileContent) as Partial<AppConfig>

    return {
      apiKey: parsed.apiKey ?? DEFAULT_CONFIG.apiKey,
      baseURL: parsed.baseURL ?? DEFAULT_CONFIG.baseURL,
      model: parsed.model ?? DEFAULT_CONFIG.model,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function writeAppConfig(nextConfig: Partial<AppConfig>): Promise<AppConfig> {
  const currentConfig = await readAppConfig()
  const mergedConfig: AppConfig = {
    apiKey: nextConfig.apiKey ?? currentConfig.apiKey,
    baseURL: nextConfig.baseURL ?? currentConfig.baseURL,
    model: nextConfig.model ?? currentConfig.model,
  }

  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(getConfigPath(), JSON.stringify(mergedConfig, null, 2), 'utf8')

  return mergedConfig
}

export async function resolveAiConfig(override?: Partial<AppConfig>) {
  const storedConfig = await readAppConfig()
  const apiKey = pickString(override?.apiKey) ?? process.env.OPENAI_API_KEY ?? storedConfig.apiKey
  const baseURL = pickString(override?.baseURL) ?? process.env.OPENAI_BASE_URL ?? storedConfig.baseURL
  const model = pickString(override?.model) ?? process.env.OPENAI_MODEL ?? storedConfig.model

  return {
    apiKey,
    baseURL,
    model,
    configured: Boolean(apiKey),
  }
}
