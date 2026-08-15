import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.ujiKompetensi.findUnique({ where: { id } })
    if (!item || !item.deleted) {
      return NextResponse.json({ error: 'Data tidak ditemukan di arsip' }, { status: 404 })
    }
    const restored = await db.ujiKompetensi.update({
      where: { id },
      data: { deleted: false, deletedAt: null },
    })
    await auditLog(session, 'UPDATE', 'UJI_KOMPETENSI', `Pulihkan uji kompetensi dari arsip: ${restored.kode}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('arsip uji kompetensi restore error:', e)
    return NextResponse.json({ error: 'Gagal memulihkan uji kompetensi' }, { status: 500 })
  }
}
