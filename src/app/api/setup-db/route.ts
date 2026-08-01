import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const SETUP_FLAG = '/tmp/.db-initialized'
const DB_PATH = '/tmp/custom.db'

export const dynamic = 'force-dynamic'

export async function GET() {
  // If already initialized, skip
  if (fs.existsSync(SETUP_FLAG)) {
    return NextResponse.json({ status: 'already_initialized' })
  }

  try {
    // Dynamic import better-sqlite3 (already a dependency of Prisma)
    const Database = (await import('better-sqlite3')).default
    
    // Create database connection
    const db = new Database(DB_PATH)
    
    // Enable WAL mode for better concurrent performance
    db.pragma('journal_mode = WAL')
    
    // Check if tables already exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='User'").get()
    
    if (!tables) {
      // Read and execute the schema SQL
      const schemaPath = path.join(process.cwd(), 'prisma', 'schema.sql')
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8')
      
      // Execute each statement
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
    fs.writeFileSync(SETUP_FLAG, new Date().toISOString())
    
    return NextResponse.json({ status: 'initialized' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('DB setup error:', message)
    
    // If table already exists, still mark as initialized
    if (message.includes('already exists')) {
      fs.writeFileSync(SETUP_FLAG, new Date().toISOString())
      return NextResponse.json({ status: 'already_up_to_date' })
    }
    
    return NextResponse.json({ status: 'error', message }, { status: 500 })
  }
}
