import { NextResponse } from 'next/server'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'
import { writeFile } from 'fs/promises'

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  const match = dbUrl.match(/file:(.+)/)
  let dbPath = match ? match[1] : './db/custom.db'
  if (dbPath.startsWith('./')) dbPath = path.join(process.cwd(), dbPath.substring(2))
  return dbPath.split('?')[0]
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'backup:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    const name = file.name.toLowerCase()
    if (!name.endsWith('.db') && !name.endsWith('.sqlite') && !name.endsWith('.sqlite3')) {
      return NextResponse.json({ error: 'Format file harus .db, .sqlite, atau .sqlite3' }, { status: 400 })
    }
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 100MB' }, { status: 400 })
    }
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const dbPath = getDbPath()
    if (existsSync(dbPath + '-wal')) unlinkSync(dbPath + '-wal')
    if (existsSync(dbPath + '-shm')) unlinkSync(dbPath + '-shm')
    await writeFile(dbPath, buffer)
    await auditLog(session, 'RESTORE', 'BACKUP', `Restore database dari upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`, req)
    return NextResponse.json({
      success: true,
      message: `Database berhasil direstore dari file ${file.name}. Halaman akan dimuat ulang otomatis.`,
    })
  } catch (e) {
    console.error('upload restore error:', e)
    return NextResponse.json({ error: 'Gagal restore: ' + (e as Error).message }, { status: 500 })
  }
}
