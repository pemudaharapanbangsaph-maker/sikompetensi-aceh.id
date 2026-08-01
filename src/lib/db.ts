import { PrismaClient } from '@prisma/client'
import { mkdirSync, existsSync } from 'fs'
import path from 'path'

// Resolve and normalize the database path
function resolveDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  const match = dbUrl.match(/file:(.+)/)
  let dbPath = match ? match[1] : './db/custom.db'
  if (dbPath.startsWith('./')) {
    dbPath = path.join(process.cwd(), dbPath.substring(2))
  }
  return dbPath
}

// On Vercel, use /tmp (only writable directory at runtime)
if (process.env.VERCEL) {
  process.env.DATABASE_URL = 'file:/tmp/custom.db'
}

// Ensure db directory exists and set absolute DATABASE_URL
const absDbPath = resolveDbPath()
const dbDir = path.dirname(absDbPath)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}
// Override DATABASE_URL with absolute path so Prisma always finds it
process.env.DATABASE_URL = `file:${absDbPath}`

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
