import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog } from '@/lib/auth'
import * as fs from 'fs/promises'
import * as path from 'path'
import crypto from 'crypto'

const ALLOWED_EXT = ['.pdf', '.doc', '.docx']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

async function ensureUploadDir() {
  await fs.mkdir(path.join(process.cwd(), 'uploads', 'surat-tugas'), { recursive: true })
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const item = await db.suratTugas.findUnique({
      where: { id },
      include: {
        peserta: { select: { id: true, nama: true, nip: true, jabatan: true, unitKerja: true, instansi: true } },
        pelatihan: { select: { id: true, nama: true, kode: true, kategori: true } },
        angkatan: {
          select: { id: true, namaAngkatan: true, tanggalMulai: true, tanggalSelesai: true, lokasi: true },
          include: { pelatihan: { select: { id: true, nama: true, kode: true } } },
        },
      },
    })
    if (!item) return NextResponse.json({ error: 'Surat tugas tidak ditemukan' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    console.error('surat-tugas get error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const existing = await db.suratTugas.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Surat tugas tidak ditemukan' }, { status: 404 })

    const contentType = req.headers.get('content-type') || ''
    let data: Record<string, unknown> = {}
    let newFilePath: string | null = null
    let newUkuranFile: string | null = null

    if (contentType.includes('multipart/form-data')) {
      // Update dengan file upload
      await ensureUploadDir()
      const fd = await req.formData()
      const file = fd.get('file') as File | null

      const allowedFields = ['nomor', 'perihal', 'penerima', 'pesertaId', 'pelatihanId', 'angkatanId', 'status', 'catatan']
      for (const field of allowedFields) {
        const val = fd.get(field) as string | null
        if (val !== null) data[field] = val
      }

      if (fd.get('tanggalSurat')) data.tanggalSurat = new Date(fd.get('tanggalSurat') as string)
      if (fd.get('tanggalMulai')) data.tanggalMulai = new Date(fd.get('tanggalMulai') as string)
      if (fd.get('tanggalSelesai')) data.tanggalSelesai = new Date(fd.get('tanggalSelesai') as string)

      // Handle file upload
      if (file) {
        const ext = path.extname(file.name).toLowerCase()
        if (!ALLOWED_EXT.includes(ext)) {
          return NextResponse.json({ error: `Format file harus: ${ALLOWED_EXT.join(', ')}` }, { status: 400 })
        }
        if (file.size > MAX_SIZE) {
          return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 })
        }

        const uniqueName = `${crypto.randomUUID()}${ext}`
        const filePath = path.join(process.cwd(), 'uploads', 'surat-tugas', uniqueName)
        const bytes = Buffer.from(await file.arrayBuffer())
        await fs.writeFile(filePath, bytes)

        newFilePath = `uploads/surat-tugas/${uniqueName}`
        newUkuranFile = `${(file.size / 1024).toFixed(1)} KB`

        // Hapus file lama
        if (existing.file) {
          try { await fs.unlink(path.join(process.cwd(), existing.file)) } catch { /* ignore */ }
        }

        data.file = newFilePath
        data.ukuranFile = newUkuranFile
      }
    } else {
      // Update JSON biasa (tanpa file)
      const body = await req.json()
      const allowedFields = ['nomor', 'perihal', 'penerima', 'pesertaId', 'pelatihanId', 'angkatanId', 'status', 'catatan']
      for (const field of allowedFields) {
        if (body[field] !== undefined) data[field] = body[field]
      }
      if (body.tanggalSurat !== undefined) data.tanggalSurat = new Date(body.tanggalSurat)
      if (body.tanggalMulai !== undefined) data.tanggalMulai = body.tanggalMulai ? new Date(body.tanggalMulai) : null
      if (body.tanggalSelesai !== undefined) data.tanggalSelesai = body.tanggalSelesai ? new Date(body.tanggalSelesai) : null
    }

    if (data.status && !['DRAFT', 'TERBIT'].includes(data.status as string)) {
      return NextResponse.json({ error: 'Status harus DRAFT atau TERBIT' }, { status: 400 })
    }

    const item = await db.suratTugas.update({ where: { id }, data: data as any })
    await auditLog(session, 'UPDATE', 'SURAT_TUGAS', `Ubah surat tugas: ${item.nomor} - ${item.perihal}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('surat-tugas update error:', e)
    return NextResponse.json({ error: 'Gagal mengubah surat tugas' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const existing = await db.suratTugas.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Surat tugas tidak ditemukan' }, { status: 404 })

    // Hapus file dari disk
    if (existing.file) {
      try { await fs.unlink(path.join(process.cwd(), existing.file)) } catch { /* ignore */ }
    }

    await db.suratTugas.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'SURAT_TUGAS', `Hapus surat tugas: ${existing.nomor} - ${existing.perihal}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('surat-tugas delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus surat tugas' }, { status: 500 })
  }
}
