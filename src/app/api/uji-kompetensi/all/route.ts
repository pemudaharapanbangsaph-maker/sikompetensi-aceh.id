import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const data = await db.ujiKompetensi.findMany({
      include: {
        angkatan: { include: { pelatihan: true } },
        asesor: { include: { asesor: true } },
        _count: { select: { nilai: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(
      data.map((u) => ({ ...u, asesor: u.asesor.map((a) => a.asesor) }))
    )
  } catch (e) {
    console.error('uji-kompetensi all error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}
