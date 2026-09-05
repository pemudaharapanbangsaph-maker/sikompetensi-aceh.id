import { PrismaClient } from '@prisma/client'

/**
 * Batas jumlah koneksi pool Prisma untuk MySQL di shared hosting (Hostinger).
 *
 * MENGAPA PENTING:
 * Default pool Prisma = jumlah CPU fisik × 2 + 1. Di server Hostinger yang
 * ber-CPU banyak, SATU proses aplikasi bisa membuka 17–33 koneksi sekaligus,
 * sedangkan MySQL shared hosting umumnya hanya mengizinkan ±10–25 koneksi
 * per user database. Akibatnya query bisa gagal acak
 * ("User already has more than 'max_user_connections' active connections")
 * → route API balas 500 (mis. /api/backup gagal dimuat) padahal database sehat.
 *
 * connection_limit=5 jauh lebih dari cukup untuk aplikasi admin internal dan
 * aman meski Passenger menjalankan beberapa proses aplikasi sekaligus.
 *
 * Fungsi pure ini diekspor agar mudah diuji terpisah (harness).
 */
export function augmentMysqlUrl(url: string): string {
  const u = String(url || '').trim()
  if (!u.toLowerCase().startsWith('mysql://')) return u
  if (/connection_limit=/i.test(u)) return u // sudah diset manual — hormati
  return u + (u.includes('?') ? '&' : '?') + 'connection_limit=5'
}

const rawUrl = (process.env.DATABASE_URL || '').trim()
const datasourceUrl = augmentMysqlUrl(rawUrl)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Batasi pool agar tidak menabrak batas koneksi MySQL shared hosting.
    // Hanya dikirim bila DATABASE_URL terisi (perilaku lama tetap sama bila kosong).
    ...(rawUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
