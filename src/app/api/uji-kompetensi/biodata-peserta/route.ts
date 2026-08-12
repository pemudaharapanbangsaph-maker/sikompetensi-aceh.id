import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

/**
 * GET /api/uji-kompetensi/biodata-peserta
 *
 * Mode 1: ?listPelatihan=1  →  Daftar pelatihan unik dari pendaftar (dedup by namaPelatihan)
 * Mode 2: ?pelatihan=xxx    →  Data pendaftar yang namaPelatihannya cocok (string match, sama kayak sync-pendaftar)
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
    const namaPelatihan = searchParams.get('pelatihan') || ''
    const search = searchParams.get('search') || ''

    // =============================================
    // MODE 1: Daftar pelatihan unik untuk dropdown
    // Dedup by namaPelatihan, cocok dengan alur sync-pendaftar
    // =============================================
    if (mode === '1') {
      const items = await db.analisisDiklatItem.findMany({
        where: {
          pendaftaran: { some: {} },
        },
        select: {
          namaPelatihan: true,
          kategori: true,
          metodePembelajaran: true,
          durasiJP: true,
          tahunPelaksanaan: true,
          _count: { select: { pendaftaran: true } },
        },
        orderBy: { namaPelatihan: 'asc' },
      })

      // Dedup by namaPelatihan dan jumlahkan total pendaftar
      const seen = new Map<string, {
        kategori: string
        metode: string
        jp: number
        tahun: number
        total: number
      }>()

      for (const item of items) {
        if (!item.namaPelatihan) continue
        const existing = seen.get(item.namaPelatihan)
        if (existing) {
          existing.total += item._count.pendaftaran
        } else {
          seen.set(item.namaPelatihan, {
            kategori: item.kategori,
            metode: item.metodePembelajaran,
            jp: item.durasiJP,
            tahun: item.tahunPelaksanaan,
            total: item._count.pendaftaran,
          })
        }
      }

      const data = Array.from(seen.entries()).map(([nama, info]) => ({
        id: nama, // gunakan namaPelatihan sebagai ID (string match, bukan DB ID)
        nama,
        kategori: info.kategori,
        metode: info.metode,
        jp: info.jp,
        tahun: info.tahun,
        totalPendaftar: info.total,
      }))

      return NextResponse.json({ data })
    }

    // =============================================
    // MODE 2: Data pendaftar berdasarkan nama pelatihan
    // String match, sama persis kayak sync-pendaftar
    // =============================================
    const where: Record<string, unknown> = {}
    if (namaPelatihan) {
      where.analisisDiklatItem = {
        namaPelatihan,
      }
    }
    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { nip: { contains: search } },
        { instansi: { contains: search } },
        { jabatan: { contains: search } },
      ]
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
