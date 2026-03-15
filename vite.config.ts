import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('react-pdf') || id.includes('pdfjs-dist')) {
            return 'vendor_pdf'
          }

          if (id.includes('@xyflow/react')) {
            return 'vendor_flow'
          }

          if (id.includes('react') || id.includes('react-dom') || id.includes('jotai')) {
            return 'vendor_react'
          }

          return 'vendor_misc'
        },
      },
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['electron', 'fs', 'path', 'node:fs', 'node:path', 'node:url', 'node:os', 'os', 'crypto', 'node:crypto', 'dotenv'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['electron', 'fs', 'path', 'node:fs', 'node:path', 'node:url', 'node:os', 'os', 'crypto', 'node:crypto', 'dotenv'],
            },
          },
        },
      },
    }),
  ],
})
