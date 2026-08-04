import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

const METODE_LABEL: Record<string, string> = {
  TATAP_MUKA: 'Tatap Muka',
  DARING: 'Daring',
  BLENDED: 'Blended',
}

const PRIORITAS_LABEL: Record<string, string> = {
  TINGGI: 'Tinggi',
  SEDANG: 'Sedang',
  RENDAH: 'Rendah',
}

const KATEGORI_LABEL: Record<string, string> = {
  TEKNIS: 'Teknis',
  MANAJERIAL: 'Manajerial',
  FUNGSIONAL: 'Fungsional',
  SOSIAL_KULTURAL: 'Sosial Kultural',
}

const STATUS_LABEL: Record<string, string> = {
  AKTIF: 'Aktif',
  NONAKTIF: 'Nonaktif',
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const items = await db.analisisDiklatItem.findMany({ orderBy: { createdAt: 'desc' } })

    const rows = items.map((item, idx) => ({
      No: idx + 1,
      Outcome: item.outcome,
      'Program Prioritas RPJMA': item.programPrioritasRPJMA,
      'Sasaran RPJMA': item.sasaranRPJMA,
      'SKPA Sasaran': item.skpaSasaran,
      Kategori: KATEGORI_LABEL[item.kategori] || item.kategori,
      'Nama Pelatihan': item.namaPelatihan,
      'Metode Pembelajaran': METODE_LABEL[item.metodePembelajaran] || item.metodePembelajaran,
      'Durasi (JP)': item.durasiJP,
      'Lama Hari': item.durasiHari,
      'Target Output': item.targetOutput,
      Prioritas: PRIORITAS_LABEL[item.prioritas] || item.prioritas,
      'Tahun Pelaksanaan': item.tahunPelaksanaan,
      'Status Publikasi': STATUS_LABEL[item.status] || item.status,
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 25 },
      { wch: 16 }, { wch: 35 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Analisis Diklat')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    await auditLog(session, 'EXPORT', 'ANALISIS_DIKLAT', `Export ${items.length} item analisis diklat ke XLS`, req)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="analisis-diklat.xlsx"',
      },
    })
  } catch (e) {
    console.error('analisis-diklat export error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor data' }, { status: 500 })
  }
}
