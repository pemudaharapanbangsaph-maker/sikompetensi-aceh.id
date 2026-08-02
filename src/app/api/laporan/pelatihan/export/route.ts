import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

const STATUS_LABEL: Record<string, string> = {
  PERENCANAAN: 'Perencanaan',
  BERJALAN: 'Berjalan',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

const METODE_LABEL: Record<string, string> = {
  TATAP_MUKA: 'Tatap Muka',
  DARING: 'Daring',
  BLENDED: 'Blended',
}

const KATEGORI_LABEL: Record<string, string> = {
  TEKNIS: 'Teknis',
  MANAJERIAL: 'Manajerial',
  FUNGSIONAL: 'Fungsional',
  SOSIAL_KULTURAL: 'Sosial Kultural',
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

    const angkatan = await db.angkatan.findMany({
      where,
      include: {
        pelatihan: { select: { nama: true, kode: true, kategori: true } },
        _count: { select: { peserta: true } },
      },
      orderBy: { tanggalMulai: 'desc' },
    })

    let filtered = angkatan
    if (tahun) {
      filtered = filtered.filter((a) => new Date(a.tanggalMulai).getFullYear().toString() === tahun)
    }

    const rows = filtered.map((a, idx) => ({
      No: idx + 1,
      'Nama Pelatihan': a.pelatihan?.nama || '-',
      'Kode Pelatihan': a.pelatihan?.kode || '-',
      Kategori: KATEGORI_LABEL[a.pelatihan?.kategori || ''] || a.pelatihan?.kategori || '-',
      'Nama Angkatan': a.namaAngkatan,
      'Tanggal Mulai': a.tanggalMulai ? new Date(a.tanggalMulai).toLocaleDateString('id-ID') : '-',
      'Tanggal Selesai': a.tanggalSelesai ? new Date(a.tanggalSelesai).toLocaleDateString('id-ID') : '-',
      Lokasi: a.lokasi || '-',
      Metode: METODE_LABEL[a.metode] || a.metode,
      Kuota: a.kuota,
      'Jumlah Peserta': a._count?.peserta || 0,
      Status: STATUS_LABEL[a.status] || a.status,
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 35 }, { wch: 18 }, { wch: 15 }, { wch: 25 },
      { wch: 16 }, { wch: 16 }, { wch: 25 }, { wch: 15 }, { wch: 8 },
      { wch: 14 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Pelatihan')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="rekap-pelatihan.xlsx"',
      },
    })
  } catch (e) {
    console.error('laporan pelatihan export error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor' }, { status: 500 })
  }
}
