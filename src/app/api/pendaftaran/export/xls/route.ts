import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const analisisDiklatItemId = searchParams.get('analisisDiklatItemId') || ''

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (analisisDiklatItemId) where.analisisDiklatItemId = analisisDiklatItemId

    const data = await db.pendaftaranPortal.findMany({
      where,
      include: {
        analisisDiklatItem: { select: { namaPelatihan: true, kategori: true, metodePembelajaran: true, durasiJP: true, tahunPelaksanaan: true } },
        _count: { select: { dokumen: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const STATUS_LABEL: Record<string, string> = { MENUNGGU: 'Menunggu', DITERIMA: 'Diterima', DITOLAK: 'Ditolak' }

    const rows = data.map((d, i) => ({
      'No': i + 1,
      'Nama Lengkap': d.nama,
      'NIP': d.nip,
      'Pangkat/Golongan': d.pangkatGolongan || '',
      'Tempat Lahir': d.tempatLahir || '',
      'Tanggal Lahir': d.tanggalLahir ? d.tanggalLahir.toISOString().slice(0, 10) : '',
      'Jabatan': d.jabatan || '',
      'Unit Kerja': d.unitKerja || '',
      'Instansi': d.instansi || '',
      'No. HP': d.nomorHP || '',
      'No. REK Bank Aceh': d.nomorRekening || '',
      'NPWP': d.npwp || '',
      'Pelatihan': d.analisisDiklatItem?.namaPelatihan || '',
      'Kategori': d.analisisDiklatItem?.kategori || '',
      'Metode': d.analisisDiklatItem?.metodePembelajaran || '',
      'JP': d.analisisDiklatItem?.durasiJP || 0,
      'Tahun': d.analisisDiklatItem?.tahunPelaksanaan || 0,
      'Jml Dokumen': d._count.dokumen,
      'Status': STATUS_LABEL[d.status] || d.status,
      'Tanggal Daftar': d.createdAt.toISOString().slice(0, 10),
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)

    // Column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
      { wch: 24 }, { wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 22 },
      { wch: 35 }, { wch: 14 }, { wch: 16 }, { wch: 6 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Data Pendaftar')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="data-pendaftar-portal.xlsx"',
      },
    })
  } catch (e) {
    console.error('pendaftaran export xls error:', e)
    return NextResponse.json({ error: 'Gagal export' }, { status: 500 })
  }
}
