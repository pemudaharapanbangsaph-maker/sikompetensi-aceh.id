import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.peserta.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Peserta tidak ditemukan' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    console.error('peserta get error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const { tanggalLahir, ...rest } = body
    const data: Record<string, unknown> = { ...rest }
    if (tanggalLahir) data.tanggalLahir = new Date(tanggalLahir)
    const item = await db.peserta.update({ where: { id }, data: data as any })
    await auditLog(session, 'UPDATE', 'PESERTA', `Ubah peserta: ${body.nama || id}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('peserta update error:', e)
    return NextResponse.json({ error: 'Gagal mengubah peserta' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.peserta.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'PESERTA', `Hapus peserta: ${item.nama}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('peserta delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus peserta' }, { status: 500 })
  }
}
