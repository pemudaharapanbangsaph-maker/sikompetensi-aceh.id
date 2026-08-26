import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { existsSync, copyFileSync, unlinkSync } from 'fs'
import path from 'path'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  const match = dbUrl.match(/file:(.+)/)
  let dbPath = match ? match[1] : './db/custom.db'
  if (dbPath.startsWith('./')) dbPath = path.join(process.cwd(), dbPath.substring(2))
  return dbPath.split('?')[0]
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'backup:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.backupHistory.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Backup tidak ditemukan' }, { status: 404 })
    const backupPath = path.join(BACKUP_DIR, item.namaFile)
    if (!existsSync(backupPath)) {
      return NextResponse.json({ error: 'File backup tidak ditemukan di server' }, { status: 404 })
    }
    const dbPath = getDbPath()
    if (existsSync(dbPath + '-wal')) unlinkSync(dbPath + '-wal')
    if (existsSync(dbPath + '-shm')) unlinkSync(dbPath + '-shm')
    copyFileSync(backupPath, dbPath)
    if (existsSync(backupPath + '-wal')) copyFileSync(backupPath + '-wal', dbPath + '-wal')
    if (existsSync(backupPath + '-shm')) copyFileSync(backupPath + '-shm', dbPath + '-shm')
    await auditLog(session, 'RESTORE', 'BACKUP', `Restore database dari: ${item.namaFile}`, req)
    return NextResponse.json({
      success: true,
      message: `Database berhasil direstore dari ${item.namaFile}. Halaman akan dimuat ulang otomatis.`,
    })
  } catch (e) {
    console.error('backup restore error:', e)
    return NextResponse.json({ error: 'Gagal restore database: ' + (e as Error).message }, { status: 500 })
  }
}
