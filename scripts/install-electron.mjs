import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const electronBinary = join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe')

if (existsSync(electronBinary)) {
  process.exit(0)
}

const installScript = join(projectRoot, 'node_modules', 'electron', 'install.js')
const result = spawnSync(process.execPath, [installScript], {
  cwd: projectRoot,
  env: {
    ...process.env,
    ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_CUSTOM_DIR: process.env.ELECTRON_CUSTOM_DIR || '{{ version }}',
    electron_config_cache:
      process.env.electron_config_cache || join(projectRoot, '.cache', 'electron'),
  },
  stdio: 'inherit',
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
