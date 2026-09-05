import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { readFile } from 'fs/promises'
import { execSync } from 'child_process'
import { resolveBackupFile, applyBackupZip } from '@/lib/backup-files'
import { ensureBackupHistoryTable } from '@/lib/ensure-schema'

function parseDbUrl(): { host: string; port: string; user: string; password: string; database: string } {
  const url = process.env.DATABASE_URL || ''
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  if (!match) throw new Error('DATABASE_URL format tidak valid untuk MySQL')
  return { host: match[3], port: match[4], user: match[1], password: match[2], database: match[5].split('?')[0] }
}

// Import dump besar butuh waktu & output buffer lebih besar dari default Node
// (default: maxBuffer 1MB, timeout 120s — import besar akan TERPUTUS di tengah
// jalan dan database bisa tertinggal setengah-restore). 10 menit + 256MB aman.
const IMPORT_OPTS = { timeout: 600000, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 } as const

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'backup:restore')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // Belt-and-suspenders: pastikan tabel BackupHistory ada (idempotent, murah)
    await ensureBackupHistoryTable()
    const { id } = await params
    const item = await db.backupHistory.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Backup tidak ditemukan' }, { status: 404 })

    // Cari file backup di semua lokasi kandidat (UPLOAD_DIR/backups, db/backups
    // di folder aplikasi & versi deploy lama) — dulu hanya process.cwd()/db/backups.
    const { path: backupPath, tried } = resolveBackupFile(item.namaFile)
    if (!backupPath) {
      return NextResponse.json(
        { error: 'File backup tidak ditemukan di server. Lokasi yang dicoba: ' + tried.join(' | ') },
        { status: 404 }
      )
    }

    const dbConfig = parseDbUrl()
    let restoredFileCount = 0

    if (item.namaFile.toLowerCase().endsWith('.zip')) {
      // ===== Backup baru: ZIP berisi database.sql + file upload =====
      const buf = await readFile(backupPath)
      const { sql, restoredFiles } = await applyBackupZip(buf)
      if (!sql) {
        return NextResponse.json({ error: 'ZIP backup tidak berisi file .sql — tidak bisa restore database' }, { status: 400 })
      }
      // Restore database dulu, lalu file sudah tertulis oleh applyBackupZip
      const mysqlCmd = `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} 2>&1`
      try {
        execSync(mysqlCmd, { ...IMPORT_OPTS, input: sql })
      } catch (e: any) {
        return NextResponse.json(
          {
            error:
              'Gagal restore database: ' + (e?.message || 'unknown') +
              '. PERHATIAN: bila import terputus di tengah jalan, sebagian tabel mungkin belum lengkap — ' +
              'ulangi restore (atau gunakan backup lain) sampai berhasil.',
          },
          { status: 500 }
        )
      }
      restoredFileCount = restoredFiles.length

      await auditLog(session, 'RESTORE', 'BACKUP', `Restore database + ${restoredFileCount} file upload dari: ${item.namaFile}`, req)
      return NextResponse.json({
        success: true,
        message:
          `Database & ${restoredFileCount} file upload (sertifikat/surat tugas/dokumen pendaftar) berhasil direstore dari ${item.namaFile}. ` +
          'Halaman akan dimuat ulang otomatis.',
        restoredFileCount,
      })
    }

    // ===== Backup lama (.sql murni) — perilaku asli dipertahankan =====
    const sqlContent = await readFile(backupPath, 'utf-8')
    const mysqlCmd = `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} 2>&1`
    try {
      execSync(mysqlCmd, { ...IMPORT_OPTS, input: sqlContent })
    } catch (e: any) {
      return NextResponse.json(
        {
          error:
            'Gagal restore database: ' + (e?.message || 'unknown') +
            '. PERHATIAN: bila import terputus di tengah jalan, sebagian tabel mungkin belum lengkap — ' +
            'ulangi restore (atau gunakan backup lain) sampai berhasil.',
        },
        { status: 500 }
      )
    }

    await auditLog(session, 'RESTORE', 'BACKUP', `Restore database dari: ${item.namaFile} (hanya database, tanpa file upload — backup format lama)`, req)
    return NextResponse.json({
      success: true,
      message:
        `Database berhasil direstore dari ${item.namaFile} (backup format lama — tidak menyertakan file upload). ` +
        'Halaman akan dimuat ulang otomatis.',
    })
  } catch (e) {
    console.error('backup restore error:', e)
    return NextResponse.json({ error: 'Gagal restore database: ' + (e as Error).message }, { status: 500 })
  }
}
