import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const pesertaAngkatan = await db.pesertaAngkatan.findMany({
      include: {
        angkatan: {
          include: {
            pelatihan: true,
            ujiKompetensi: true,
          },
        },
      },
    })

    const map: Record<string, string> = {}
    for (const pa of pesertaAngkatan) {
      const ang = pa.angkatan
      if (!map[pa.pesertaId]) map[pa.pesertaId] = ''
      if (ang.ujiKompetensi && ang.ujiKompetensi.length > 0) {
        for (const uk of ang.ujiKompetensi) {
          if (map[pa.pesertaId]) map[pa.pesertaId] += '; '
          map[pa.pesertaId] += `UK: ${uk.skemaSertifikasi}`
        }
      } else if (ang.pelatihan) {
        if (map[pa.pesertaId]) map[pa.pesertaId] += '; '
        map[pa.pesertaId] += `P: ${ang.pelatihan.nama}`
      }
    }

    return NextResponse.json(map)
  } catch (e) {
    console.error('peserta kegiatan-map error:', e)
    return NextResponse.json({ error: 'Gagal memuat data kegiatan' }, { status: 500 })
  }
}
