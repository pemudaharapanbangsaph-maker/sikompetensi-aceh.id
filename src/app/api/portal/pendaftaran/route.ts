import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensurePendaftaranEmailColumn } from '@/lib/ensure-schema'
import { generateUploadToken } from './upload-dokumen/route'

export async function POST(req: Request) {
  try {
    // Pastikan kolom email ada di MySQL (no-op jika sudah / baru saja dibuat)
    await ensurePendaftaranEmailColumn()

    const body = await req.json()
    const { nama, nip, pangkatGolongan, jenisKelamin, tempatLahir, tanggalLahir, jabatan, unitKerja, instansi, nomorHP, email, nomorRekening, npwp, pelatihanId } = body

    // Validasi wajib
    if (!nama?.trim()) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    if (!nip?.trim()) return NextResponse.json({ error: 'NIP wajib diisi' }, { status: 400 })
    if (!/^[\d]{18}$/.test(nip.trim())) return NextResponse.json({ error: 'Format NIP tidak valid (18 digit)' }, { status: 400 })
    if (!email?.trim()) return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return NextResponse.json({ error: 'Format email tidak valid (contoh: nama@email.com)' }, { status: 400 })

    // Cek NIP sudah terdaftar
    const existing = await db.pendaftaranPortal.findUnique({ where: { nip: nip.trim() } })
    if (existing) {
      return NextResponse.json({
        error: 'NIP sudah terdaftar',
        alreadyRegistered: true,
        id: existing.id,
        nama: existing.nama,
        status: existing.status,
      }, { status: 409 })
    }

    // Validasi AnalisisDiklatItem jika diisi (pelatihanId di form = id AnalisisDiklatItem)
    if (pelatihanId) {
      const item = await db.analisisDiklatItem.findUnique({ where: { id: pelatihanId } })
      if (!item) return NextResponse.json({ error: 'Pelatihan tidak ditemukan' }, { status: 400 })
    }

    const pendaftaran = await db.pendaftaranPortal.create({
      data: {
        nama: nama.trim(),
        nip: nip.trim(),
        pangkatGolongan: pangkatGolongan?.trim() || null,
        jenisKelamin: jenisKelamin?.trim() || null,
        tempatLahir: tempatLahir?.trim() || null,
        tanggalLahir: tanggalLahir ? new Date(tanggalLahir) : null,
        jabatan: jabatan?.trim() || null,
        unitKerja: unitKerja?.trim() || null,
        instansi: instansi?.trim() || null,
        nomorHP: nomorHP?.trim() || null,
        email: email.trim(),
        nomorRekening: nomorRekening?.trim() || null,
        npwp: npwp?.trim() || null,
        analisisDiklatItemId: pelatihanId || null,
      },
    })

    const uploadToken = generateUploadToken(pendaftaran.id)

    return NextResponse.json({
      success: true,
      id: pendaftaran.id,
      nama: pendaftaran.nama,
      nip: pendaftaran.nip,
      uploadToken,
      message: 'Pendaftaran berhasil! Silakan upload dokumen pendukung.',
    })
  } catch (e) {
    console.error('portal pendaftaran error:', e)
    return NextResponse.json({ error: 'Gagal mendaftar' }, { status: 500 })
  }
}

// Cek status pendaftaran berdasarkan NIP
export async function GET(req: Request) {
  try {
    // Pastikan kolom email ada di MySQL (no-op jika sudah / baru saja dibuat)
    await ensurePendaftaranEmailColumn()

    const { searchParams } = new URL(req.url)
    const nip = searchParams.get('nip')?.trim()
    if (!nip) return NextResponse.json({ error: 'NIP wajib diisi' }, { status: 400 })

    const pendaftaran = await db.pendaftaranPortal.findUnique({
      where: { nip },
      include: {
        analisisDiklatItem: { select: { id: true, namaPelatihan: true } },
        dokumen: { select: { tipe: true, namaFile: true, createdAt: true } },
      },
    })

    if (!pendaftaran) {
      return NextResponse.json({ found: false })
    }

    return NextResponse.json({
      found: true,
      id: pendaftaran.id,
      nama: pendaftaran.nama,
      nip: pendaftaran.nip,
      status: pendaftaran.status,
      catatanAdmin: pendaftaran.catatanAdmin,
      pelatihan: pendaftaran.analisisDiklatItem ? {
        id: pendaftaran.analisisDiklatItem.id,
        nama: pendaftaran.analisisDiklatItem.namaPelatihan,
      } : null,
      dokumen: pendaftaran.dokumen,
      createdAt: pendaftaran.createdAt,
    })
  } catch (e) {
    console.error('portal pendaftaran status error:', e)
    return NextResponse.json({ error: 'Gagal mengecek status' }, { status: 500 })
  }
}
