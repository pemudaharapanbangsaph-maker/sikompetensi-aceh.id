import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

/**
 * GET /api/pendaftaran/pelatihan-options
 * Mengembalikan daftar nama pelatihan yang memiliki pendaftar.
 * Menggunakan namaPelatihan langsung (bukan pelatihanId) agar
 * tetap bekerja meskipun AnalisisDiklatItem belum terhubung ke Pelatihan.
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ambil semua AnalisisDiklatItem yang punya pendaftar
    const items = await db.analisisDiklatItem.findMany({
      where: {
        pendaftaran: { some: {} },
      },
      select: {
        namaPelatihan: true,
        _count: { select: { pendaftaran: true } },
      },
      orderBy: { namaPelatihan: 'asc' },
    })

    // Dedup by namaPelatihan dan hitung total pendaftar
    const seen = new Map<string, number>()
    for (const item of items) {
      if (!item.namaPelatihan) continue
      const existing = seen.get(item.namaPelatihan)
      if (existing !== undefined) {
        seen.set(item.namaPelatihan, existing + item._count.pendaftaran)
      } else {
        seen.set(item.namaPelatihan, item._count.pendaftaran)
      }
    }

    const result = Array.from(seen.entries()).map(([nama, jumlah]) => ({
      nama,
      jumlahPendaftar: jumlah,
    }))

    return NextResponse.json(result)
  } catch (e) {
    console.error('pendaftaran pelatihan-options error:', e)
    return NextResponse.json({ error: 'Gagal memuat opsi pelatihan' }, { status: 500 })
  }
}
