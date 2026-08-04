import { NextResponse } from 'next/server'
import { getSession, hasPermission } from '@/lib/auth'
import * as XLSX from 'xlsx'

const HEADERS = [
  'Outcome',
  'Program Prioritas RPJMA',
  'Sasaran RPJMA',
  'SKPA Sasaran',
  'Kategori',
  'Nama Pelatihan',
  'Metode Pembelajaran',
  'Durasi (JP)',
  'Lama Hari',
  'Target Output',
  'Prioritas',
  'Tahun Pelaksanaan',
  'Status Publikasi',
]

const EXAMPLE_ROW = [
  'Meningkatkan kompetensi teknis ASN di bidang pengadaan barang/jasa',
  'Peningkatan Kapasitas Aparatur Sipil Negara',
  'Terwujudnya ASN yang kompeten dan profesional',
  'BPSDM Aceh',
  'Teknis',
  'Diklat Pengadaan Barang/Jasa Pemerintah',
  'Tatap Muka',
  40,
  5,
  'Mampu melaksanakan pengadaan barang/jasa sesuai peraturan',
  'Tinggi',
  2025,
  'Aktif',
]

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, EXAMPLE_ROW])
    ws['!cols'] = [
      { wch: 40 }, { wch: 35 }, { wch: 35 }, { wch: 25 },
      { wch: 18 }, { wch: 40 }, { wch: 22 }, { wch: 14 }, { wch: 14 },
      { wch: 40 }, { wch: 14 }, { wch: 20 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-analisis-diklat.xlsx"',
      },
    })
  } catch (e) {
    console.error('template download error:', e)
    return NextResponse.json({ error: 'Gagal mengunduh template' }, { status: 500 })
  }
}
