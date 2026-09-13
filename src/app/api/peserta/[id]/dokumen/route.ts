import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import { getUploadDir, storedRelativePath, safeUnlinkStored } from '@/lib/storage'
import * as fs from 'fs/promises'
import * as path from 'path'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const TIPE_DOKUMEN: Record<string, string> = {
  KTP: 'KTP',
  NPWP: 'NPWP',
  REK_BANK: 'Rekening Bank',
  SURAT_TUGAS: 'Surat Tugas',
  LAINNYA: 'Dokumen Lainnya',
}

// GET — list dokumen peserta
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const peserta = await db.peserta.findUnique({ where: { id } })
    if (!peserta) return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })

    const dokumen = await db.dokumenPeserta.findMany({
      where: { pesertaId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(dokumen)
  } catch (e) {
    console.error('dokumen peserta list error:', e)
    return NextResponse.json({ error: 'Gagal memuat dokumen peserta' }, { status: 500 })
  }
}

// POST — upload dokumen peserta
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let createdFilePath: string | null = null

  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const peserta = await db.peserta.findUnique({ where: { id } })
    if (!peserta) return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const tipe = (formData.get('tipe') as string) || 'LAINNYA'

    if (!file) {
      return NextResponse.json({ error: 'File wajib diupload' }, { status: 400 })
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: 'File kosong' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 })
    }

    const originalName = path.basename(file.name || '')
    const extension = path.extname(originalName).toLowerCase()
    if (!ALLOWED_EXT.includes(extension)) {
      return NextResponse.json({ error: `Format file harus: ${ALLOWED_EXT.join(', ')}` }, { status: 400 })
    }

    if (!TIPE_DOKUMEN[tipe]) {
      return NextResponse.json({ error: 'Tipe dokumen tidak valid' }, { status: 400 })
    }

    // Hapus dokumen lama dengan tipe yang sama (karena @@unique)
    const existing = await db.dokumenPeserta.findUnique({
      where: { pesertaId_tipe: { pesertaId: id, tipe } },
    })
    if (existing) {
      await safeUnlinkStored(existing.filePath, 'peserta')
      await db.dokumenPeserta.delete({ where: { id: existing.id } })
    }

    // Upload file baru
    const uploadDir = await getUploadDir('peserta')
    const uniqueName = `${crypto.randomUUID()}${extension}`
    createdFilePath = path.join(uploadDir, uniqueName)
    const bytes = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(createdFilePath, bytes)

    const storedPath = storedRelativePath('peserta', uniqueName)

    const item = await db.dokumenPeserta.create({
      data: {
        pesertaId: id,
        tipe,
        namaFile: originalName,
        ukuranFile: `${(file.size / 1024).toFixed(1)} KB`,
        filePath: storedPath,
      },
    })

    await auditLog(session, 'CREATE', 'DOKUMEN_PESERTA', `Upload dokumen ${TIPE_DOKUMEN[tipe]} untuk peserta: ${peserta.nama} (${peserta.nip})`, req)

    return NextResponse.json(item, { status: 201 })
  } catch (e) {
    if (createdFilePath) {
      try { await fs.unlink(createdFilePath) } catch {}
    }
    console.error('dokumen peserta upload error:', e)
    return NextResponse.json({ error: 'Gagal upload dokumen peserta' }, { status: 500 })
  }
}
