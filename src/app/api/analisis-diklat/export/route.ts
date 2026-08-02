import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const data = await db.analisisDiklatItem.findMany({ orderBy: { createdAt: 'asc' } })
    const rows = data.map((item, i) => ({
      'No': i + 1,
      'Outcome': item.outcome,
      'Program Prioritas RPJMA': item.programPrioritasRPJMA,
      'Sasaran RPJMA': item.sasaranRPJMA,
      'SKPA Sasaran': item.skpaSasaran,
      'Nama Pelatihan': item.namaPelatihan,
      'Metode Pembelajaran': item.metodePembelajaran === 'TATAP_MUKA' ? 'Tatap Muka' : item.metodePembelajaran === 'DARING' ? 'Daring' : 'Blended',
      'Durasi (JP)': item.durasiJP,
      'Target Output': item.targetOutput,
      'Prioritas': item.prioritas === 'TINGGI' ? 'Tinggi' : item.prioritas === 'SEDANG' ? 'Sedang' : 'Rendah',
      'Tahun Pelaksanaan': item.tahunPelaksanaan,
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 30 }, { wch: 30 }, { wch: 25 },
      { wch: 35 }, { wch: 18 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Analisis Diklat')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=analisis-diklat.xlsx',
      },
    })
  } catch (e) {
    console.error('export error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor' }, { status: 500 })
  }
}
