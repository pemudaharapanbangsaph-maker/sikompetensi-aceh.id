import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { writeFileSync, statSync } from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { buildBackupZip, ensureBackupDir, resolveBackupFile } from '@/lib/backup-files'

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
      // cek file backup di semua lokasi kandidat (UPLOAD_DIR/backups, db/backups
      // lama di folder aplikasi / versi deploy sebelumnya)
      fileExists: resolveBackupFile(b.namaFile).path !== null,
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
    const backupDir = await ensureBackupDir()

    const dbConfig = parseDbUrl()
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const namaFile = `backup_${stamp}.zip`
    const backupPath = path.join(backupDir, namaFile)

    // 1) Dump database dengan mysqldump (pola lama dipertahankan)
    let sqlDump = ''
    const mysqldumpCmd = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} --single-transaction --routines --triggers 2>/dev/null`
    try {
      sqlDump = execSync(mysqldumpCmd, { timeout: 120000, encoding: 'utf-8' })
    } catch {
      // Fallback: coba tanpa routines/triggers
      try {
        const fallbackCmd = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} --single-transaction 2>/dev/null`
        sqlDump = execSync(fallbackCmd, { timeout: 120000, encoding: 'utf-8' })
      } catch (e2: any) {
        return NextResponse.json({ error: 'Gagal backup: mysqldump tidak tersedia. Error: ' + (e2.message || 'unknown') }, { status: 500 })
      }
    }

    // 2) Gabungkan dump SQL + FILE UPLOAD (sertifikat, surat tugas, dokumen
    //    pendaftar) ke dalam SATU file zip — inilah yang membuat file fisik
    //    ikut ter-restore nanti (dulu hanya database yang dibackup).
    const { buffer, fileCount, missing } = await buildBackupZip(sqlDump)

    // 3) Simpan ke lokasi durable: UPLOAD_DIR/backups (selamat dari redeploy),
    //    fallback db/backups di folder aplikasi bila UPLOAD_DIR kosong.
    writeFileSync(backupPath, buffer)

    const stats = statSync(backupPath)
    const ukuran = formatFileSize(stats.size)
    const catatan = `Termasuk ${fileCount} file upload (sertifikat/surat tugas/dokumen pendaftar)` + (missing.length ? `. PERHATIAN: ${missing.length} file tercatat di DB tapi tidak ditemukan di server.` : '')
    const item = await db.backupHistory.create({
      data: { namaFile, ukuran, tipe: 'MANUAL', status: 'BERHASIL', dibuatOleh: session.user.id, catatan },
    })
    await auditLog(session, 'BACKUP', 'BACKUP', `Backup database + ${fileCount} file upload: ${namaFile} (${ukuran})`, req)
    return NextResponse.json({ ...item, fileCount })
  } catch (e) {
    console.error('backup create error:', e)
    return NextResponse.json({ error: 'Gagal membuat backup' }, { status: 500 })
  }
}
