import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'
import crypto from 'crypto'

const baseUploadDir = process.env.UPLOAD_DIR?.trim()

if (!baseUploadDir && process.env.NODE_ENV === 'production') {
  throw new Error('UPLOAD_DIR belum dikonfigurasi')
}

const UPLOAD_DIR = path.join(
  baseUploadDir || path.join(process.cwd(), 'uploads-sikompetensi'),
  'pendaftaran'
)
const ALLOWED_TIPE = ['KTP', 'SURAT_TUGAS', 'NPWP', 'REK_BANK']
const ALLOWED_EXT = ['.pdf']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

const TIPE_LABEL: Record<string, string> = {
  KTP: 'KTP',
  SURAT_TUGAS: 'Surat Tugas',
  NPWP: 'NPWP',
  REK_BANK: 'REK Bank Aceh',
}

// Token upload berlaku 24 jam
const UPLOAD_TOKEN_EXPIRY = 24 * 60 * 60 * 1000

function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  }
}

function verifyUploadToken(pendaftaranId: string, token: string): boolean {
  const secret = process.env.SESSION_SECRET || 'fallback-secret-change-me'
  const [timestampStr, hash] = token.split('.')
  if (!timestampStr || !hash) return false

  // Cek expiry (24 jam)
  const timestamp = parseInt(timestampStr, 36)
  if (Date.now() - timestamp > UPLOAD_TOKEN_EXPIRY) return false

  // Verifikasi hash
  const raw = `${pendaftaranId}:${secret}:${timestampStr}`
  const expectedHash = crypto.createHash('sha256').update(raw).digest('hex')
  return hash === expectedHash
}

// Fungsi untuk generate token upload (dipanggil saat pendaftaran dibuat)
export function generateUploadToken(pendaftaranId: string): string {
  const secret = process.env.SESSION_SECRET || 'fallback-secret-change-me'
  const timestamp = Date.now().toString(36)
  const raw = `${pendaftaranId}:${secret}:${timestamp}`
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return `${timestamp}.${hash}`
}

export async function POST(req: Request) {
  try {
    ensureDir()

    const formData = await req.formData()
    const pendaftaranId = formData.get('pendaftaranId') as string
    const tipe = formData.get('tipe') as string
    const file = formData.get('file') as File | null
    const uploadToken = formData.get('uploadToken') as string

    if (!pendaftaranId) return NextResponse.json({ error: 'ID pendaftaran diperlukan' }, { status: 400 })
    if (!tipe || !ALLOWED_TIPE.includes(tipe)) {
      return NextResponse.json({ error: `Tipe dokumen tidak valid. Pilih: ${ALLOWED_TIPE.join(', ')}` }, { status: 400 })
    }
    if (!file) return NextResponse.json({ error: 'File diperlukan' }, { status: 400 })

    // VERIFIKASI TOKEN UPLOAD — cegah upload tanpa otorisasi
    if (!uploadToken || !verifyUploadToken(pendaftaranId, uploadToken)) {
      return NextResponse.json({ error: 'Token upload tidak valid atau sudah kadaluarsa' }, { status: 403 })
    }

    // Validasi tipe file
    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: 'Format file harus PDF' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 5MB' }, { status: 400 })
    }

    // Cek pendaftaran ada
    const pendaftaran = await db.pendaftaranPortal.findUnique({ where: { id: pendaftaranId } })
    if (!pendaftaran) {
      return NextResponse.json({ error: 'Pendaftaran tidak ditemukan' }, { status: 404 })
    }

    // Hapus file lama jika ada (replace)
    const existingDoc = await db.dokumenPendaftaran.findUnique({
      where: { pendaftaranId_tipe: { pendaftaranId, tipe } },
    })
    if (existingDoc && existingDoc.filePath) {
      try { fs.unlinkSync(existingDoc.filePath) } catch { /* ignore */ }
    }

    // Simpan file
    const safeName = `${pendaftaranId}_${tipe}${ext}`
    const filePath = path.join(UPLOAD_DIR, safeName)
    const bytes = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, bytes)

    const ukuranKB = (file.size / 1024).toFixed(1)

    // Upsert ke database
    const doc = await db.dokumenPendaftaran.upsert({
      where: { pendaftaranId_tipe: { pendaftaranId, tipe } },
      create: {
        pendaftaranId,
        tipe,
        namaFile: file.name,
        ukuranFile: `${ukuranKB} KB`,
        filePath,
      },
      update: {
        namaFile: file.name,
        ukuranFile: `${ukuranKB} KB`,
        filePath,
      },
    })

    return NextResponse.json({
      success: true,
      dokumen: { tipe: doc.tipe, namaFile: doc.namaFile, ukuranFile: doc.ukuranFile },
      message: `${TIPE_LABEL[tipe]} berhasil diupload`,
    })
  } catch (e) {
    console.error('portal upload dokumen error:', e)
    return NextResponse.json({ error: 'Gagal mengupload dokumen' }, { status: 500 })
  }
}
