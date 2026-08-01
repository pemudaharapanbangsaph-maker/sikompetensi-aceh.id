import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.pelatihan.findUnique({
      where: { id },
      include: { _count: { select: { angkatan: true, analisis: true } } },
    })
    if (!item) return NextResponse.json({ error: 'Pelatihan tidak ditemukan' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    console.error('pelatihan get error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = { ...body }
    if (body.durasiHari !== undefined) data.durasiHari = Number(body.durasiHari)
    if (body.jp !== undefined) data.jp = Number(body.jp)
    const item = await db.pelatihan.update({ where: { id }, data: data as any })
    await auditLog(session, 'UPDATE', 'PELATIHAN', `Ubah pelatihan: ${item.nama}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('pelatihan update error:', e)
    return NextResponse.json({ error: 'Gagal mengubah pelatihan' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.pelatihan.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'PELATIHAN', `Hapus pelatihan: ${item.nama}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('pelatihan delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus pelatihan' }, { status: 500 })
  }
}
