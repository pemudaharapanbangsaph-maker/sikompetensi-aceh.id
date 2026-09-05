/**
 * ZIP writer & reader MINIMAL (pure JavaScript) untuk fitur Backup & Restore.
 *
 * MENGAPA PAKAI IMPLEMENTASI SENDIRI?
 * - Shared hosting (Hostinger/Passenger) tidak menjamin binary `zip`/`unzip`
 *   tersedia untuk user hosting bersama; mysqldump & mysql SUDAH dipakai kode
 *   backup yang ada (pola developer), tapi menambah dependensi CLI baru berisiko.
 * - Tidak menambah package npm baru (instalasi di Hostinger harus tetap ringan).
 *
 * FITUR:
 * - createZip(): membuat arsip ZIP metode STORE (tanpa kompresi — file PDF/JPG
 *   memang sudah terkompresi, jadi aman & cepat).
 * - readZip(): membaca arsip ZIP (metode STORE=0 dan DEFLATE=8 via zlib).
 * - Anti ZIP-SLIP: nama entry dibersihkan (menolak path absolut / ".." / drive).
 *
 * FORMAT yang ditulis kompatibel penuh dengan utilitas zip standar
 * (unzip / 7-zip / File Manager Hostinger), dan sebaliknya readZip() bisa
 * membaca zip buatan utilitas standar.
 */

import * as zlib from 'zlib'

export interface ZipEntry {
  name: string
  data: Buffer
}

// ---------------------------------------------------------------------------
// CRC32 (IEEE 802.3, polynomial 0xEDB88320)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ---------------------------------------------------------------------------
// Waktu modifikasi (DOS format)
// ---------------------------------------------------------------------------
function dosTimeDate(d: Date): { time: number; date: number } {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f)
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f)
  return { time: time & 0xffff, date: date & 0xffff }
}

const EOCD_SIGNATURE = 0x06054b50
const CDH_SIGNATURE = 0x02014b50
const LFH_SIGNATURE = 0x04034b50

/**
 * Buat arsip ZIP (metode STORE) dari daftar entry.
 * Nama entry disanitasi: forward-slash, tanpa leading "/", tanpa "..".
 */
export function createZip(entries: ZipEntry[], mtime = new Date()): Buffer {
  const { time, date } = dosTimeDate(mtime)
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBuf = Buffer.from(sanitizeEntryName(entry.name), 'utf-8')
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data)
    const crc = crc32(data)

    // ---- Local File Header ----
    const lfh = Buffer.alloc(30)
    lfh.writeUInt32LE(LFH_SIGNATURE, 0)
    lfh.writeUInt16LE(20, 4) // version needed: 2.0
    lfh.writeUInt16LE(0x0800, 6) // flag: UTF-8 filename
    lfh.writeUInt16LE(0, 8) // method: STORE
    lfh.writeUInt16LE(time, 10)
    lfh.writeUInt16LE(date, 12)
    lfh.writeUInt32LE(crc, 14)
    lfh.writeUInt32LE(data.length, 18) // compressed size
    lfh.writeUInt32LE(data.length, 22) // uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26)
    lfh.writeUInt16LE(0, 28) // extra length
    localParts.push(lfh, nameBuf, data)

    // ---- Central Directory Header ----
    const cdh = Buffer.alloc(46)
    cdh.writeUInt32LE(CDH_SIGNATURE, 0)
    cdh.writeUInt16LE(0x031e, 4) // version made by: unix, zip 3.0
    cdh.writeUInt16LE(20, 6) // version needed
    cdh.writeUInt16LE(0x0800, 8) // flag: UTF-8
    cdh.writeUInt16LE(0, 10) // method: STORE
    cdh.writeUInt16LE(time, 12)
    cdh.writeUInt16LE(date, 14)
    cdh.writeUInt32LE(crc, 16)
    cdh.writeUInt32LE(data.length, 20)
    cdh.writeUInt32LE(data.length, 24)
    cdh.writeUInt16LE(nameBuf.length, 28)
    cdh.writeUInt16LE(0, 30) // extra
    cdh.writeUInt16LE(0, 32) // comment
    cdh.writeUInt16LE(0, 34) // disk number
    cdh.writeUInt16LE(0, 36) // internal attrs
    cdh.writeUInt32LE(0o644 << 16, 38) // external attrs: unix -rw-r--r--
    cdh.writeUInt32LE(offset, 42) // offset local header
    centralParts.push(cdh, nameBuf)

    offset += 30 + nameBuf.length + data.length
  }

  const centralSize = centralParts.reduce((n, b) => n + b.length, 0)

  // ---- End of Central Directory ----
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(EOCD_SIGNATURE, 0)
  eocd.writeUInt16LE(0, 4) // disk
  eocd.writeUInt16LE(0, 6) // cd disk
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(offset, 16) // cd offset
  eocd.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...localParts, ...centralParts, eocd])
}

/**
 * Bersihkan nama entry: tolak path absolut / ".." / backslash / karakter aneh.
 * Melempar Error bila nama mencoba keluar dari root arsip (zip-slip).
 */
export function sanitizeEntryName(name: string): string {
  const norm = String(name || '').replace(/\\/g, '/').trim()
  if (!norm) throw new Error('Nama entry ZIP kosong')
  if (norm.includes('\0')) throw new Error('Nama entry ZIP mengandung karakter NUL')
  if (/^[a-zA-Z]:/.test(norm)) throw new Error(`Nama entry ZIP tidak boleh path drive Windows: ${name}`)
  const stripped = norm.replace(/^\/+/, '')
  const bad = stripped.split('/').some((seg) => seg === '..')
  if (bad) throw new Error(`Nama entry ZIP mencurigakan (indikasi zip-slip): ${name}`)
  // tolak karakter kontrol lain
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(stripped)) throw new Error('Nama entry ZIP mengandung karakter kontrol')
  return stripped
}

/**
 * Baca arsip ZIP → daftar entry.
 * Mendukung STORE (0) dan DEFLATE (8). Entri direktori (berakhiran "/") dilewati.
 * Entri dengan nama mencurigakan (zip-slip) DILEWATI dengan peringatan console.
 */
export function readZip(buf: Buffer): ZipEntry[] {
  if (!buf || buf.length < 22) throw new Error('File ZIP kosong / tidak valid')

  // ---- cari EOCD dari belakang (komentar maks 65535 byte) ----
  let eocdOff = -1
  const minStart = Math.max(0, buf.length - 22 - 65535)
  for (let i = buf.length - 22; i >= minStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocdOff = i
      break
    }
  }
  if (eocdOff < 0) throw new Error('Signature EOCD ZIP tidak ditemukan (bukan file ZIP?)')

  const totalEntries = buf.readUInt16LE(eocdOff + 10)
  const cdOffset = buf.readUInt32LE(eocdOff + 16)

  const out: ZipEntry[] = []
  let p = cdOffset
  for (let i = 0; i < totalEntries; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CDH_SIGNATURE) {
      throw new Error('Central directory ZIP rusak')
    }
    const method = buf.readUInt16LE(p + 10)
    const crc = buf.readUInt32LE(p + 16)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const lfhOffset = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf-8', p + 46, p + 46 + nameLen)
    p += 46 + nameLen + extraLen + commentLen

    if (name.endsWith('/')) continue // entry direktori

    // ---- baca local file header untuk extra length lokal ----
    if (lfhOffset + 30 > buf.length || buf.readUInt32LE(lfhOffset) !== LFH_SIGNATURE) {
      throw new Error('Local header ZIP rusak')
    }
    const lNameLen = buf.readUInt16LE(lfhOffset + 26)
    const lExtraLen = buf.readUInt16LE(lfhOffset + 28)
    const dataStart = lfhOffset + 30 + lNameLen + lExtraLen
    const raw = buf.subarray(dataStart, dataStart + compSize)

    let data: Buffer
    if (method === 0) data = Buffer.from(raw)
    else if (method === 8) data = zlib.inflateRawSync(raw)
    else throw new Error(`Metode kompresi ZIP tidak didukung (${method}) pada entry: ${name}`)

    if (crc32(data) !== crc) throw new Error(`CRC tidak cocok pada entry ZIP: ${name}`)

    try {
      out.push({ name: sanitizeEntryName(name), data })
    } catch (e) {
      console.warn('[backup-zip] Entry dilewati karena nama tidak aman:', name, e)
    }
  }
  return out
}
