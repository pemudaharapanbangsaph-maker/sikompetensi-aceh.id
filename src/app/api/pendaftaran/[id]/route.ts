import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import { ensurePendaftaranEmailColumn } from '@/lib/ensure-schema'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Pastikan kolom email ada di MySQL (no-op jika sudah / baru saja dibuat)
    await ensurePendaftaranEmailColumn()

    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const data = await db.pendaftaranPortal.findUnique({
      where: { id },
      include: {
        analisisDiklatItem: { select: { id: true, namaPelatihan: true, kategori: true, metodePembelajaran: true, durasiJP: true, tahunPelaksanaan: true } },
        dokumen: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!data) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

    return NextResponse.json({
      id: data.id,
      nama: data.nama,
      nip: data.nip,
      pangkatGolongan: data.pangkatGolongan || '',
      jenisKelamin: data.jenisKelamin || '',
      tempatLahir: data.tempatLahir || '',
      tanggalLahir: data.tanggalLahir ? data.tanggalLahir.toISOString().slice(0, 10) : '',
      jabatan: data.jabatan || '',
      unitKerja: data.unitKerja || '',
      instansi: data.instansi || '',
      nomorHP: data.nomorHP || '',
      email: data.email || '',
      nomorRekening: data.nomorRekening || '',
      npwp: data.npwp || '',
      analisisDiklatItemId: data.analisisDiklatItemId || '',
      pelatihan: data.analisisDiklatItem?.namaPelatihan || '',
      pelatihanKategori: data.analisisDiklatItem?.kategori || '',
      status: data.status,
      catatanAdmin: data.catatanAdmin || '',
      createdAt: data.createdAt.toISOString(),
      updatedAt: data.updatedAt.toISOString(),
      dokumen: data.dokumen.map((doc) => ({
        id: doc.id,
        tipe: doc.tipe,
        label: doc.tipe,
        namaFile: doc.namaFile,
        ukuran: doc.ukuranFile,
        terakhirDiupload: doc.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('pendaftaran get error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const {
      nama, nip, pangkatGolongan, jenisKelamin, tempatLahir, tanggalLahir,
      jabatan, unitKerja, instansi, nomorHP, email, nomorRekening, npwp,
      status, catatanAdmin,
    } = body

    // Validasi format email jika dikirim (kosong = hapus/null, khusus admin)
    if (email !== undefined && email !== null) {
      const em = String(email).trim()
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        return NextResponse.json({ error: 'Format email tidak valid (contoh: nama@email.com)' }, { status: 400 })
      }
    }

    // Validasi status jika dikirim
    if (status && !['MENUNGGU', 'DITERIMA', 'DITOLAK'].includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    // Validasi NIP jika diubah
    if (nip && !/^\d{18}$/.test(nip.trim())) {
      return NextResponse.json({ error: 'Format NIP harus 18 digit' }, { status: 400 })
    }

    // Cek duplikat NIP jika diubah
    if (nip) {
      const dup = await db.pendaftaranPortal.findFirst({ where: { nip: nip.trim(), id: { not: id } } })
      if (dup) return NextResponse.json({ error: 'NIP sudah digunakan pendaftar lain' }, { status: 409 })
    }

    const updateData: Record<string, unknown> = {}
    if (nama !== undefined) updateData.nama = nama.trim()
    if (nip !== undefined) updateData.nip = nip.trim()
    if (pangkatGolongan !== undefined) updateData.pangkatGolongan = pangkatGolongan?.trim() || null
    if (jenisKelamin !== undefined) updateData.jenisKelamin = jenisKelamin?.trim() || null
    if (tempatLahir !== undefined) updateData.tempatLahir = tempatLahir?.trim() || null
    if (tanggalLahir !== undefined) updateData.tanggalLahir = tanggalLahir ? new Date(tanggalLahir) : null
    if (jabatan !== undefined) updateData.jabatan = jabatan?.trim() || null
    if (unitKerja !== undefined) updateData.unitKerja = unitKerja?.trim() || null
    if (instansi !== undefined) updateData.instansi = instansi?.trim() || null
    if (nomorHP !== undefined) updateData.nomorHP = nomorHP?.trim() || null
    if (email !== undefined) updateData.email = email === null ? null : (String(email).trim() || null)
    if (nomorRekening !== undefined) updateData.nomorRekening = nomorRekening?.trim() || null
    if (npwp !== undefined) updateData.npwp = npwp?.trim() || null
    if (status !== undefined) updateData.status = status
    if (catatanAdmin !== undefined) updateData.catatanAdmin = catatanAdmin?.trim() || null

    const updated = await db.pendaftaranPortal.update({
      where: { id },
      data: updateData,
      include: {
        analisisDiklatItem: { select: { id: true, namaPelatihan: true, kategori: true, metodePembelajaran: true, durasiJP: true, tahunPelaksanaan: true } },
        dokumen: { orderBy: { createdAt: 'asc' } },
      },
    })

    await auditLog(session, 'UPDATE', 'PENDAFTARAN_PORTAL', `Update biodata pendaftaran "${updated.nama}" (${updated.nip})`, req)

    return NextResponse.json({
      id: updated.id,
      nama: updated.nama,
      nip: updated.nip,
      pangkatGolongan: updated.pangkatGolongan || '',
      jenisKelamin: updated.jenisKelamin || '',
      tempatLahir: updated.tempatLahir || '',
      tanggalLahir: updated.tanggalLahir ? updated.tanggalLahir.toISOString().slice(0, 10) : '',
      jabatan: updated.jabatan || '',
      unitKerja: updated.unitKerja || '',
      instansi: updated.instansi || '',
      nomorHP: updated.nomorHP || '',
      email: updated.email || '',
      nomorRekening: updated.nomorRekening || '',
      npwp: updated.npwp || '',
      analisisDiklatItemId: updated.analisisDiklatItemId || '',
      pelatihan: updated.analisisDiklatItem?.namaPelatihan || '',
      pelatihanKategori: updated.analisisDiklatItem?.kategori || '',
      status: updated.status,
      catatanAdmin: updated.catatanAdmin || '',
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      dokumen: updated.dokumen.map((doc) => ({
        id: doc.id,
        tipe: doc.tipe,
        label: doc.tipe,
        namaFile: doc.namaFile,
        ukuran: doc.ukuranFile,
        terakhirDiupload: doc.createdAt.toISOString(),
      })),
    })
  } catch (e) {
    console.error('pendaftaran update error:', e)
    return NextResponse.json({ error: 'Gagal mengupdate' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const existing = await db.pendaftaranPortal.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })

    await db.pendaftaranPortal.delete({ where: { id } })

    await auditLog(session, 'DELETE', 'PENDAFTARAN_PORTAL', `Hapus pendaftaran "${existing.nama}" (${existing.nip})`, req)

    return NextResponse.json({ message: 'Berhasil dihapus' })
  } catch (e) {
    console.error('pendaftaran delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus' }, { status: 500 })
  }
}
