import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

/**
 * GET /api/arsip/peserta/angkatan-options?tipe=PELATIHAN|UJI_KOMPETENSI
 * Returns list of angkatan or uji kompetensi for the dropdown filter.
 */
export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const tipe = new URL(req.url).searchParams.get('tipe')

    if (tipe === 'PELATIHAN') {
      const angkatan = await db.angkatan.findMany({
        where: {
          peserta: { some: { deleted: true } },
        },
        include: {
          pelatihan: { select: { nama: true } },
          _count: { select: { peserta: { where: { deleted: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })
      const options = angkatan.map(a => ({
        id: a.id,
        label: `${a.namaAngkatan} — ${a.pelatihan?.nama || '-'}`,
        count: a._count.peserta,
      }))
      return NextResponse.json(options)
    }

    if (tipe === 'UJI_KOMPETENSI') {
      const uji = await db.ujiKompetensi.findMany({
        where: {
          nilai: { some: { peserta: { deleted: true } } },
        },
        include: {
          _count: { select: { nilai: { where: { peserta: { deleted: true } } } } },
        },
        orderBy: { createdAt: 'desc' },
      })
      const options = uji.map(u => ({
        id: u.id,
        label: `${u.kode} — ${u.skemaSertifikasi}`,
        count: u._count.nilai,
      }))
      return NextResponse.json(options)
    }

    return NextResponse.json([])
  } catch (e) {
    console.error('arsip peserta angkatan-options error:', e)
    return NextResponse.json({ error: 'Gagal memuat opsi' }, { status: 500 })
  }
}
