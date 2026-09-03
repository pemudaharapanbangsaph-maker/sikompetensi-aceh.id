// Tambah kolom `email` ke tabel PendaftaranPortal di MySQL.
// Aman dijalankan berkali-kali (idempotent) — data lama tidak tersentuh.
//
// CATATAN: Script ini OPSIONAL. Aplikasi sudah otomatis menambahkan kolom ini
// saat server start (src/instrumentation.ts + src/lib/ensure-schema.ts).
// Script manual berguna jika Anda ingin memastikan migrasi berjalan sendiri
// sebelum deploy, atau jika ingin dijalankan dari SSH:
//
//   node add-email-column.js
//
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  const cols = await db.$queryRawUnsafe("SHOW COLUMNS FROM `PendaftaranPortal` LIKE 'email'")
  if (Array.isArray(cols) && cols.length > 0) {
    console.log('Kolom email sudah ada — tidak ada perubahan.')
    return
  }
  await db.$executeRawUnsafe('ALTER TABLE `PendaftaranPortal` ADD COLUMN `email` VARCHAR(191) NULL')
  console.log('Kolom email PendaftaranPortal berhasil ditambahkan!')
}

main()
  .catch((e) => { console.error('Gagal:', e.message) })
  .finally(() => db.$disconnect())
