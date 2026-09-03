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
