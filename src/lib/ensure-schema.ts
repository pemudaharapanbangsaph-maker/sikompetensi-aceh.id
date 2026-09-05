import { db } from '@/lib/db'

/**
 * MIGRASI RINGAN & OTOMATIS — kolom `email` pada tabel `PendaftaranPortal`.
 *
 * LATAR BELAKANG:
 * Field Email ditambahkan ke form pendaftaran portal (wajib diisi, tanda bintang merah).
 * Kode baru (Prisma Client hasil `prisma generate`) mengasumsikan kolom `email` ADA di MySQL.
 * Jika database lama di Hostinger belum punya kolom tersebut, SEMUA query ke tabel
 * PendaftaranPortal akan error "Unknown column 'email'" dan modul pendaftaran rusak total.
 *
 * SOLUSI:
 * Fungsi ini dipanggil saat server start (instrumentation.ts) dan pada route pendaftaran
 * utama. Ia memeriksa `SHOW COLUMNS ... LIKE 'email'` lalu menjalankan
 * `ALTER TABLE ... ADD COLUMN email VARCHAR(191) NULL` HANYA jika kolom belum ada.
 *
 * SIFAT:
 * - Idempotent: aman dijalankan berkali-kali.
 * - Non-blocking failure: jika DB sempat tidak terjangkau, error hanya dicatat ke log
 *   dan pengecekan akan dicoba ulang pada pemanggilan berikutnya (tidak di-memoize
 *   saat gagal, hanya saat sukses).
 * - TIDAK mengubah data lama sama sekali (kolom baru NULL untuk baris lama).
 */

let done = false
let inflight: Promise<void> | null = null

async function run(): Promise<void> {
  try {
    const cols = (await db.$queryRawUnsafe(
      "SHOW COLUMNS FROM `PendaftaranPortal` LIKE 'email'"
    )) as unknown[]

    if (!Array.isArray(cols) || cols.length === 0) {
      await db.$executeRawUnsafe(
        'ALTER TABLE `PendaftaranPortal` ADD COLUMN `email` VARCHAR(191) NULL'
      )
      console.log('[ensure-schema] Kolom `email` pada PendaftaranPortal berhasil ditambahkan')
    }

    // Tandai sukses hanya jika pengecekan/ALTER di atas tidak melempar error
    done = true
  } catch (e) {
    // Jangan pernah menggagalkan request/server — cukup catat agar bisa dilihat di log.
    console.error('[ensure-schema] Gagal memastikan kolom email PendaftaranPortal:', e)
  }
}

export function ensurePendaftaranEmailColumn(): Promise<void> {
  if (done) return Promise.resolve()
  if (!inflight) {
    inflight = run().finally(() => {
      inflight = null
    })
  }
  return inflight
}

// ---------------------------------------------------------------------------
// Tabel `BackupHistory` — pemulihan otomatis (self-healing)
//
// LATAR BELAKANG:
// - Jika tabel BackupHistory hilang / kolomnya tidak lengkap (mis. database
// pernah di-restore dengan file .sql lama yang tidak memuat tabel ini, atau
// setup database produksi mendahului skema terbaru), SEMUA query backup
// (daftar, buat, download, hapus, restore) error → halaman Backup "gagal
// memuat" (HTTP 500).
//
// SOLUSI: pastikan tabel + semua kolomnya ada (idempotent, aman diulang):
// - SHOW TABLES LIKE 'BackupHistory' → CREATE TABLE IF NOT EXISTS bila belum ada
// - SHOW COLUMNS → ALTER TABLE ADD COLUMN untuk kolom yang kurang
// - Tidak memakai FOREIGN KEY saat membuat ulang agar tetap berhasil walau
//   tabel User bermasalah (query Prisma findMany/create tidak butuh FK).
// Dipanggil saat server start (instrumentation) + belt-and-suspenders di route
// backup. Data yang sudah ada TIDAK disentuh sama sekali.
// ---------------------------------------------------------------------------

let bhDone = false
let bhInflight: Promise<void> | null = null

const BACKUP_HISTORY_COLUMNS: Record<string, string> = {
  id: '`id` VARCHAR(30) NOT NULL',
  namaFile: '`namaFile` VARCHAR(255) NOT NULL',
  ukuran: '`ukuran` VARCHAR(50) NOT NULL',
  tipe: '`tipe` VARCHAR(20) NOT NULL DEFAULT \'MANUAL\'',
  status: '`status` VARCHAR(20) NOT NULL DEFAULT \'BERHASIL\'',
  dibuatOleh: '`dibuatOleh` VARCHAR(30) NULL',
  catatan: '`catatan` TEXT NULL',
  createdAt: '`createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)',
}

async function runBackupHistory(): Promise<void> {
  try {
    const tables = (await db.$queryRawUnsafe(
      "SHOW TABLES LIKE 'BackupHistory'"
    )) as unknown[]

    if (!Array.isArray(tables) || tables.length === 0) {
      const cols = Object.entries(BACKUP_HISTORY_COLUMNS)
        .map(([, def]) => def)
        .join(', ')
      await db.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS \`BackupHistory\` (${cols}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      )
      console.log('[ensure-schema] Tabel `BackupHistory` berhasil dibuat ulang')
    }

    // Lengkapi kolom yang hilang (idempotent)
    const cols = (await db.$queryRawUnsafe(
      'SHOW COLUMNS FROM `BackupHistory`'
    )) as { Field: string }[]
    const present = new Set((Array.isArray(cols) ? cols : []).map((c) => String(c?.Field)))
    for (const [name, def] of Object.entries(BACKUP_HISTORY_COLUMNS)) {
      if (!present.has(name)) {
        await db.$executeRawUnsafe(`ALTER TABLE \`BackupHistory\` ADD COLUMN ${def}`)
        console.log(`[ensure-schema] Kolom \`${name}\` pada BackupHistory berhasil ditambahkan`)
      }
    }

    bhDone = true
  } catch (e) {
    // Jangan pernah menggagalkan request/server — cukup catat agar bisa dilihat di log.
    console.error('[ensure-schema] Gagal memastikan tabel BackupHistory:', e)
  }
}

export function ensureBackupHistoryTable(): Promise<void> {
  if (bhDone) return Promise.resolve()
  if (!bhInflight) {
    bhInflight = runBackupHistory().finally(() => {
      bhInflight = null
    })
  }
  return bhInflight
}
