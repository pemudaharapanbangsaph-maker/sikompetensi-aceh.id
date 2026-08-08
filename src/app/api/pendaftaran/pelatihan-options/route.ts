import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

/**
 * GET /api/pendaftaran/pelatihan-options
 * Mengembalikan daftar pelatihan yang memiliki pendaftar,
 * beserta jumlah pendaftarnya. Digunakan untuk dropdown filter
 * di halaman Dokumen Peserta.
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ambil AnalisisDiklatItem yang punya pendaftar dan terhubung ke pelatihan
    const items = await db.analisisDiklatItem.findMany({
      where: {
        pelatihanId: { not: null },
        pendaftaran: { some: {} },
      },
      select: {
        pelatihanId: true,
        pelatihan: { select: { id: true, kode: true, nama: true } },
        _count: { select: { pendaftaran: true } },
      },
      orderBy: { pelatihan: { nama: 'asc' } },
    })

    // Dedup by pelatihanId & hitung total pendaftar per pelatihan
    const seen = new Map<string, { id: string; kode: string; nama: string; jumlahPendaftar: number }>()
    for (const item of items) {
      if (item.pelatihan && item.pelatihanId) {
        const existing = seen.get(item.pelatihanId)
        if (existing) {
          existing.jumlahPendaftar += item._count.pendaftaran
        } else {
          seen.set(item.pelatihanId, {
            id: item.pelatihan.id,
            kode: item.pelatihan.kode,
            nama: item.pelatihan.nama,
            jumlahPendaftar: item._count.pendaftaran,
          })
        }
      }
    }

    return NextResponse.json(Array.from(seen.values()))
  } catch (e) {
    console.error('pendaftaran pelatihan-options error:', e)
    return NextResponse.json({ error: 'Gagal memuat opsi pelatihan' }, { status: 500 })
  }
}
