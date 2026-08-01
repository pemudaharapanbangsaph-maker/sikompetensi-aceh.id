import { PrismaClient } from '@prisma/client'

// On Vercel, use /tmp (only writable directory at runtime)
if (process.env.VERCEL) {
  process.env.DATABASE_URL = 'file:/tmp/custom.db'
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
