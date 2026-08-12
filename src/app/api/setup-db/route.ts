import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  const match = dbUrl.match(/file:(.+)/)
  let dbPath = match ? match[1] : './db/custom.db'
  if (dbPath.startsWith('./')) {
    dbPath = path.join(process.cwd(), dbPath.substring(2))
  }
  return dbPath
}

export async function GET() {
  const dbPath = getDbPath()
  const results: string[] = []

  try {
    const Database = (await import('better-sqlite3')).default

    // Ensure db directory exists
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    const db = new Database(dbPath)

    // FIX: Gunakan DELETE mode bukan WAL
    const currentMode = db.pragma('journal_mode') as string[]
    if (currentMode[0]?.journal_mode !== 'delete') {
      try { db.pragma('wal_checkpoint(TRUNCATE)') } catch { /* ignore */ }
      db.pragma('journal_mode = DELETE')
    }
}

    // ========== MIGRATIONS ==========

    // 1. User table - add 2FA columns
    try {
      const userCols = db.pragma('table_info(User)') as { name: string }[]
      const userColNames = new Set(userCols.map(c => c.name))

      if (!userColNames.has('twoFactorSecret')) {
        db.exec("ALTER TABLE User ADD COLUMN twoFactorSecret TEXT")
        results.push('User: added twoFactorSecret column')
      }
      if (!userColNames.has('twoFactorEnabled')) {
        db.exec("ALTER TABLE User ADD COLUMN twoFactorEnabled BOOLEAN NOT NULL DEFAULT 0")
        results.push('User: added twoFactorEnabled column')
      }
    } catch (e: any) {
      results.push(`User migration skipped: ${e.message}`)
    }

    // 2. AnalisisDiklatItem table - add kategori & status
    try {
      const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='AnalisisDiklatItem'").get()
      if (tableExists) {
        const cols = db.pragma('table_info(AnalisisDiklatItem)') as { name: string }[]
        const colNames = new Set(cols.map(c => c.name))

        if (!colNames.has('kategori')) {
          db.exec("ALTER TABLE AnalisisDiklatItem ADD COLUMN kategori TEXT NOT NULL DEFAULT 'TEKNIS'")
          results.push('AnalisisDiklatItem: added kategori column')
        }
        if (!colNames.has('status')) {
          db.exec("ALTER TABLE AnalisisDiklatItem ADD COLUMN status TEXT NOT NULL DEFAULT 'AKTIF'")
          results.push('AnalisisDiklatItem: added status column')
        }
      }
    } catch (e: any) {
      results.push(`AnalisisDiklatItem migration skipped: ${e.message}`)
    }

    if (results.length === 0) {
      results.push('Schema already up to date - no changes needed')
    }

    db.close()

    return NextResponse.json({
      status: 'ok',
      dbPath,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('DB setup error:', message)
    return NextResponse.json({ status: 'error', message, results }, { status: 500 })
  }
}
