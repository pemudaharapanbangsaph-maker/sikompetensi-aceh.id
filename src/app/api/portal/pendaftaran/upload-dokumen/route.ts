import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'

const UPLOAD_DIR = '/data/uploads/pendaftaran'
const ALLOWED_TIPE = ['KTP', 'SURAT_TUGAS', 'NPWP', 'REK_BANK']
const ALLOWED_EXT = ['.pdf']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

const TIPE_LABEL: Record<string, string> = {
  KTP: 'KTP',
  SURAT_TUGAS: 'Surat Tugas',
  NPWP: 'NPWP',
  REK_BANK: 'REK Bank Aceh',
}

// Pastikan folder upload ada
function ensureDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  }
}

export async function POST(req: Request) {
  try {
    ensureDir()

    const formData = await req.formData()
    const pendaftaranId = formData.get('pendaftaranId') as string
    const tipe = formData.get('tipe') as string
    const file = formData.get('file') as File | null

    if (!pendaftaranId) return NextResponse.json({ error: 'ID pendaftaran diperlukan' }, { status: 400 })
    if (!tipe || !ALLOWED_TIPE.includes(tipe)) {
      return NextResponse.json({ error: `Tipe dokumen tidak valid. Pilih: ${ALLOWED_TIPE.join(', ')}` }, { status: 400 })
    }
    if (!file) return NextResponse.json({ error: 'File diperlukan' }, { status: 400 })

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
