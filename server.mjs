import { createServer } from 'http'
import { parse } from 'url'
import { existsSync, statSync, createReadStream } from 'fs'
import { join } from 'path'

const PORT = parseInt(process.env.PORT || '3000', 10)

async function start() {
  const next = (await import('next')).default
  const app = next({ dev: false })
  const handle = app.getRequestHandler()
  await app.prepare()

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    const pathname = parsedUrl.pathname || '/'

    if (pathname.startsWith('/_next/static/')) {
      const filePath = join(process.cwd(), '.next', pathname)
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = filePath.split('.').pop().toLowerCase()
        const types = {
          js: 'application/javascript',
          css: 'text/css',
          png: 'image/png',
          jpg: 'image/jpeg',
          svg: 'image/svg+xml',
          woff: 'font/woff',
          woff2: 'font/woff2',
          ico: 'image/x-icon',
        }
        res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        createReadStream(filePath).pipe(res)
        return
      }
    }

    handle(req, res, parsedUrl)
  }).listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`)
  })
}

start().catch(err => {
  console.error('Server error:', err)
  process.exit(1)
})
