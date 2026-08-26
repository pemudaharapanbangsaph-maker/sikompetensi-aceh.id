import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { copyFileSync, mkdirSync, existsSync, statSync } from 'fs'
import path from 'path'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  const match = dbUrl.match(/file:(.+)/)
  let dbPath = match ? match[1] : './db/custom.db'
  if (dbPath.startsWith('./')) dbPath = path.join(process.cwd(), dbPath.substring(2))
  return dbPath.split('?')[0]
}

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function isBackupFileExists(namaFile: string): boolean {
  return existsSync(path.join(BACKUP_DIR, namaFile))
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'backup:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const data = await db.backupHistory.findMany({ orderBy: { createdAt: 'desc' } })
    const enriched = data.map(b => ({
      ...b,
      fileExists: isBackupFileExists(b.namaFile),
    }))
    return NextResponse.json(enriched)
  } catch (e) {
    console.error('backup list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data backup' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'backup:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    ensureBackupDir()
    const dbPath = getDbPath()
    if (!existsSync(dbPath)) {
      return NextResponse.json({ error: 'File database tidak ditemukan' }, { status: 500 })
    }
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const namaFile = `backup_${stamp}.db`
    const backupPath = path.join(BACKUP_DIR, namaFile)
    copyFileSync(dbPath, backupPath)
    const walPath = dbPath + '-wal'
    const shmPath = dbPath + '-shm'
    if (existsSync(walPath)) copyFileSync(walPath, backupPath + '-wal')
    if (existsSync(shmPath)) copyFileSync(shmPath, backupPath + '-shm')
    const stats = statSync(backupPath)
    const ukuran = formatFileSize(stats.size)
    const item = await db.backupHistory.create({
      data: { namaFile, ukuran, tipe: 'MANUAL', status: 'BERHASIL', dibuatOleh: session.user.id },
    })
    await auditLog(session, 'BACKUP', 'BACKUP', `Backup database: ${namaFile} (${ukuran})`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('backup create error:', e)
    return NextResponse.json({ error: 'Gagal membuat backup' }, { status: 500 })
  }
}
