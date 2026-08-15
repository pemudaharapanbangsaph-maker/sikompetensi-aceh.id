import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.peserta.update({
      where: { id },
      data: { deleted: false, deletedAt: null },
    })
    await auditLog(session, 'RESTORE', 'ARSIP_PESERTA', `Pulihkan peserta: ${item.nama}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('arsip peserta restore error:', e)
    return NextResponse.json({ error: 'Gagal memulihkan peserta' }, { status: 500 })
  }
}
