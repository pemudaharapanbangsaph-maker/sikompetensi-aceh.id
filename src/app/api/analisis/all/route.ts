import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const data = await db.analisisKebutuhan.findMany({
      include: { pelatihan: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error('analisis all error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}
