import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'

/**
 * Resolver jalur file upload yang aman untuk shared hosting (mis. Hostinger / Passenger).
 *
 * MASALAH YANG DISELESAIKAN (1):
 * Route lama membangun path absolut file dengan `path.join(process.cwd(), pathRelatif)`,
 * sedangkan database hanya menyimpan path RELATIF (mis. `uploads/sertifikat/uuid.pdf`).
 * Setelah redeploy / restart di Hostinger, `process.cwd()` pada proses yang berjalan
 * TIDAK selalu sama dengan direktori saat file diupload (Passenger dapat menjalankan
 * aplikasi dari direktori kerja yang berbeda). Akibatnya file yang benar-benar ada di
 * server tidak ditemukan -> fs.readFile melempar error -> HTTP 500 saat download,
 * padahal file terlihat ada di File Manager.
 *
 * MASALAH YANG DISELESAIKAN (2) — deploy ber-versi Hostinger ("hbuilds"):
 * Setiap deploy Hostinger membuat folder versi BARU:
 *   /home/uXXXX/domains/<domain>/hbuilds/versions/<uuid>/nodejs
 * File yang kebetulan terupload ke folder VERSI LAMA (mis. upload terjadi saat kode
 * lama masih aktif, atau env UPLOAD_DIR belum terbaca oleh proses) akan "hilang"
 * bagi aplikasi setelah redeploy berikutnya — padahal fisiknya masih ada di folder
 * versi lama yang disimpan Hostinger untuk rollback.
 * Solusi:
 *   a. Kandidat pencarian kini IKUT memindai folder versi-versi LAMA
 *      (saudara dari direktori aplikasi saat ini).
 *   b. resolveStoredFileDurable() menyalin file yang ditemukan di lokasi
 *      tidak-persisten ke UPLOAD_DIR (best effort) sehingga file selamat
 *      selamanya meski Hostinger menghapus folder versi lama.
 *
 * STRATEGI (100% kompatibel mundur, TIDAK mengubah format data di database):
 * - BACA  : cari file pada beberapa direktori dasar kandidat, berurutan:
 *     1. path tersimpan apa adanya jika absolut (gaya route portal pendaftaran)
 *     2. UPLOAD_DIR (env opsional) + path relatif  -> lokasi persisten di luar app
 *     3. direktori entrypoint server (server.mjs) + path relatif  -> anchor stabil
 *     4. process.cwd() + path relatif  -> perilaku lama
 *     5. BARU: folder versi deploy LAMA (hbuilds/versions/<uuid-lain>/...) + path relatif
 *     6. fallback: <root>/<moduleDir>/<nama file> untuk semua root di atas
 * - TULIS : UPLOAD_DIR (jika diset) -> direktori server.mjs -> process.cwd().
 *   Jika pilihan jatuh ke folder versi deploy (UPLOAD_DIR tidak terbaca), dicatat
 *   peringatan jelas di log server agar mudah didiagnosis.
 *   Path relatif yang disimpan ke database TETAP `uploads/<moduleDir>/<file>`.
 *
 * variabel env:
 * - UPLOAD_DIR (opsional): direktori persisten di luar folder aplikasi, contoh di
 *   Hostinger: /home/u123456789/uploads-sikompetensi
 *   (nama yang sama persis dengan yang dipakai route portal/pendaftaran/upload-dokumen)
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR?.trim() || ''

/** Pola folder versi Hostinger: .../hbuilds/versions/<uuid>[/nodejs] */
const VERSIONED_DEPLOY_RE = /hbuilds\/versions\/[^/]+/

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

/**
 * Folder versi deploy LAMA milik Hostinger (hbuilds/versions/<uuid-lain>/nodejs).
 *
 * Contoh: aplikasi berjalan di
 *   /home/u1/domains/x.com/hbuilds/versions/v-BARU/nodejs
 * maka kandidat tambahan yang dikembalikan antara lain
 *   /home/u1/domains/x.com/hbuilds/versions/v-LAMA/nodejs
 * (versi terbaru lebih dulu). Hanya dipakai ketika kandidat utama tidak menemukan
 * file — menyelamatkan file yang terupload ke folder versi sebelumnya.
 */
export function versionSiblingRoots(): string[] {
  const out: string[] = []
  const anchors: (string | null)[] = [getServerDir(), process.cwd()]
  for (const anchor of anchors) {
    if (!anchor) continue
    const norm = String(anchor).replace(/\\/g, '/')
    const m = norm.match(/^(.*\/hbuilds\/versions\/)([^/]+)(?:\/nodejs)?\/?$/)
    if (!m || !m[1] || !m[2]) continue
    const versionsRoot = m[1]
    let entries: string[]
    try {
      entries = fs.readdirSync(versionsRoot)
    } catch {
      continue
    }
    const sibs: { dir: string; mtime: number }[] = []
    for (const e of entries) {
      if (!e || e === m[2]) continue
      const nodejsDir = `${versionsRoot}${e}/nodejs`
      const plainDir = `${versionsRoot}${e}`
      let dir: string | null = null
      try {
        if (fs.statSync(nodejsDir).isDirectory()) dir = nodejsDir
      } catch {
        /* coba bentuk tanpa /nodejs */
      }
      if (!dir) {
        try {
          if (fs.statSync(plainDir).isDirectory()) dir = plainDir
        } catch {
          continue
        }
      }
      if (!dir) continue
      let mtime = 0
      try {
        mtime = fs.statSync(dir).mtimeMs
      } catch {
        /* abaikan */
      }
      sibs.push({ dir, mtime })
    }
    sibs.sort((a, b) => b.mtime - a.mtime) // versi lama terbaru dicoba lebih dulu
    for (const s of sibs.slice(0, 30)) out.push(s.dir)
  }
  return unique(out)
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
  const baseName = path.basename(rel)

  if (rel) {
    const primaryRoots = getStorageRoots()

    // 2-4) <root utama> + path relatif
    for (const root of primaryRoots) {
      const p = path.join(root, rel)
      tried.push(p)
      if (isFile(p)) return { path: p, tried: unique(tried) }
    }

    // 5) BARU: folder versi deploy LAMA (hbuilds/versions/*) + path relatif —
    //    menyelamatkan file yang terupload ke folder versi sebelumnya.
    const siblingRoots = versionSiblingRoots()
    for (const root of siblingRoots) {
      const p = path.join(root, rel)
      tried.push(p)
      if (isFile(p)) return { path: p, tried: unique(tried) }
    }

    // 6) Fallback: <root>/<moduleDir>/<nama file> (root utama + versi lama)
    if (moduleDir) {
      for (const root of [...primaryRoots, ...siblingRoots]) {
        const p = path.join(root, moduleDir, baseName)
        tried.push(p)
        if (isFile(p)) return { path: p, tried: unique(tried) }
      }
    }
  }

  return { path: null, tried: unique(tried) }
}

/**
 * Cari file upload LALU (bila ditemukan di lokasi tidak-persisten) salin otomatis
 * ke UPLOAD_DIR supaya selamat dari redeploy / pembersihan folder versi lama.
 * - Best effort: kalau penyalinan gagal, file tetap dilayani dari lokasi asal.
 * - Tidak mengubah data database sama sekali.
 * Dipakai oleh route download (sertifikat & surat tugas).
 */
export async function resolveStoredFileDurable(storedPath: string, moduleDir?: string): Promise<ResolvedFile> {
  const res = resolveStoredFile(storedPath, moduleDir)
  if (!res.path || !UPLOAD_DIR) return res

  // Sudah berada di lokasi persisten? Tidak perlu migrasi.
  const persisted = res.path === UPLOAD_DIR || res.path.startsWith(UPLOAD_DIR + path.sep)
  if (persisted) return res

  try {
    const norm = String(storedPath || '').trim().replace(/\\/g, '/')
    let targetRel: string
    if (!path.isAbsolute(norm) && norm.replace(/^\/+/, '')) {
      targetRel = norm.replace(/^\/+/, '')
    } else if (moduleDir) {
      targetRel = `${moduleDir}/${path.basename(res.path)}`
    } else {
      targetRel = path.basename(res.path)
    }
    const target = path.join(UPLOAD_DIR, targetRel)
    if (target === res.path) return res
    if (!isFile(target)) {
      await fsp.mkdir(path.dirname(target), { recursive: true })
      await fsp.copyFile(res.path, target)
      console.log(`[storage] File upload ditemukan di lokasi lama & dimigrasi otomatis ke lokasi persisten: ${target}`)
    }
    return { path: target, tried: unique([...res.tried, target]) }
  } catch (e) {
    // Best effort — kalau gagal menyalin, tetap layani dari lokasi asal.
    console.warn('[storage] Migrasi file ke UPLOAD_DIR gagal (tetap dipakai lokasi asal):', e)
    return res
  }
}

/** Direktori dasar untuk MENULIS file upload baru. */
export function getWriteRoot(): string {
  if (UPLOAD_DIR) return UPLOAD_DIR
  const serverDir = getServerDir()
  if (serverDir) return serverDir
  return process.cwd()
}

/**
 * Direktori ROOT APLIKASI (folder yang berisi package.json + prisma/schema.prisma).
 * Dipakai untuk menemukan node_modules/prisma (self-heal Prisma client) —
 * aman terhadap process.cwd() yang aneh di shared hosting.
 */
export function getAppRoot(): string | null {
  const seen = new Set<string>()
  const candidates: (string | null)[] = [getServerDir(), process.cwd()]
  for (const c of candidates) {
    let dir = c
    // naik maksimal 4 level (cwd bisa berada di dalam subfolder aplikasi)
    for (let i = 0; dir && i < 5; i++) {
      const norm = path.resolve(dir)
      if (seen.has(norm)) break
      seen.add(norm)
      try {
        if (fs.existsSync(path.join(norm, 'package.json')) && fs.existsSync(path.join(norm, 'prisma', 'schema.prisma'))) {
          return norm
        }
      } catch {
        /* lanjut kandidat berikutnya */
      }
      const parent = path.dirname(norm)
      if (parent === norm) break
      dir = parent
    }
  }
  return null
}

/**
 * Pastikan direktori upload ada dan kembalikan path absolutnya.
 * (menggantikan ensureUploadDir() lama yang memakai process.cwd() mentah)
 */
export async function getUploadDir(moduleDir: string): Promise<string> {
  const root = getWriteRoot()
  if (!UPLOAD_DIR && VERSIONED_DEPLOY_RE.test(String(root).replace(/\\/g, '/'))) {
    console.warn(
      `[storage] PERINGATAN: upload baru ditulis ke folder versi deploy (${root}) ` +
        'karena env UPLOAD_DIR tidak terbaca oleh proses ini. File berisiko tidak ditemukan ' +
        'setelah redeploy berikutnya — pastikan UPLOAD_DIR terisi di Hostinger (Environment Variables).'
    )
  }
  const dir = path.join(root, 'uploads', moduleDir)
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
