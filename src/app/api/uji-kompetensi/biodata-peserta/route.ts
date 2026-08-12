import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

/**
 * GET /api/uji-kompetensi/biodata-peserta
 *
 * Mode 1: ?listPelatihan=1  →  Ambil daftar pelatihan unik dari pendaftar
 * Mode 2: ?pelatihanId=xxx  →  Ambil data pendaftar yang memilih pelatihan tsb
 */
export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('listPelatihan')
    const pelatihanId = searchParams.get('pelatihanId') || ''
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    // =============================================
    // MODE 1: Daftar pelatihan unik untuk dropdown
    // =============================================
    if (mode === '1') {
      const items = await db.analisisDiklatItem.findMany({
        where: {
          status: 'AKTIF',
          pendaftaran: { some: {} },
        },
        select: {
          id: true,
          namaPelatihan: true,
          kategori: true,
          metodePembelajaran: true,
          durasiJP: true,
          tahunPelaksanaan: true,
          _count: { select: { pendaftaran: true } },
        },
        orderBy: { namaPelatihan: 'asc' },
      })
      return NextResponse.json({
        data: items.map((i) => ({
          id: i.id,
          nama: i.namaPelatihan,
          kategori: i.kategori,
          metode: i.metodePembelajaran,
          jp: i.durasiJP,
          tahun: i.tahunPelaksanaan,
          totalPendaftar: i._count.pendaftaran,
        })),
      })
    }

    // =============================================
    // MODE 2: Data pendaftar berdasarkan pelatihan
    // =============================================
    const where: Record<string, unknown> = {}
    if (pelatihanId) {
      where.analisisDiklatItemId = pelatihanId
    }
    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { nip: { contains: search } },
        { instansi: { contains: search } },
        { jabatan: { contains: search } },
      ]
    }
    if (status) {
      where.status = status
    }

    const data = await db.pendaftaranPortal.findMany({
      where,
      include: {
        analisisDiklatItem: { select: { id: true, namaPelatihan: true, kategori: true, metodePembelajaran: true, durasiJP: true, tahunPelaksanaan: true } },
        _count: { select: { dokumen: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const mapped = data.map((d) => ({
      id: d.id,
      nama: d.nama,
      nip: d.nip,
      jenisKelamin: d.jenisKelamin || '',
      pangkatGolongan: d.pangkatGolongan || '',
      tempatLahir: d.tempatLahir || '',
      tanggalLahir: d.tanggalLahir ? d.tanggalLahir.toISOString().slice(0, 10) : '',
      jabatan: d.jabatan || '',
      unitKerja: d.unitKerja || '',
      instansi: d.instansi || '',
      nomorHP: d.nomorHP || '',
      nomorRekening: d.nomorRekening || '',
      npwp: d.npwp || '',
      pelatihan: d.analisisDiklatItem?.namaPelatihan || '',
      pelatihanKategori: d.analisisDiklatItem?.kategori || '',
      pelatihanMetode: d.analisisDiklatItem?.metodePembelajaran || '',
      pelatihanJP: d.analisisDiklatItem?.durasiJP || 0,
      pelatihanTahun: d.analisisDiklatItem?.tahunPelaksanaan || 0,
      status: d.status,
      catatanAdmin: d.catatanAdmin || '',
      jumlahDokumen: d._count.dokumen,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }))

    return NextResponse.json({ data: mapped, total: mapped.length })
  } catch (e) {
    console.error('biodata-peserta error:', e)
    return NextResponse.json({ error: 'Gagal memuat data biodata peserta' }, { status: 500 })
  }
}
