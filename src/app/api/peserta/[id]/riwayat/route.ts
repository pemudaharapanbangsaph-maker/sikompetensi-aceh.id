import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params

    const peserta = await db.peserta.findUnique({ where: { id } })
    if (!peserta) return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })

    const [angkatan, nilai] = await Promise.all([
      db.pesertaAngkatan.findMany({
        where: { pesertaId: id },
        include: { angkatan: { include: { pelatihan: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.nilai.findMany({
        where: { pesertaId: id },
        include: { ujiKompetensi: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      angkatan: angkatan.map((pa) => ({
        ...pa.angkatan,
        pelatihan: pa.angkatan.pelatihan,
        statusPeserta: pa.status,
        nilaiAkhir: pa.nilaiAkhir,
      })),
      nilai,
    })
  } catch (e) {
    console.error('peserta riwayat error:', e)
    return NextResponse.json({ error: 'Gagal memuat riwayat peserta' }, { status: 500 })
  }
}
