import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { mkdirSync, existsSync, statSync, writeFileSync, unlinkSync } from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function parseDbUrl(): { host: string; port: string; user: string; password: string; database: string } {
  const url = process.env.DATABASE_URL || ''
  // mysql://user:password@host:port/database
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  if (!match) throw new Error('DATABASE_URL format tidak valid untuk MySQL')
  return { host: match[3], port: match[4], user: match[1], password: match[2], database: match[5].split('?')[0] }
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

    const dbConfig = parseDbUrl()
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const namaFile = `backup_${stamp}.sql`
    const backupPath = path.join(BACKUP_DIR, namaFile)

    // Gunakan mysqldump untuk backup
    const mysqldumpCmd = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} --single-transaction --routines --triggers 2>/dev/null`

    try {
      const output = execSync(mysqldumpCmd, { timeout: 120000, encoding: 'utf-8' })
      writeFileSync(backupPath, output, 'utf-8')
    } catch (e: any) {
      // Fallback: coba tanpa routines/triggers
      try {
        const fallbackCmd = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} --single-transaction 2>/dev/null`
        const output = execSync(fallbackCmd, { timeout: 120000, encoding: 'utf-8' })
        writeFileSync(backupPath, output, 'utf-8')
      } catch (e2: any) {
        return NextResponse.json({ error: 'Gagal backup: mysqldump tidak tersedia. Error: ' + (e2.message || 'unknown') }, { status: 500 })
      }
    }

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
