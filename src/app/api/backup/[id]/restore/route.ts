import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')

function parseDbUrl(): { host: string; port: string; user: string; password: string; database: string } {
  const url = process.env.DATABASE_URL || ''
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  if (!match) throw new Error('DATABASE_URL format tidak valid untuk MySQL')
  return { host: match[3], port: match[4], user: match[1], password: match[2], database: match[5].split('?')[0] }
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

    const dbConfig = parseDbUrl()
    const sqlContent = readFileSync(backupPath, 'utf-8')
    
    // Gunakan mysql CLI untuk restore
    const mysqlCmd = `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} 2>&1`
    execSync(mysqlCmd, { input: sqlContent, timeout: 120000, encoding: 'utf-8' })

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
