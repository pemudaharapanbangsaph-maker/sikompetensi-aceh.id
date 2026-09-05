import { NextResponse } from 'next/server'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { writeFileSync, statSync } from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { buildBackupZip, ensureBackupDir, resolveBackupFile } from '@/lib/backup-files'
// Repo berbasis mysql2 — TIDAK bergantung pada Prisma Client (lihat catatan di
// src/lib/backup-repo.ts: "Cannot read properties of undefined (reading 'findMany')"
// terjadi ketika model tidak termuat di client hasil prisma generate).
import { listBackupHistory, createBackupHistory } from '@/lib/backup-repo'

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

// execSync bawaan Node membatasi output child process (maxBuffer) hanya 1MB —
// dump database yang lebih besar membuat execSync melempar "maxBuffer exceeded"
// dan backup gagal. 256MB aman untuk dump besar.
const EXEC_OPTS = { timeout: 120000, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 } as const

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'backup:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // mysql2 langsung ke DATABASE_URL — bebas Prisma; tabel dibuat/dilengkapi
    // otomatis bila belum ada (idempotent, lihat backup-repo.ts).
    const data = await listBackupHistory()
    const enriched = data.map(b => {
      let fileExists = false
      try {
        // cek file backup di semua lokasi kandidat (UPLOAD_DIR/backups, db/backups
        // lama di folder aplikasi / versi deploy sebelumnya)
        fileExists = resolveBackupFile(b.namaFile).path !== null
      } catch {
        fileExists = false // jangan sampai satu baris buruk mematikan seluruh daftar
      }
      return { ...b, fileExists }
    })
    return NextResponse.json(enriched)
  } catch (e) {
    console.error('backup list error:', e)
    // sertakan alasan aslinya agar mudah didiagnosis dari toast UI
    return NextResponse.json({ error: 'Gagal memuat data backup: ' + (e as Error).message }, { status: 500 })
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
      sqlDump = execSync(mysqldumpCmd, EXEC_OPTS)
    } catch {
      // Fallback: coba tanpa routines/triggers
      try {
        const fallbackCmd = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} --single-transaction 2>/dev/null`
        sqlDump = execSync(fallbackCmd, EXEC_OPTS)
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
    const catatan = `Termasuk ${fileCount} file upload (sertifikat/dokumen pendaftar)` + (missing.length ? `. PERHATIAN: ${missing.length} file tercatat di DB tapi tidak ditemukan di server.` : '')
    const item = await createBackupHistory({
      namaFile, ukuran, tipe: 'MANUAL', status: 'BERHASIL', dibuatOleh: session.user.id, catatan,
    })
    await auditLog(session, 'BACKUP', 'BACKUP', `Backup database + ${fileCount} file upload: ${namaFile} (${ukuran})`, req)
    return NextResponse.json({ ...item, fileCount })
  } catch (e) {
    console.error('backup create error:', e)
    return NextResponse.json({ error: 'Gagal membuat backup: ' + (e as Error).message }, { status: 500 })
  }
}
