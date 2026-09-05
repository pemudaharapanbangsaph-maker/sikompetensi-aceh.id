/**
 * Backup & Restore FILE UPLOAD fisik (bukan hanya database).
 *
 * MASALAH YANG DISELESAIKAN:
 * Backup lama hanya menjalankan mysqldump (.sql). File fisik sertifikat /
 * surat tugas / dokumen pendaftaran TIDAK ikut. Saat data sertifikat dihapus
 * (file fisik ikut terhapus oleh safeUnlinkStored) lalu database direstore,
 * baris data kembali tapi FILE-nya hilang → download 404 FILE_NOT_FOUND.
 *
 * SOLUSI:
 * - buildBackupZip(sqlDump): satu file ZIP berisi:
 *     database.sql        → dump MySQL utuh (dari mysqldump)
 *     files/uploads/...   → file Sertifikat & SuratTugas (path relatif persis
 *                           seperti tersimpan di kolom `file`)
 *     files/pendaftaran/… → dokumen pendaftar portal (nama file unik
 *                           <pendaftaranId>_<tipe>.<ext>, ditulis kembali ke
 *                           <UPLOAD_DIR>/pendaftaran/ seperti route portal)
 *     manifest.json       → info backup (jumlah file, waktu, daftar file yang
 *                           hilang saat backup dibuat)
 * - applyBackupZip(buffer): baca ZIP hasil backup → kembalikan SQL + tulis
 *   ulang semua file ke lokasi penyimpanan persisten (UPLOAD_DIR / fallback).
 *
 * LOKASI PENYIMPANAN BACKUP (durable, selamat dari redeploy Hostinger):
 * - UPLOAD_DIR terpasang → <UPLOAD_DIR>/backups   (DI LUAR folder aplikasi)
 * - tidak terpasang     → <direktori server.mjs>/db/backups (perilaku lama)
 * - resolveBackupFile() mencari file backup di banyak lokasi kandidat
 *   (UPLOAD_DIR/backups, db/backups di cwd/serverDir, dan folder versi deploy
 *   LAMA hbuilds/versions/* — supaya backup lama tetap ketemu pasca-redeploy).
 *
 * Database & format path DI DATABASE TIDAK DIUBAH SAMA SEKALI.
 */

import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import { db } from '@/lib/db'
import { resolveStoredFile, getStorageRoots, getWriteRoot, versionSiblingRoots } from '@/lib/storage'
import { createZip, readZip, type ZipEntry } from '@/lib/backup-zip'

export const SQL_ENTRY_NAME = 'database.sql'
const MANIFEST_ENTRY_NAME = 'manifest.json'
const FILES_PREFIX = 'files/'

// ---------------------------------------------------------------------------
// Lokasi penyimpanan backup (durable)
// ---------------------------------------------------------------------------
const UPLOAD_DIR = process.env.UPLOAD_DIR?.trim() || ''

/** Direktori utama menyimpan file backup baru. */
export function getBackupDir(): string {
  if (UPLOAD_DIR) return path.join(UPLOAD_DIR, 'backups')
  const root = getWriteRoot()
  return path.join(root, 'db', 'backups')
}

export async function ensureBackupDir(): Promise<string> {
  const dir = getBackupDir()
  await fsp.mkdir(dir, { recursive: true })
  return dir
}

export interface ResolvedBackupFile {
  path: string | null
  tried: string[]
}

/**
 * Cari file backup (mis. backup_xxx.zip / backup_yyy.sql) di semua lokasi:
 * <UPLOAD_DIR>/backups → <cwd>/db/backups → <serverDir>/db/backups →
 * folder versi deploy LAMA (hbuilds/versions/*)/db/backups.
 */
export function resolveBackupFile(namaFile: string): ResolvedBackupFile {
  const tried: string[] = []
  const name = path.basename(String(namaFile || '').trim())
  if (!name) return { path: null, tried }

  const candidates: string[] = []
  if (UPLOAD_DIR) candidates.push(path.join(UPLOAD_DIR, 'backups', name))
  for (const root of getStorageRoots()) candidates.push(path.join(root, 'db', 'backups', name))
  for (const sib of versionSiblingRoots()) candidates.push(path.join(sib, 'db', 'backups', name))

  for (const p of Array.from(new Set(candidates))) {
    tried.push(p)
    try {
      if (fs.statSync(p).isFile()) return { path: p, tried }
    } catch {
      /* lanjut kandidat berikutnya */
    }
  }
  return { path: null, tried }
}

// ---------------------------------------------------------------------------
// MEMBUAT BACKUP ZIP
// ---------------------------------------------------------------------------
export interface BackupBuildResult {
  buffer: Buffer
  fileCount: number
  /** Kolom `file`/`filePath` di DB yang file fisiknya tidak ketemu saat backup. */
  missing: string[]
}

/**
 * Kumpulkan semua file upload yang tercatat di database, lalu susun entry ZIP.
 * - Sertifikat.file / SuratTugas.file: path relatif `uploads/...` (atau absolut
 *   gaya lama) → dicari via resolveStoredFile (mendukung UPLOAD_DIR, folder
 *   aplikasi, dan folder versi deploy lama) → masuk zip sebagai
 *   files/uploads/... sesuai path relatif yang tersimpan di DB.
 * - DokumenPendaftaran.filePath: absolut di bawah UPLOAD_DIR/pendaftaran →
 *   masuk zip sebagai files/pendaftaran/<nama file>.
 */
async function collectUploadEntries(): Promise<{ entries: ZipEntry[]; missing: string[] }> {
  const entries: ZipEntry[] = []
  const missing: string[] = []

  const pushIfFound = async (storedPath: string | null | undefined, zipName: string) => {
    if (!storedPath || !String(storedPath).trim()) return
    const { path: resolved } = resolveStoredFile(String(storedPath))
    if (!resolved) {
      missing.push(String(storedPath))
      return
    }
    const data = await fsp.readFile(resolved)
    entries.push({ name: zipName, data })
  }

  // --- Sertifikat ---
  const sertifikatList = (await db.sertifikat.findMany({ select: { file: true } })) as { file: string | null }[]
  for (const s of sertifikatList) {
    const rel = normalizeToRelative(s.file)
    if (rel) await pushIfFound(s.file, `${FILES_PREFIX}${rel}`)
  }

  // --- Surat Tugas ---
  const suratList = (await db.suratTugas.findMany({ select: { file: true } })) as { file: string | null }[]
  for (const s of suratList) {
    const rel = normalizeToRelative(s.file)
    if (rel) await pushIfFound(s.file, `${FILES_PREFIX}${rel}`)
  }

  // --- Dokumen pendaftar portal (path absolut di bawah UPLOAD_DIR) ---
  const dokList = (await db.dokumenPendaftaran.findMany({ select: { filePath: true } })) as { filePath: string }[]
  for (const d of dokList) {
    if (!d.filePath) continue
    const rel = normalizeDokumenPath(d.filePath)
    if (rel) await pushIfFound(d.filePath, `${FILES_PREFIX}${rel}`)
  }

  return { entries, missing }
}

/**
 * Path relatif yang tersimpan di DB → nama entry zip yang aman.
 * `uploads/sertifikat/x.pdf` → `uploads/sertifikat/x.pdf`
 * Path absolut (gaya lama / dokumen) dikembalikan bagian relatifnya bila
 * berada di bawah salah satu root penyimpanan, atau null bila tak dikenali.
 */
function normalizeToRelative(stored: string | null | undefined): string | null {
  const norm = String(stored || '').trim().replace(/\\/g, '/')
  if (!norm) return null
  if (!norm.startsWith('/')) return norm.replace(/^\/+/, '')
  // absolut: cari segmen "uploads/" untuk modul sertifikat/surat-tugas
  const idx = norm.indexOf('/uploads/')
  if (idx >= 0) return norm.slice(idx + 1)
  return null
}

/**
 * Path absolut dokumen portal → `pendaftaran/<nama>` (relatif ke UPLOAD_DIR).
 * Dokumen portal selalu ditulis route upload ke <UPLOAD_DIR>/pendaftaran/,
 * jadi cukup ambil dua segmen terakhir.
 */
function normalizeDokumenPath(filePath: string | null | undefined): string | null {
  const norm = String(filePath || '').trim().replace(/\\/g, '/')
  if (!norm) return null
  const idx = norm.indexOf('/pendaftaran/')
  if (idx >= 0) {
    const rest = norm.slice(idx + 1) // pendaftaran/<nama>
    return rest.includes('/') ? rest : null
  }
  return null
}

/**
 * Bangun satu file backup ZIP lengkap: dump SQL + file upload + manifest.
 * @param sqlDump hasil mysqldump (string)
 */
export async function buildBackupZip(sqlDump: string): Promise<BackupBuildResult> {
  const { entries, missing } = await collectUploadEntries()

  const manifest = {
    app: 'sikompetensi-aceh',
    version: 1,
    createdAt: new Date().toISOString(),
    sqlEntry: SQL_ENTRY_NAME,
    fileCount: entries.length,
    missingFiles: missing,
  }

  const all: ZipEntry[] = [
    { name: SQL_ENTRY_NAME, data: Buffer.from(sqlDump, 'utf-8') },
    { name: MANIFEST_ENTRY_NAME, data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8') },
    ...entries,
  ]

  return { buffer: createZip(all), fileCount: entries.length, missing }
}

// ---------------------------------------------------------------------------
// MENERAPKAN BACKUP ZIP (RESTORE)
// ---------------------------------------------------------------------------
export interface BackupApplyResult {
  /** Isi dump SQL (entry *.sql, biasanya database.sql). Null bila tidak ada. */
  sql: string | null
  /** Nama-nama file upload yang berhasil ditulis ulang ke disk. */
  restoredFiles: string[]
  manifest: Record<string, unknown> | null
}

/**
 * Terapkan file backup ZIP:
 * 1. baca entry — entry `*.sql` dikembalikan sebagai string (untuk dieksekusi
 *    mysql CLI oleh route pemanggil),
 * 2. entry `files/uploads/...` ditulis ke <UPLOAD_DIR>/uploads/... (fallback
 *    write root bila UPLOAD_DIR kosong) — persis lokasi yang dicari resolver
 *    download, PATH RELATIF TIDAK BERUBAH,
 * 3. entry `files/pendaftaran/...` ditulis ke <UPLOAD_DIR>/pendaftaran/...
 *    (lokasi yang dibaca route portal via path absolut).
 * File yang sudah ada DITIMPA (restore = kembali ke kondisi backup).
 */
export async function applyBackupZip(buffer: Buffer): Promise<BackupApplyResult> {
  const entries = readZip(buffer)
  if (entries.length === 0) throw new Error('File ZIP kosong / tidak berisi entry')

  const sqlEntry = entries.find((e) => e.name === SQL_ENTRY_NAME) || entries.find((e) => e.name.toLowerCase().endsWith('.sql'))
  const manifestEntry = entries.find((e) => e.name === MANIFEST_ENTRY_NAME)

  let manifest: Record<string, unknown> | null = null
  if (manifestEntry) {
    try {
      manifest = JSON.parse(manifestEntry.data.toString('utf-8'))
    } catch {
      manifest = null
    }
  }

  const restoredFiles: string[] = []
  for (const e of entries) {
    if (e === sqlEntry || e === manifestEntry) continue
    if (!e.name.startsWith(FILES_PREFIX)) continue // entry tak dikenal → abaikan

    const rel = e.name.slice(FILES_PREFIX.length) // mis. uploads/sertifikat/x.pdf ATAU pendaftaran/y.pdf
    const base = UPLOAD_DIR || getWriteRoot()
    const dest = path.join(base, rel)
    await fsp.mkdir(path.dirname(dest), { recursive: true })
    await fsp.writeFile(dest, e.data)
    restoredFiles.push(rel)
  }

  return {
    sql: sqlEntry ? sqlEntry.data.toString('utf-8') : null,
    restoredFiles,
    manifest,
  }
}
