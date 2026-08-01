import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  // Extract path from "file:./db/custom.db" or "file:/tmp/custom.db"
  const match = dbUrl.match(/file:(.+)/)
  let dbPath = match ? match[1] : './db/custom.db'
  // Resolve relative paths
  if (dbPath.startsWith('./')) {
    dbPath = path.join(process.cwd(), dbPath.substring(2))
  }
  return dbPath
}

export async function GET() {
  const dbPath = getDbPath()
  const flagPath = path.join(path.dirname(dbPath), '.db-initialized')

  // If already initialized, skip
  if (fs.existsSync(flagPath)) {
    return NextResponse.json({ status: 'already_initialized' })
  }

  try {
    const Database = (await import('better-sqlite3')).default

    // Ensure db directory exists
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')

    // Check if tables already exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='User'").get()

    if (!tables) {
      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.sql')
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8')
      const statements = schemaSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)
      for (const stmt of statements) {
        db.exec(stmt)
      }
    }

    db.close()

    // Mark as initialized
    fs.writeFileSync(flagPath, new Date().toISOString())

    return NextResponse.json({ status: 'initialized' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('DB setup error:', message)
    if (message.includes('already exists')) {
      fs.writeFileSync(flagPath, new Date().toISOString())
      return NextResponse.json({ status: 'already_up_to_date' })
    }
    return NextResponse.json({ status: 'error', message }, { status: 500 })
  }
}
