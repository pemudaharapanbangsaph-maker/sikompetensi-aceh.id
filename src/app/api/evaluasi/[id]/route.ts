import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'monitoring:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    await db.evaluasi.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'EVALUASI', `Hapus evaluasi: ${id}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('evaluasi delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus evaluasi' }, { status: 500 })
  }
}
