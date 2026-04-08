import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const SYNC_FILE = path.resolve(__dirname, 'sync-state.json')

function syncMiddlewarePlugin() {
  return {
    name: 'sync-state',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/sync', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method === 'GET') {
          if (!fs.existsSync(SYNC_FILE)) {
            res.statusCode = 404
            res.end()
            return
          }
          const data = fs.readFileSync(SYNC_FILE, 'utf-8')
          res.setHeader('Content-Type', 'application/json')
          res.end(data)
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              JSON.parse(body) // validate it's parseable before writing
              fs.writeFileSync(SYNC_FILE, body, 'utf-8')
              res.statusCode = 204
              res.end()
            } catch {
              res.statusCode = 400
              res.end()
            }
          })
          return
        }

        res.statusCode = 405
        res.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), syncMiddlewarePlugin()],
  base: './',
})