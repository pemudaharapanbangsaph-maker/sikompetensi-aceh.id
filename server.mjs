import { createServer } from 'http'
import { parse } from 'url'

const PORT = parseInt(process.env.PORT || '3000', 10)

async function start() {
  const next = (await import('next')).default
  const app = next({ dev: false })
  const handle = app.getRequestHandler()

  await app.prepare()

  createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true)
    handle(req, res, parsedUrl)
  }).listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`)
  })
}

start().catch((err) => {
  console.error('Server error:', err)
  process.exit(1)
})
