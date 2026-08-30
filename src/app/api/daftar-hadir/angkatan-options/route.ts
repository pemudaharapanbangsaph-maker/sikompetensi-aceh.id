import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

/** Format Date ke "YYYY-MM-DD" menggunakan LOCAL timezone */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const angkatan = await db.angkatan.findMany({
      where: { status: { in: ['BERJALAN', 'SELESAI', 'PERENCANAAN'] }, deleted: false, pelatihan: { deleted: false } },
      include: {
        pelatihan: { select: { nama: true, kategori: true } },
        _count: { select: { peserta: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = angkatan.map((a) => ({
      id: a.id,
      label: `${a.namaAngkatan} — ${a.pelatihan.nama} (${a._count.peserta} peserta)`,
      namaAngkatan: a.namaAngkatan,
      namaPelatihan: a.pelatihan.nama,
      kategori: a.pelatihan.kategori,
      tanggalMulai: toLocalDateStr(a.tanggalMulai),
      tanggalSelesai: toLocalDateStr(a.tanggalSelesai),
      lokasi: a.lokasi || '',
      jumlahPeserta: a._count.peserta,
    }))

    return NextResponse.json(result)
  } catch (e) {
    console.error('daftar-hadir angkatan-options error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}
