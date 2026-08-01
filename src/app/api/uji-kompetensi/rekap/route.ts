import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

// GET: rekap per uji kompetensi — total peserta, lulus, tidak lulus, persentase kelulusan
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ujiList = await db.ujiKompetensi.findMany({
      include: {
        _count: { select: { nilai: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = await Promise.all(
      ujiList.map(async (u) => {
        const [total, lulus, tidakLulus] = await Promise.all([
          db.nilai.count({ where: { ujiKompetensiId: u.id } }),
          db.nilai.count({ where: { ujiKompetensiId: u.id, statusKelulusan: 'LULUS' } }),
          db.nilai.count({ where: { ujiKompetensiId: u.id, statusKelulusan: 'TIDAK_LULUS' } }),
        ])
        return {
          id: u.id,
          kode: u.kode,
          skemaSertifikasi: u.skemaSertifikasi,
          tanggalUji: u.tanggalUji,
          status: u.status,
          totalPeserta: total,
          lulus,
          tidakLulus,
          persentaseKelulusan: total > 0 ? Math.round((lulus / total) * 1000) / 10 : 0,
        }
      })
    )

    return NextResponse.json(result)
  } catch (e) {
    console.error('uji-kompetensi rekap error:', e)
    return NextResponse.json({ error: 'Gagal memuat rekap uji kompetensi' }, { status: 500 })
  }
}
