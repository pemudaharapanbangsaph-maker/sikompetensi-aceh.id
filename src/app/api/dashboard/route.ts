import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [totalPelatihan, totalAngkatan, totalPeserta, totalUjiKompetensi, totalAsesor, totalAnalisis] = await Promise.all([
      db.pelatihan.count(),
      db.angkatan.count(),
      db.peserta.count(),
      db.ujiKompetensi.count(),
      db.asesor.count(),
      db.analisisKebutuhan.count(),
    ])

    const pelatihanBerjalan = await db.angkatan.count({ where: { status: 'BERJALAN' } })
    const pesertaLulus = await db.pesertaAngkatan.count({ where: { status: 'LULUS' } })
    const pesertaTidakLulus = await db.pesertaAngkatan.count({ where: { status: 'TIDAK_LULUS' } })
    const ujiSelesai = await db.ujiKompetensi.count({ where: { status: 'SELESAI' } })

    // Grafik pelatihan per bulan (12 bulan terakhir)
    const now = new Date()
    const monthsData: { bulan: string; jumlah: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const jumlah = await db.angkatan.count({
        where: { tanggalMulai: { gte: start, lt: end } },
      })
      monthsData.push({ bulan: start.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }), jumlah })
    }

    // Grafik kelulusan per pelatihan (top 6)
    const angkatanSelesai = await db.angkatan.findMany({
      where: { status: 'SELESAI' },
      include: { pelatihan: true, _count: { select: { peserta: true } } },
      take: 6,
      orderBy: { tanggalSelesai: 'desc' },
    })
    const grafikKelulusan = await Promise.all(angkatanSelesai.map(async (a) => {
      const lulus = await db.pesertaAngkatan.count({ where: { angkatanId: a.id, status: 'LULUS' } })
      const tidakLulus = await db.pesertaAngkatan.count({ where: { angkatanId: a.id, status: 'TIDAK_LULUS' } })
      return { nama: a.pelatihan?.nama?.substring(0, 20) || a.namaAngkatan, lulus, tidakLulus }
    }))

    // Grafik kategori pelatihan
    const kategoriList = ['TEKNIS', 'MANAJERIAL', 'FUNGSIONAL', 'SOSIAL_KULTURAL']
    const grafikKategoriPelatihan = await Promise.all(kategoriList.map(async (k) => ({
      kategori: k.replace('_', ' '),
      jumlah: await db.pelatihan.count({ where: { kategori: k } }),
    })))

    // Jadwal terdekat (angkatan & uji kompetensi yang akan datang)
    const upcomingAngkatan = await db.angkatan.findMany({
      where: { tanggalMulai: { gte: now }, status: { in: ['PERENCANAAN', 'BERJALAN'] } },
      include: { pelatihan: true },
      orderBy: { tanggalMulai: 'asc' },
      take: 5,
    })
    const upcomingUji = await db.ujiKompetensi.findMany({
      where: { tanggalUji: { gte: now }, status: 'DIJADWALKAN' },
      orderBy: { tanggalUji: 'asc' },
      take: 5,
    })
    const jadwalTerdekat = [...upcomingAngkatan, ...upcomingUji].sort((a, b) => {
      const da = 'tanggalMulai' in a ? a.tanggalMulai : a.tanggalUji
      const db_ = 'tanggalMulai' in b ? b.tanggalMulai : b.tanggalUji
      return da.getTime() - db_.getTime()
    }).slice(0, 6)

    // Aktivitas terbaru
    const aktivitasTerbaru = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    })

    return NextResponse.json({
      totalPelatihan,
      totalAngkatan,
      totalPeserta,
      totalUjiKompetensi,
      totalAsesor,
      totalAnalisis,
      pelatihanBerjalan,
      pesertaLulus,
      pesertaTidakLulus,
      ujiSelesai,
      grafikPelatihanPerBulan: monthsData,
      grafikKelulusan,
      grafikKategoriPelatihan: grafikKategoriPelatihan,
      jadwalTerdekat,
      aktivitasTerbaru,
    })
  } catch (e) {
    console.error('Dashboard error:', e)
    return NextResponse.json({ error: 'Gagal memuat dashboard' }, { status: 500 })
  }
}
