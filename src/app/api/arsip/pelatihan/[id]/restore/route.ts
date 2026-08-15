import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.pelatihan.findUnique({ where: { id } })
    if (!item || !item.deleted) {
      return NextResponse.json({ error: 'Data tidak ditemukan di arsip' }, { status: 404 })
    }
    const restored = await db.pelatihan.update({
      where: { id },
      data: { deleted: false, deletedAt: null },
    })
    await auditLog(session, 'UPDATE', 'PELATIHAN', `Pulihkan pelatihan dari arsip: ${restored.nama}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('arsip pelatihan restore error:', e)
    return NextResponse.json({ error: 'Gagal memulihkan pelatihan' }, { status: 500 })
  }
}
