import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

const STATUS_LABEL: Record<string, string> = {
  DIJADWALKAN: 'Dijadwalkan',
  BERLANGSUNG: 'Berlangsung',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined
    const tahun = searchParams.get('tahun') || undefined

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const ujiList = await db.ujiKompetensi.findMany({
      where,
      include: {
        asesor: { select: { nama: true } },
        _count: { select: { nilai: true } },
      },
      orderBy: { tanggalUji: 'desc' },
    })

    let filtered = ujiList
    if (tahun) {
      filtered = filtered.filter((u) => new Date(u.tanggalUji).getFullYear().toString() === tahun)
    }

    const rows = filtered.map((u, idx) => ({
      No: idx + 1,
      Kode: u.kode,
      'Skema Sertifikasi': u.skemaSertifikasi,
      'Tanggal Uji': new Date(u.tanggalUji).toLocaleDateString('id-ID'),
      Tempat: u.tempat,
      'Jumlah Peserta': u.jumlahPeserta,
      'Jumlah Nilai': u._count?.nilai || 0,
      Asesor: u.asesor.map((a) => a.nama).join(', ') || '-',
      Status: STATUS_LABEL[u.status] || u.status,
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 18 }, { wch: 35 }, { wch: 16 },
      { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Uji Kompetensi')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="rekap-uji-kompetensi.xlsx"',
      },
    })
  } catch (e) {
    console.error('laporan uji kompetensi export error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor' }, { status: 500 })
  }
}
