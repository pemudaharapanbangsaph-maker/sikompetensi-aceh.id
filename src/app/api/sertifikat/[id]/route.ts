import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog } from '@/lib/auth'
import * as fs from 'fs/promises'
import * as path from 'path'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const item = await db.sertifikat.findUnique({
      where: { id },
      include: {
        angkatan: {
          select: { id: true, namaAngkatan: true, tanggalMulai: true, tanggalSelesai: true },
          include: { pelatihan: { select: { id: true, nama: true, kode: true } } },
        },
        peserta: { select: { id: true, nama: true, nip: true, jabatan: true, unitKerja: true, instansi: true } },
        ujiKompetensi: { select: { id: true, kode: true, skemaSertifikasi: true, tanggalUji: true, tempat: true } },
      },
    })
    if (!item) return NextResponse.json({ error: 'Sertifikat tidak ditemukan' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    console.error('sertifikat get error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const existing = await db.sertifikat.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Sertifikat tidak ditemukan' }, { status: 404 })

    const body = await req.json()
    const data: Record<string, unknown> = {}

    const allowedFields = ['jenis', 'angkatanId', 'ujiKompetensiId', 'pesertaId', 'nomorSertifikat', 'namaPeserta', 'namaKegiatan', 'catatan']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }
    if (body.tanggalTerbit !== undefined) {
      data.tanggalTerbit = body.tanggalTerbit ? new Date(body.tanggalTerbit) : null
    }

    const item = await db.sertifikat.update({ where: { id }, data: data as any })
    await auditLog(session, 'UPDATE', 'SERTIFIKAT', `Ubah sertifikat: ${item.nomorSertifikat || item.namaPeserta || item.id}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('sertifikat update error:', e)
    return NextResponse.json({ error: 'Gagal mengubah sertifikat' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const existing = await db.sertifikat.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Sertifikat tidak ditemukan' }, { status: 404 })

    // Hapus file dari disk
    if (existing.file) {
      const filePath = path.join(process.cwd(), existing.file)
      try { await fs.unlink(filePath) } catch { /* ignore jika file tidak ada */ }
    }

    await db.sertifikat.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'SERTIFIKAT', `Hapus sertifikat: ${existing.nomorSertifikat || existing.namaPeserta || existing.id}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('sertifikat delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus sertifikat' }, { status: 500 })
  }
}
