// Instrumentation - tabel AnalisisDiklatItem sudah ada di prisma/schema.prisma
// Tidak perlu CREATE TABLE manual lagi seperti waktu SQLite
import { ensurePendaftaranEmailColumn, ensureBackupHistoryTable } from '@/lib/ensure-schema'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { prismaModelExists, recreatePrismaClient } from '@/lib/db'
import { getAppRoot } from '@/lib/storage'
import { ensureBackupTableMysql } from '@/lib/backup-repo'

// Model penanda: bila SALAH SATU saja tidak ada di Prisma Client, berarti client
// yang termuat proses ini "stub"/tidak lengkap (mis. `prisma generate` tidak
// berjalan pada node_modules runtime) — gejala produksi:
// "Cannot read properties of undefined (reading 'findMany')".
const PRISMA_CHECK_MODELS = ['user', 'sertifikat', 'pendaftaranPortal', 'backupHistory']

/**
 * Pulihkan Prisma Client saat server start bila model tidak termuat:
 * 1. deteksi model hilang,
 * 2. jalankan `prisma generate` pada folder aplikasi (best-effort),
 * 3. muat ulang @prisma/client hasil generate (lihat src/lib/db.ts),
 * 4. catat hasilnya di log server — tidak pernah melempar error
 *    (server tetap hidup; fitur backup aman karena memakai mysql2).
 */
async function healPrismaClientIfStub(): Promise<void> {
  try {
    let missing = PRISMA_CHECK_MODELS.filter((m) => !prismaModelExists(m))
    if (missing.length === 0) return

    console.warn(
      '[instrumentation] PERINGATAN: Prisma Client tidak memiliki model:',
      missing.join(', '),
      '— query non-backup akan error "Cannot read properties of undefined". Mencoba pulihkan otomatis...'
    )

    const root = getAppRoot()
    if (!root) {
      console.error(
        '[instrumentation] Root aplikasi tidak terdeteksi — heal Prisma dilewati. ' +
          'Jalankan manual: npm install && npx prisma generate lalu restart aplikasi.'
      )
      return
    }
    const cli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js')
    const schema = path.join(root, 'prisma', 'schema.prisma')
    if (!fs.existsSync(cli) || !fs.existsSync(schema)) {
      console.error(
        `[instrumentation] prisma CLI / schema tidak ditemukan (${cli}) — heal Prisma dilewati. ` +
          'Jalankan manual: npm install && npx prisma generate lalu restart aplikasi.'
      )
      return
    }

    console.warn('[instrumentation] Menjalankan "prisma generate" otomatis (mohon tunggu)...')
    execSync(`"${process.execPath}" "${cli}" generate --schema "${schema}"`, {
      stdio: 'inherit',
      timeout: 180000,
      cwd: root,
    })

    const swapped = recreatePrismaClient()
    missing = PRISMA_CHECK_MODELS.filter((m) => !prismaModelExists(m))
    if (swapped && missing.length === 0) {
      console.log('[instrumentation] Prisma Client BERHASIL dipulihkan — semua model kini tersedia.')
    } else {
      console.error(
        '[instrumentation] Prisma Client masih tidak lengkap setelah heal:',
        missing.join(', ') || '(tidak diketahui)',
        '— jalankan manual "npx prisma generate" + restart aplikasi. ' +
          'Fitur Backup & Restore tetap berfungsi penuh (memakai mysql2, tidak lewat Prisma).'
      )
    }
  } catch (e) {
    console.error(
      '[instrumentation] Percobaan heal Prisma Client gagal:',
      (e as Error).message,
      '— server tetap berjalan; fitur backup aman (mysql2).'
    )
  }
}

export async function register() {
  // Migrasi ringan: pastikan kolom `email` PendaftaranPortal ada di MySQL
  // (idempotent — hanya ALTER jika kolom belum ada, data lama tidak tersentuh)
  await ensurePendaftaranEmailColumn()
  // Self-healing: pastikan tabel BackupHistory + kolomnya lengkap (idempotent)
  await ensureBackupHistoryTable()
  // Self-healing Prisma Client (lihat fungsi di atas — best-effort)
  await healPrismaClientIfStub()
  // Belt-and-suspenders: pastikan tabel BackupHistory juga via mysql2
  // (jalur yang dipakai fitur backup — bebas Prisma)
  try {
    await ensureBackupTableMysql()
  } catch (e) {
    console.error('[instrumentation] ensureBackupTableMysql gagal (dicoba ulang saat operasi backup):', (e as Error).message)
  }
}
