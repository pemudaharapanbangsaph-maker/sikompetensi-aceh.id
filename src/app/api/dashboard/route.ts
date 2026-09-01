import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    if (!q || q.length < 2) return NextResponse.json({ results: [] })

    const results: { type: string; label: string; sub: string; view: string; id: string }[] = []
    const maxPerModule = 5

    // Pelatihan
    const pelatihan = await db.pelatihan.findMany({
      where: {
        deleted: false,
        OR: [
          { nama: { contains: q } },
          { kode: { contains: q } },
        ],
      },
      take: maxPerModule,
      orderBy: { createdAt: 'desc' },
    })
    for (const p of pelatihan) {
      results.push({
        type: 'Pelatihan',
        label: p.nama,
        sub: `${p.kode} · ${p.kategori}`,
        view: 'pelatihan',
        id: p.id,
      })
    }

    // Angkatan
    const angkatan = await db.angkatan.findMany({
      where: {
        deleted: false,
        OR: [
          { namaAngkatan: { contains: q } },
          { lokasi: { contains: q } },
        ],
      },
      take: maxPerModule,
      include: { pelatihan: { select: { nama: true, kode: true } } },
      orderBy: { createdAt: 'desc' },
    })
    for (const a of angkatan) {
      results.push({
        type: 'Angkatan',
        label: a.namaAngkatan,
        sub: a.pelatihan ? `${a.pelatihan.kode} · ${a.pelatihan.nama}` : '',
        view: 'pelatihan-jadwal',
        id: a.id,
      })
    }

    // Peserta
    const peserta = await db.peserta.findMany({
      where: {
        deleted: false,
        OR: [
          { nama: { contains: q } },
          { nip: { contains: q } },
          { unitKerja: { contains: q } },
        ],
      },
      take: maxPerModule,
      orderBy: { createdAt: 'desc' },
    })
    for (const p of peserta) {
      results.push({
        type: 'Peserta',
        label: p.nama,
        sub: `NIP: ${p.nip}${p.unitKerja ? ` · ${p.unitKerja}` : ''}`,
        view: 'peserta',
        id: p.id,
      })
    }

    // Analisis Kebutuhan
    const analisis = await db.analisisKebutuhan.findMany({
      where: {
        OR: [
          { judul: { contains: q } },
          { unitKerja: { contains: q } },
        ],
      },
      take: maxPerModule,
      orderBy: { createdAt: 'desc' },
    })
    for (const a of analisis) {
      results.push({
        type: 'Analisis',
        label: a.judul,
        sub: `Tahun ${a.tahun} · ${a.unitKerja}`,
        view: 'analisis',
        id: a.id,
      })
    }

    return NextResponse.json({ results: results.slice(0, 20) })
  } catch (e) {
    console.error('global search error:', e)
    return NextResponse.json({ results: [] })
  }
}
