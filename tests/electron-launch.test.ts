import { describe, expect, it } from 'vitest'
import { APP_MIN_HEIGHT, APP_MIN_WIDTH, getMainWindowOptions, getRendererEntry } from '../electron/windowConfig'

describe('electron window scaffold', () => {
  it('prefers the Vite dev server during development', () => {
    const rendererEntry = getRendererEntry('http://localhost:5173')

    expect(rendererEntry).toEqual({
      mode: 'url',
      target: 'http://localhost:5173',
    })
  })

  it('falls back to the built index.html in production', () => {
    const rendererEntry = getRendererEntry()

    expect(rendererEntry.mode).toBe('file')
    expect(rendererEntry.target).toContain('dist')
    expect(rendererEntry.target).toContain('index.html')
  })

  it('creates a secure BrowserWindow configuration', () => {
    const options = getMainWindowOptions('C:/preload.mjs')

    expect(options.minWidth).toBe(APP_MIN_WIDTH)
    expect(options.minHeight).toBe(APP_MIN_HEIGHT)
    expect(options.webPreferences.preload).toBe('C:/preload.mjs')
    expect(options.webPreferences.contextIsolation).toBe(true)
    expect(options.webPreferences.nodeIntegration).toBe(false)
  })
})
