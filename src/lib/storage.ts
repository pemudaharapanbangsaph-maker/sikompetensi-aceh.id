import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'

/**
 * Resolver jalur file upload yang aman untuk shared hosting (mis. Hostinger / Passenger).
 *
 * MASALAH YANG DISELESAIKAN:
 * Route lama membangun path absolut file dengan `path.join(process.cwd(), pathRelatif)`,
 * sedangkan database hanya menyimpan path RELATIF (mis. `uploads/sertifikat/uuid.pdf`).
 * Setelah redeploy / restart di Hostinger, `process.cwd()` pada proses yang berjalan
 * TIDAK selalu sama dengan direktori saat file diupload (Passenger dapat menjalankan
 * aplikasi dari direktori kerja yang berbeda). Akibatnya file yang benar-benar ada di
 * server tidak ditemukan -> fs.readFile melempar error -> HTTP 500 saat download,
 * padahal file terlihat ada di File Manager.
 *
 * STRATEGI (100% kompatibel mundur, TIDAK mengubah format data di database):
 * - BACA  : cari file pada beberapa direktori dasar kandidat, berurutan:
 *     1. path tersimpan apa adanya jika absolut (gaya route portal pendaftaran)
 *     2. UPLOAD_DIR (env opsional) + path relatif  -> lokasi persisten di luar app
 *     3. direktori entrypoint server (server.mjs) + path relatif  -> anchor stabil
 *     4. process.cwd() + path relatif  -> perilaku lama
 *     5. fallback: <root>/<moduleDir>/<nama file> (menutup pola UPLOAD_DIR/sertifikat)
 * - TULIS : UPLOAD_DIR (jika diset) -> direktori server.mjs -> process.cwd().
 *   Path relatif yang disimpan ke database TETAP `uploads/<moduleDir>/<file>`.
 *
 * variabel env:
 * - UPLOAD_DIR (opsional): direktori persisten di luar folder aplikasi, contoh di
 *   Hostinger: /home/u123456789/uploads-sikompetensi
 *   (nama yang sama persis dengan yang dipakai route portal/pendaftaran/upload-dokumen)
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR?.trim() || ''

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

/**
 * Direktori tempat file entrypoint (server.mjs / next) dijalankan.
 * Hanya dianggap valid jika di dalamnya ada package.json (menandakan direktori aplikasi,
 * bukan direktori internal node_modules/.bin saat mode development).
 */
function getServerDir(): string | null {
  try {
    const entry = process.argv?.[1]
    if (!entry) return null
    const dir = path.dirname(path.isAbsolute(entry) ? entry : path.resolve(entry))
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir
    return null
  } catch {
    return null
  }
}

/** Daftar direktori dasar kandidat saat MEMBACA file upload. */
export function getStorageRoots(): string[] {
  const roots: (string | null)[] = [
    UPLOAD_DIR || null,
    getServerDir(),
    process.cwd() || null,
  ]
  return unique(roots.filter((r): r is string => Boolean(r)))
}

export interface ResolvedFile {
  /** Path absolut file yang ditemukan (null jika tidak ditemukan). */
  path: string | null
  /** Semua path absolut yang sudah dicoba — dipakai untuk pesan diagnosa. */
  tried: string[]
}

/**
 * Cari file upload di semua lokasi kandidat.
 * @param storedPath  path yang tersimpan di database (relatif maupun absolut)
 * @param moduleDir   nama subfolder modul (mis. 'sertifikat', 'surat-tugas')
 *                    untuk kandidat fallback <root>/<moduleDir>/<nama file>
 */
export function resolveStoredFile(storedPath: string, moduleDir?: string): ResolvedFile {
  const tried: string[] = []
  const norm = String(storedPath || '').trim().replace(/\\/g, '/')

  if (!norm) return { path: null, tried }

  // 1) Path absolut tersimpan apa adanya
  if (path.isAbsolute(norm)) {
    tried.push(norm)
    if (isFile(norm)) return { path: norm, tried: unique(tried) }
  }

  const rel = norm.replace(/^\/+/, '')
  const roots = getStorageRoots()
  const baseName = path.basename(rel)

  if (rel) {
    // 2-4) <root> + path relatif untuk semua root kandidat
    for (const root of roots) {
      const p = path.join(root, rel)
      tried.push(p)
      if (isFile(p)) return { path: p, tried: unique(tried) }
    }

    // 5) Fallback: <root>/<moduleDir>/<nama file>
    if (moduleDir) {
      for (const root of roots) {
        const p = path.join(root, moduleDir, baseName)
        tried.push(p)
        if (isFile(p)) return { path: p, tried: unique(tried) }
      }
    }
  }

  return { path: null, tried: unique(tried) }
}

/** Direktori dasar untuk MENULIS file upload baru. */
export function getWriteRoot(): string {
  if (UPLOAD_DIR) return UPLOAD_DIR
  const serverDir = getServerDir()
  if (serverDir) return serverDir
  return process.cwd()
}

/**
 * Pastikan direktori upload ada dan kembalikan path absolutnya.
 * (menggantikan ensureUploadDir() lama yang memakai process.cwd() mentah)
 */
export async function getUploadDir(moduleDir: string): Promise<string> {
  const dir = path.join(getWriteRoot(), 'uploads', moduleDir)
  await fsp.mkdir(dir, { recursive: true })
  return dir
}

/** Path relatif yang disimpan ke database — format TIDAK berubah. */
export function storedRelativePath(moduleDir: string, fileName: string): string {
  return `uploads/${moduleDir}/${fileName}`
}

/** Hapus file upload (best effort) di lokasi manapun ditemukan. */
export async function safeUnlinkStored(storedPath: string, moduleDir?: string): Promise<void> {
  try {
    const { path: p } = resolveStoredFile(storedPath, moduleDir)
    if (p) await fsp.unlink(p)
  } catch {
    /* abaikan — sama seperti perilaku lama */
  }
}
