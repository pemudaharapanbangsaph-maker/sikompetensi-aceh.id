import { PrismaClient } from '@prisma/client'
import { createRequire } from 'module'
import * as path from 'path'
import { getAppRoot } from '@/lib/storage'

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

function clientOptions() {
  return {
    // Batasi pool agar tidak menabrak batas koneksi MySQL shared hosting.
    // Hanya dikirim bila DATABASE_URL terisi (perilaku lama tetap sama bila kosong).
    ...(rawUrl ? { datasources: { db: { url: augmentMysqlUrl(rawUrl) } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  }
}

function createClient(): PrismaClient {
  return new PrismaClient(clientOptions())
}

// ---------------------------------------------------------------------------
// SELF-HEALING PRISMA CLIENT
//
// LATAR BELAKANG (kejadian nyata di produksi Hostinger):
// Pesan error "Cannot read properties of undefined (reading 'findMany')"
// berarti Prisma Client yang dimuat proses TIDAK memiliki model sama sekali /
// tidak lengkap — misalnya karena `prisma generate` tidak sempat berjalan pada
// node_modules yang dipakai runtime (client "stub" bawaan @prisma/client
// memiliki nol model), atau node_modules berasal dari skema lama.
//
// SOLUSI:
// `db` diekspor sebagai Proxy yang SELALU membaca instance terkini (`current`).
// `recreatePrismaClient()` memuat ULANG @prisma/client hasil `prisma generate`
// (purge require-cache → require ulang dari node_modules aplikasi) lalu menukar
// instance di balik Proxy — transparan bagi seluruh kode aplikasi.
// Dipanggil oleh instrumentation saat boot setelah menjalankan `prisma generate`.
// Semua langkah best-effort: gagal → instance lama tetap dipakai (tidak crash).
// ---------------------------------------------------------------------------
let current: PrismaClient = createClient()

export const db: PrismaClient = new Proxy(current, {
  get(_target, prop) {
    const v = Reflect.get(current, prop, current)
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(current) : v
  },
  has(_target, prop) {
    return Reflect.has(current, prop)
  },
  set(_target, prop, value) {
    Reflect.set(current, prop, value, current)
    return true
  },
}) as PrismaClient

/** Apakah Prisma Client saat ini memiliki model tertentu (mis. 'user', 'backupHistory')? */
export function prismaModelExists(name: string): boolean {
  try {
    return Boolean((current as unknown as Record<string, unknown>)[name])
  } catch {
    return false
  }
}

/**
 * Muat ulang PrismaClient dari node_modules aplikasi (setelah `prisma generate`
 * dijalankan pihak pemanggil). Mengembalikan true bila instance berhasil ditukar.
 */
export function recreatePrismaClient(): boolean {
  try {
    const root = getAppRoot()
    if (!root) {
      console.error('[db] recreatePrismaClient: root aplikasi tidak ditemukan')
      return false
    }
    const req = createRequire(path.join(root, 'package.json'))
    const cache = (req as unknown as { cache?: Record<string, unknown> }).cache
    if (cache && typeof cache === 'object') {
      for (const key of Object.keys(cache)) {
        if (/@prisma[\\/]client|\.prisma[\\/]client|\.prisma[\\/]/.test(key)) delete cache[key]
      }
    }
    const fresh = req('@prisma/client') as { PrismaClient?: new (opts: unknown) => PrismaClient }
    const Ctor = fresh?.PrismaClient
    if (typeof Ctor !== 'function') {
      console.error('[db] recreatePrismaClient: PrismaClient tidak ditemukan pada modul hasil muat ulang')
      return false
    }
    current = new Ctor(clientOptions())
    return true
  } catch (e) {
    console.error('[db] recreatePrismaClient gagal:', (e as Error).message)
    return false
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
