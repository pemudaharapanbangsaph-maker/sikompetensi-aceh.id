// Instrumentation - tabel AnalisisDiklatItem sudah ada di prisma/schema.prisma
// Tidak perlu CREATE TABLE manual lagi seperti waktu SQLite
import { ensurePendaftaranEmailColumn } from '@/lib/ensure-schema'

export async function register() {
  // Migrasi ringan: pastikan kolom `email` PendaftaranPortal ada di MySQL
  // (idempotent — hanya ALTER jika kolom belum ada, data lama tidak tersentuh)
  await ensurePendaftaranEmailColumn()
}
