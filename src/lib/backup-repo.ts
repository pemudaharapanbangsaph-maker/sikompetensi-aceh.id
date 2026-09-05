/**
 * REPOSITORY BackupHistory BERBASIS mysql2 — 100% BEBAS PRISMA.
 *
 * LATAR BELAKANG (kejadian nyata di produksi Hostinger):
 * Route backup lama memakai `db.backupHistory.findMany/create/...` (Prisma).
 * Ketika Prisma Client yang termuat di proses runtime TIDAK memiliki model
 * (client "stub" karena `prisma generate` tidak berjalan pada node_modules
 * runtime, atau node_modules dari skema lama), `db.backupHistory` bernilai
 * `undefined` → TypeError "Cannot read properties of undefined (reading
 * 'findMany')" → seluruh halaman Backup 500 ("gagal memuat backup", "gagal
 * membuat backup").
 *
 * SOLUSI:
 * Semua akses tabel BackupHistory + daftar file upload (untuk menyusun zip
 * backup) kini memakai mysql2 SECARA LANGSUNG (paket sudah ada di dependencies,
 * koneksi dari DATABASE_URL yang sama) — TIDAK bergantung pada hasil
 * `prisma generate` sama sekali. Fitur backup tetap berfungsi penuh apa pun
 * kondisi Prisma Client-nya.
 *
 * - Koneksi per operasi, singkat (ramah batas koneksi shared hosting).
 * - Parameterized query (aman injeksi); nama tabel/kolom konstanta dengan backtick.
 * - Tabel & kolom dibuat/dilengkapi otomatis (idempotent) — definisi kolom
 *   IDENTIK dengan model BackupHistory di prisma/schema.prisma dan dengan
 *   ensure-schema.ts (tanpa FOREIGN KEY agar tetap berhasil dibuat walau
 *   tabel User bermasalah — query tidak membutuhkan FK).
 * - Bentuk baris hasil (nama kolom camelCase, createdAt sebagai Date)
 *   SAMA PERSIS dengan keluaran Prisma findMany → bentuk respons API tidak berubah.
 */
import { createConnection } from 'mysql2/promise'

export interface BackupHistoryRow {
  id: string
  namaFile: string
  ukuran: string
  tipe: string
  status: string
  dibuatOleh: string | null
  catatan: string | null
  createdAt: Date
}

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

function parseDbUrl(): { host: string; port: number; user: string; password: string; database: string } {
  const url = process.env.DATABASE_URL || ''
  // mysql://user:password@host:port/database (format yang sama dengan route restore)
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  if (!match) throw new Error('DATABASE_URL format tidak valid untuk MySQL')
  return {
    host: match[3],
    port: Number(match[4]) || 3306,
    user: match[1],
    password: match[2],
    database: match[5].split('?')[0],
  }
}

/** Buka koneksi mysql2 singkat untuk satu operasi lalu tutup. */
async function withConnection<T>(fn: (conn: { query: (sql: string, params?: unknown[]) => Promise<[unknown, unknown]> }) => Promise<T>): Promise<T> {
  const cfg = parseDbUrl()
  const conn = await createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectTimeout: 15000,
  })
  try {
    return await fn(conn as unknown as { query: (sql: string, params?: unknown[]) => Promise<[unknown, unknown]> })
  } finally {
    try { await conn.end() } catch { /* abaikan galat penutupan */ }
  }
}

// ---------------------------------------------------------------------------
// SELF-HEALING TABEL (idempotent, memo per proses; gagal tidak di-memo)
// ---------------------------------------------------------------------------
let tableEnsured = false

export async function ensureBackupTableMysql(): Promise<void> {
  if (tableEnsured) return
  await withConnection(async (conn) => {
    const [tables] = await conn.query("SHOW TABLES LIKE 'BackupHistory'")
    if (!Array.isArray(tables) || tables.length === 0) {
      const cols = Object.entries(BACKUP_HISTORY_COLUMNS).map(([, def]) => def).join(', ')
      await conn.query(`CREATE TABLE IF NOT EXISTS \`BackupHistory\` (${cols}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
      console.log('[backup-repo] Tabel `BackupHistory` berhasil dibuat (mysql2)')
    }
    const [colsRows] = await conn.query('SHOW COLUMNS FROM `BackupHistory`')
    const present = new Set((Array.isArray(colsRows) ? colsRows : []).map((c) => String((c as { Field?: string }).Field)))
    for (const [name, def] of Object.entries(BACKUP_HISTORY_COLUMNS)) {
      if (!present.has(name)) {
        await conn.query(`ALTER TABLE \`BackupHistory\` ADD COLUMN ${def}`)
        console.log(`[backup-repo] Kolom \`${name}\` pada BackupHistory berhasil ditambahkan (mysql2)`)
      }
    }
  })
  tableEnsured = true
}

function normalizeRow(r: Record<string, unknown>): BackupHistoryRow {
  return {
    id: String(r.id ?? ''),
    namaFile: String(r.namaFile ?? ''),
    ukuran: String(r.ukuran ?? ''),
    tipe: String(r.tipe ?? 'MANUAL'),
    status: String(r.status ?? 'BERHASIL'),
    dibuatOleh: r.dibuatOleh == null ? null : String(r.dibuatOleh),
    catatan: r.catatan == null ? null : String(r.catatan),
    createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt ?? Date.now())),
  }
}

/** Daftar seluruh riwayat backup (terbaru dulu) — padanan findMany Prisma. */
export async function listBackupHistory(): Promise<BackupHistoryRow[]> {
  await ensureBackupTableMysql()
  return withConnection(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM `BackupHistory` ORDER BY `createdAt` DESC')
    return (Array.isArray(rows) ? rows : []).map((r) => normalizeRow(r as Record<string, unknown>))
  })
}

function genId(): string {
  // padanan cuid (≤30 char): c + waktu base36 + acak
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

/** Catat riwayat backup baru — padanan create Prisma. */
export async function createBackupHistory(input: {
  namaFile: string
  ukuran: string
  tipe?: string
  status?: string
  dibuatOleh?: string | null
  catatan?: string | null
}): Promise<BackupHistoryRow> {
  await ensureBackupTableMysql()
  const row: BackupHistoryRow = {
    id: genId(),
    namaFile: input.namaFile,
    ukuran: input.ukuran,
    tipe: input.tipe || 'MANUAL',
    status: input.status || 'BERHASIL',
    dibuatOleh: input.dibuatOleh ?? null,
    catatan: input.catatan ?? null,
    createdAt: new Date(),
  }
  await withConnection(async (conn) => {
    await conn.query(
      'INSERT INTO `BackupHistory` (`id`, `namaFile`, `ukuran`, `tipe`, `status`, `dibuatOleh`, `catatan`, `createdAt`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [row.id, row.namaFile, row.ukuran, row.tipe, row.status, row.dibuatOleh, row.catatan, row.createdAt]
    )
  })
  return row
}

/** Ambil satu riwayat backup — padanan findUnique Prisma. */
export async function getBackupHistoryById(id: string): Promise<BackupHistoryRow | null> {
  await ensureBackupTableMysql()
  return withConnection(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM `BackupHistory` WHERE `id` = ? LIMIT 1', [id])
    const list = Array.isArray(rows) ? rows : []
    return list.length ? normalizeRow(list[0] as Record<string, unknown>) : null
  })
}

/** Hapus satu riwayat backup — padanan delete Prisma. */
export async function deleteBackupHistory(id: string): Promise<void> {
  await ensureBackupTableMysql()
  await withConnection(async (conn) => {
    await conn.query('DELETE FROM `BackupHistory` WHERE `id` = ?', [id])
  })
}

// ---------------------------------------------------------------------------
// DAFTAR FILE UPLOAD UNTUK ZIP BACKUP — bebas Prisma (dulu db.X.findMany)
// ---------------------------------------------------------------------------
/** Semua path file Sertifikat yang tercatat di DB (null dilewati). */
export async function listSertifikatFilePaths(): Promise<string[]> {
  return withConnection(async (conn) => {
    const [rows] = await conn.query('SELECT `file` FROM `Sertifikat` WHERE `file` IS NOT NULL')
    return (Array.isArray(rows) ? rows : []).map((r) => String((r as { file: string }).file))
  })
}

/** Semua path file Surat Tugas yang tercatat di DB (null dilewati). */
export async function listSuratTugasFilePaths(): Promise<string[]> {
  return withConnection(async (conn) => {
    const [rows] = await conn.query('SELECT `file` FROM `SuratTugas` WHERE `file` IS NOT NULL')
    return (Array.isArray(rows) ? rows : []).map((r) => String((r as { file: string }).file))
  })
}

/** Semua path dokumen pendaftar portal yang tercatat di DB. */
export async function listDokumenPendaftaranPaths(): Promise<string[]> {
  return withConnection(async (conn) => {
    const [rows] = await conn.query('SELECT `filePath` FROM `DokumenPendaftaran` WHERE `filePath` IS NOT NULL')
    return (Array.isArray(rows) ? rows : []).map((r) => String((r as { filePath: string }).filePath))
  })
}
