import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, join } from 'path'
import { existsSync, readFileSync } from 'fs'

// Custom plugin to serve output files
function serveOutputFiles(): Plugin {
  const outputDir = resolve(__dirname, '../output')

  return {
    name: 'serve-output-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/outputs/')) {
          const filePath = join(outputDir, req.url.replace('/outputs/', ''))

          if (existsSync(filePath)) {
            const content = readFileSync(filePath)

            // Set content type based on extension
            const ext = filePath.split('.').pop()?.toLowerCase()
            const contentTypes: Record<string, string> = {
              html: 'text/html',
              htm: 'text/html',
              css: 'text/css',
              js: 'application/javascript',
              json: 'application/json',
              png: 'image/png',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              gif: 'image/gif',
              svg: 'image/svg+xml',
            }

            res.setHeader('Content-Type', contentTypes[ext || ''] || 'text/plain')
            res.end(content)
            return
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveOutputFiles()],
  server: {
    // Allow serving files from the output directory
    fs: {
      allow: ['..'],
    },
  },
})
