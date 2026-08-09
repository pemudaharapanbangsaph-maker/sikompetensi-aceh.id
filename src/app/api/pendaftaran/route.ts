import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') || 1)
    const pageSize = Number(searchParams.get('pageSize') || 10)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { nip: { contains: search } },
        { instansi: { contains: search } },
        { jabatan: { contains: search } },
      ]
    }
    if (status) where.status = status

    const [data, total] = await Promise.all([
      db.pendaftaranPortal.findMany({
        where,
        include: {
          analisisDiklatItem: { select: { id: true, namaPelatihan: true, kategori: true, metodePembelajaran: true, durasiJP: true, tahunPelaksanaan: true } },
          _count: { select: { dokumen: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.pendaftaranPortal.count({ where }),
    ])

    const mapped = data.map((d) => ({
      id: d.id,
      nama: d.nama,
      nip: d.nip,
      pangkatGolongan: d.pangkatGolongan || '',
      jenisKelamin: d.jenisKelamin || '',
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

    return NextResponse.json({ data: mapped, total, page, pageSize })
  } catch (e) {
    console.error('pendaftaran list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}
