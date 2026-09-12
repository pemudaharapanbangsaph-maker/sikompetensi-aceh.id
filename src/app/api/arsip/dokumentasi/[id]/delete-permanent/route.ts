import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.dokumentasi.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })
    await db.dokumentasi.delete({ where: { id } })
    await auditLog(session, 'DELETE_PERMANENT', 'ARSIP_DOKUMENTASI', `Hapus permanen dokumentasi: ${item.judul}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('arsip dokumentasi delete permanent error:', e)
    return NextResponse.json({ error: 'Gagal menghapus permanen' }, { status: 500 })
  }
}
