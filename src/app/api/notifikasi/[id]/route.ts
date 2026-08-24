import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const item = await db.notifikasiEmail.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Notifikasi tidak ditemukan' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    console.error('notifikasi get error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const existing = await db.notifikasiEmail.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Notifikasi tidak ditemukan' }, { status: 404 })

    await db.notifikasiEmail.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'NOTIFIKASI', `Hapus notifikasi: ${existing.subjek}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('notifikasi delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus notifikasi' }, { status: 500 })
  }
}
