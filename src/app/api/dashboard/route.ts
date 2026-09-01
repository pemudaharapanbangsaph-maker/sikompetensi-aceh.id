import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [totalPelatihan, totalAngkatan, totalPeserta, totalAsesor, totalAnalisis] = await Promise.all([
      db.pelatihan.count({
        where: { deleted: false },
      }),
      db.angkatan.count({
        where: { pelatihan: { deleted: false }, deleted: false },
      }),
      db.peserta.count({ where: { deleted: false } }),
      db.asesor.count(),
      db.analisisKebutuhan.count(),
    ])

    const pelatihanBerjalan = await db.angkatan.count({
      where: { status: 'BERJALAN', pelatihan: { deleted: false }, deleted: false },
    })
    const angkatanSelesai = await db.angkatan.count({
      where: { status: 'SELESAI', pelatihan: { deleted: false }, deleted: false },
    })
    const [pendaftaranPortal, pendaftaranMenunggu] = await Promise.all([
      db.pendaftaranPortal.count(),
      db.pendaftaranPortal.count({ where: { status: 'MENUNGGU' } }),
    ])
    // Trend: angkatan bulan ini vs bulan lalu
    const now = new Date()
    const startBulanIni = new Date(now.getFullYear(), now.getMonth(), 1)
    const startBulanLalu = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const [angkatanBulanIni, angkatanBulanLalu] = await Promise.all([
      db.angkatan.count({
        where: { tanggalMulai: { gte: startBulanIni }, pelatihan: { deleted: false }, deleted: false },
      }),
      db.angkatan.count({
        where: { tanggalMulai: { gte: startBulanLalu, lt: startBulanIni }, pelatihan: { deleted: false }, deleted: false },
      }),
    ])
    let trendPelatihan: { value: string; up: boolean } | null = null
    if (angkatanBulanLalu > 0) {
      const pct = Math.round(((angkatanBulanIni - angkatanBulanLalu) / angkatanBulanLalu) * 100)
      trendPelatihan = { value: `${Math.abs(pct)}% bulan ini`, up: pct >= 0 }
    } else if (angkatanBulanIni > 0) {
      trendPelatihan = { value: `${angkatanBulanIni} baru bulan ini`, up: true }
    }

    // Grafik pelatihan per bulan (12 bulan terakhir)
    const monthsData: { bulan: string; jumlah: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const jumlah = await db.angkatan.count({
        where: {
          tanggalMulai: { gte: start, lt: end },
          pelatihan: { deleted: false },
          deleted: false,
        },
      })
      monthsData.push({ bulan: start.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }), jumlah })
    }

    // Grafik peserta per angkatan terbaru (top 6)
    const angkatanTerbaru = await db.angkatan.findMany({
      where: { pelatihan: { deleted: false }, deleted: false },
      include: { pelatihan: true, _count: { select: { peserta: true } } },
      take: 6,
      orderBy: { createdAt: 'desc' },
    })
    const grafikPesertaPerAngkatan = angkatanTerbaru.map((a) => ({
      nama: a.pelatihan?.nama?.substring(0, 20) || a.namaAngkatan,
      peserta: a._count.peserta,
    }))

    // Grafik kategori pelatihan
    const kategoriList = ['TEKNIS', 'MANAJERIAL', 'FUNGSIONAL', 'SOSIAL_KULTURAL']
    const grafikKategoriPelatihan = await Promise.all(kategoriList.map(async (k) => ({
      kategori: k.replace('_', ' '),
      jumlah: await db.pelatihan.count({ where: { kategori: k, deleted: false } }),
    })))

    // Jadwal terdekat
    const upcomingAngkatan = await db.angkatan.findMany({
      where: {
        tanggalMulai: { gte: now },
        status: { in: ['PERENCANAAN', 'BERJALAN'] },
        pelatihan: { deleted: false },
        deleted: false,
      },
      include: { pelatihan: true },
      orderBy: { tanggalMulai: 'asc' },
      take: 5,
    })
    const jadwalTerdekat = upcomingAngkatan.slice(0, 6)

    // Aktivitas terbaru
    const aktivitasTerbaru = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    })

    return NextResponse.json({
      totalPelatihan,
      totalAngkatan,
      totalPeserta,
      totalAsesor,
      totalAnalisis,
      pelatihanBerjalan,
      angkatanSelesai,
      pendaftaranPortal,
      pendaftaranMenunggu,
      grafikPelatihanPerBulan: monthsData,
      grafikPesertaPerAngkatan,
      grafikKategoriPelatihan,
      jadwalTerdekat,
      aktivitasTerbaru,
      trendPelatihan,
    })
  } catch (e) {
    console.error('Dashboard error:', e)
    return NextResponse.json({ error: 'Gagal memuat dashboard' }, { status: 500 })
  }
}
