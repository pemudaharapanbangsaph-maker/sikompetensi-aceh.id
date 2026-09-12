import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const where: Record<string, unknown> = { deleted: true }
    if (search) {
      where.OR = [
        { judul: { contains: search } },
        { unitKerja: { contains: search } },
      ]
    }
    const data = await db.analisisKebutuhan.findMany({
      where,
      include: { pelatihan: { select: { id: true, nama: true, kode: true } }, user: { select: { nama: true } } },
      orderBy: { deletedAt: 'desc' },
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error('arsip analisis list error:', e)
    return NextResponse.json({ error: 'Gagal memuat arsip analisis' }, { status: 500 })
  }
}
