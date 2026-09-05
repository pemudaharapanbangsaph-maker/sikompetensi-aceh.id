import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import { mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { getBackupDir, applyBackupZip } from '@/lib/backup-files'

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
    const isSql = name.endsWith('.sql')
    const isZip = name.endsWith('.zip')
    if (!isSql && !isZip) {
      return NextResponse.json({ error: 'Format file harus .sql (dump MySQL) atau .zip (backup lengkap: database + file upload)' }, { status: 400 })
    }
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 100MB' }, { status: 400 })
    }

    // Baca isi file sekali ke memori (maks 100MB sesuai validasi)
    const buffer = Buffer.from(await file.arrayBuffer())

    // ---- ZIP: terapkan database.sql + file upload sekaligus ----
    if (isZip) {
      let restoredFileCount = 0
      try {
        const { sql, restoredFiles } = await applyBackupZip(buffer)
        if (!sql) {
          return NextResponse.json({ error: 'ZIP tidak berisi file .sql — tidak bisa restore database' }, { status: 400 })
        }
        const dbConfig = parseDbUrl()
        const mysqlCmd = `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} 2>&1`
        execSync(mysqlCmd, { input: sql, timeout: 120000, encoding: 'utf-8' })
        restoredFileCount = restoredFiles.length

        await auditLog(session, 'RESTORE', 'BACKUP', `Restore database + ${restoredFileCount} file upload dari upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`, req)
        return NextResponse.json({
          success: true,
          message: `Database & ${restoredFileCount} file upload (sertifikat/surat tugas/dokumen pendaftar) berhasil direstore dari file ${file.name}. Halaman akan dimuat ulang otomatis.`,
          restoredFileCount,
        })
      } catch (execError) {
        console.error('upload restore (zip) error:', execError)
        return NextResponse.json({ error: 'Gagal restore: ' + (execError as Error).message }, { status: 500 })
      }
    }

    // ---- SQL (perilaku lama): simpan sementara → mysql CLI → bersihkan ----
    const backupDir = getBackupDir()
    mkdirSync(backupDir, { recursive: true })
    const tmpPath = path.join(backupDir, `upload_${Date.now()}.sql`)
    await writeFile(tmpPath, buffer)

    try {
      const dbConfig = parseDbUrl()
      const sqlContent = buffer.toString('utf-8')
      const mysqlCmd = `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} 2>&1`
      execSync(mysqlCmd, { input: sqlContent, timeout: 120000, encoding: 'utf-8' })

      await auditLog(session, 'RESTORE', 'BACKUP', `Restore database dari upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`, req)
      try { await unlink(tmpPath) } catch { /* ignore */ }
      return NextResponse.json({
        success: true,
        message: `Database berhasil direstore dari file ${file.name} (file .sql tidak menyertakan file upload). Halaman akan dimuat ulang otomatis.`,
      })
    } catch (execError) {
      try { await unlink(tmpPath) } catch { /* ignore */ }
      throw execError
    }
  } catch (e) {
    console.error('upload restore error:', e)
    return NextResponse.json({ error: 'Gagal restore: ' + (e as Error).message }, { status: 500 })
  }
}
