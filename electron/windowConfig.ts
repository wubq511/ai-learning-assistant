import { join } from 'node:path'

export const APP_MIN_WIDTH = 1280
export const APP_MIN_HEIGHT = 800

export function getRendererEntry(devServerUrl?: string): {
  mode: 'url' | 'file'
  target: string
} {
  if (devServerUrl) {
    return {
      mode: 'url',
      target: devServerUrl,
    }
  }

  return {
    mode: 'file',
    target: join(process.cwd(), 'dist', 'index.html'),
  }
}

export function getMainWindowOptions(preloadPath: string) {
  return {
    width: 1440,
    height: 920,
    minWidth: APP_MIN_WIDTH,
    minHeight: APP_MIN_HEIGHT,
    backgroundColor: '#f3f1ec',
    titleBarStyle: 'hiddenInset' as const,
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }
}
