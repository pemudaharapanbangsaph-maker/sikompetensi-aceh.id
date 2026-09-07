import http from 'node:http'
import next from 'next'
import { parse } from 'node:url'

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = Number(process.env.PORT || 3000)

const app = next({ dev })
const handle = app.getRequestHandler()

let server

async function startServer() {
  try {
    await app.prepare()

    server = http.createServer((req, res) => {
      const parsedUrl = parse(req.url || '/', true)

      handle(req, res, parsedUrl).catch((error) => {
        console.error('Request error:', error)

        if (!res.headersSent) {
          res.statusCode = 500
          res.end('Internal Server Error')
        } else {
          res.destroy()
        }
      })
    })

    server.on('error', (error) => {
      console.error('Server error:', error)

      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} sedang digunakan`)
        process.exit(1)
      }
    })

    server.listen(port, hostname, () => {
      console.log(`Next.js server berjalan di port ${port}`)
    })
  } catch (error) {
    console.error('Gagal menjalankan Next.js:', error)
    process.exit(1)
  }
}

function shutdown(signal) {
  console.log(`${signal} diterima, menghentikan server...`)

  if (!server) process.exit(0)

  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

startServer()
