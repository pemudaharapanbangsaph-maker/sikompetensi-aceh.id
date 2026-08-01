import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

// GET: rekap grouped by tahun + jenisKompetensi with counts
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rows = await db.analisisKebutuhan.groupBy({
      by: ['tahun', 'jenisKompetensi'],
      _count: { _all: true },
      orderBy: { tahun: 'desc' },
    })

    const result = rows.map((r) => ({
      tahun: r.tahun,
      jenisKompetensi: r.jenisKompetensi,
      jumlah: r._count._all,
    }))

    return NextResponse.json(result)
  } catch (e) {
    console.error('analisis rekap error:', e)
    return NextResponse.json({ error: 'Gagal memuat rekap analisis' }, { status: 500 })
  }
}


