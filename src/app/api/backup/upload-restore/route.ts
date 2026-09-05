import { NextResponse } from 'next/server'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { writeFile } from 'fs/promises'
import path from 'path'
import { existsSync, mkdirSync, unlinkSync, readFileSync } from 'fs'
import { execSync } from 'child_process'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true })
}

function parseDbUrl(): { host: string; port: string; user: string; password: string; database: string } {
  const url = process.env.DATABASE_URL || ''
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  if (!match) throw new Error('DATABASE_URL format tidak valid untuk MySQL')
  return { host: match[3], port: match[4], user: match[1], password: match[2], database: match[5].split('?')[0] }
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
    if (!name.endsWith('.sql')) {
      return NextResponse.json({ error: 'Format file harus .sql (dump MySQL)' }, { status: 400 })
    }
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 100MB' }, { status: 400 })
    }

    // Simpan file sementara
    ensureBackupDir()
    const tmpPath = path.join(BACKUP_DIR, `upload_${Date.now()}.sql`)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(tmpPath, buffer)

    try {
      const dbConfig = parseDbUrl()
      const sqlContent = readFileSync(tmpPath, 'utf-8')
      const mysqlCmd = `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} 2>&1`
      execSync(mysqlCmd, { input: sqlContent, timeout: 120000, encoding: 'utf-8' })

      await auditLog(session, 'RESTORE', 'BACKUP', `Restore database dari upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`, req)
      // Bersihkan file sementara
      try { unlinkSync(tmpPath) } catch { /* ignore */ }
      return NextResponse.json({
        success: true,
        message: `Database berhasil direstore dari file ${file.name}. Halaman akan dimuat ulang otomatis.`,
      })
    } catch (execError) {
      // Bersihkan file sementara jika restore gagal
      try { unlinkSync(tmpPath) } catch { /* ignore */ }
      throw execError
    }
  } catch (e) {
    console.error('upload restore error:', e)
    return NextResponse.json({ error: 'Gagal restore: ' + (e as Error).message }, { status: 500 })
  }
}
