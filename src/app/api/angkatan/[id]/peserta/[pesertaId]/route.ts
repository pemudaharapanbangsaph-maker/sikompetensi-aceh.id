import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

// DELETE: remove peserta from angkatan
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; pesertaId: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id, pesertaId } = await params
    await db.pesertaAngkatan.delete({
      where: { angkatanId_pesertaId: { angkatanId: id, pesertaId } },
    })
    await auditLog(session, 'UPDATE', 'ANGKATAN', `Hapus peserta dari angkatan: ${id}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('angkatan remove peserta error:', e)
    return NextResponse.json({ error: 'Gagal menghapus peserta' }, { status: 500 })
  }
}
