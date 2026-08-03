import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const items = await db.analisisDiklatItem.findMany({
      where: { status: 'AKTIF' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const total = await db.analisisDiklatItem.count({ where: { status: 'AKTIF' } })

    const programs = items.map((p) => ({
      id: p.id,
      nama: p.namaPelatihan,
      kategori: p.kategori,
      jp: p.durasiJP,
      metode: p.metodePembelajaran,
      prioritas: p.prioritas,
      tahun: p.tahunPelaksanaan,
      targetOutput: p.targetOutput,
      outcome: p.outcome,
      programPrioritasRPJMA: p.programPrioritasRPJMA,
    }))

    return NextResponse.json({ programs, total })
  } catch (error) {
    console.error('Failed to fetch programs:', error)
    return NextResponse.json({ programs: [], total: 0 }, { status: 500 })
  }
}
