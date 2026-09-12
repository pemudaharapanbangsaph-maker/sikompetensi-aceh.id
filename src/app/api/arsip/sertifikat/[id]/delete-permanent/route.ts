import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import { safeUnlinkStored } from '@/lib/storage'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'sertifikat:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.sertifikat.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 })
    // Hapus file fisik
    if (item.file) await safeUnlinkStored(item.file, 'sertifikat')
    await db.sertifikat.delete({ where: { id } })
    await auditLog(session, 'DELETE_PERMANENT', 'ARSIP_SERTIFIKAT', `Hapus permanen sertifikat: ${item.nomorSertifikat || item.namaPeserta || id}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('arsip sertifikat delete permanent error:', e)
    return NextResponse.json({ error: 'Gagal menghapus permanen' }, { status: 500 })
  }
}
