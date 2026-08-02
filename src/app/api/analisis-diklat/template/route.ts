import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const headers = [
      'Outcome',
      'Program Prioritas RPJMA',
      'Sasaran RPJMA',
      'SKPA Sasaran',
      'Nama Pelatihan',
      'Metode Pembelajaran',
      'Durasi (JP)',
      'Target Output',
      'Prioritas',
      'Tahun Pelaksanaan',
    ]

    const exampleRows = [
      {
        'Outcome': 'Meningkatnya kompetensi ASN di bidang teknis',
        'Program Prioritas RPJMA': 'Peningkatan Kapasitas ASN',
        'Sasaran RPJMA': 'ASN yang kompeten dan profesional',
        'SKPA Sasaran': 'BPSDM Aceh',
        'Nama Pelatihan': 'Pelatihan Manajemen Proyek',
        'Metode Pembelajaran': 'Tatap Muka',
        'Durasi (JP)': 40,
        'Target Output': 'Sertifikat kompetensi',
        'Prioritas': 'Tinggi',
        'Tahun Pelaksanaan': 2025,
      },
    ]

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exampleRows, { header: headers })
    ws['!cols'] = [
      { wch: 35 },
      { wch: 30 },
      { wch: 30 },
      { wch: 25 },
      { wch: 35 },
      { wch: 20 },
      { wch: 12 },
      { wch: 30 },
      { wch: 12 },
      { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Template Import')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-import-analisis-diklat.xlsx"',
      },
    })
  } catch (e) {
    console.error('analisis-diklat template error:', e)
    return NextResponse.json({ error: 'Gagal mengunduh template' }, { status: 500 })
  }
}
