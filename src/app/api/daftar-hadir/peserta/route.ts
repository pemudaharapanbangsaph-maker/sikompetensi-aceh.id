import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const angkatanId = searchParams.get('angkatanId')
    if (!angkatanId) return NextResponse.json({ error: 'angkatanId wajib diisi' }, { status: 400 })

    const pesertaAngkatan = await db.pesertaAngkatan.findMany({
      where: { angkatanId },
      include: { peserta: true },
      orderBy: { peserta: { nama: 'asc' } },
    })

    const result = pesertaAngkatan.map((pa, i) => ({
      no: i + 1,
      pesertaId: pa.pesertaId,
      nama: pa.peserta.nama,
      nip: pa.peserta.nip,
      instansi: pa.peserta.instansi || pa.peserta.unitKerja || '-',
    }))

    return NextResponse.json(result)
  } catch (e) {
    console.error('daftar-hadir peserta error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}
