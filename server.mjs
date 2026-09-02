import http from 'node:http'
import next from 'next'
import { parse } from 'node:url'

const dev = false
const hostname = '0.0.0.0'
const port = Number(process.env.PORT || 3000)

const app = next({
  dev,
  hostname,
  port,
})

const handle = app.getRequestHandler()

let server

async function startServer() {
  try {
    await app.prepare()

    server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url || '/', true)
        await handle(req, res, parsedUrl)
      } catch (error) {
        console.error('Request error:', error)

        if (!res.headersSent) {
          res.statusCode = 500
          res.end('Internal Server Error')
        } else {
          res.destroy()
        }
      }
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

  if (!server) {
    process.exit(0)
  }

  server.close((error) => {
    if (error) {
      console.error('Gagal menghentikan server:', error)
      process.exit(1)
    }

    console.log('Server berhasil dihentikan')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

startServer()
