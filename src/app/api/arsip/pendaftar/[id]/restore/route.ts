import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pendaftaran:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.pendaftaranPortal.findUnique({ where: { id } })
    if (!item || !item.deleted) {
      return NextResponse.json({ error: 'Data tidak ditemukan di arsip' }, { status: 404 })
    }
    await db.pendaftaranPortal.update({ where: { id }, data: { deleted: false, deletedAt: null } })
    await auditLog(session, 'UPDATE', 'PENDAFTARAN_PORTAL', `Pulihkan pendaftar dari arsip: ${item.nama} (${item.nip})`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('arsip pendaftar restore error:', e)
    return NextResponse.json({ error: 'Gagal memulihkan pendaftar' }, { status: 500 })
  }
}
