import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.analisisKebutuhan.findUnique({
      where: { id },
      include: { pelatihan: true, user: true },
    })
    if (!item) return NextResponse.json({ error: 'Analisis tidak ditemukan' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    console.error('analisis get error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const data: Record<string, unknown> = { ...body, dibuatOleh: session.user.id }
    if (body.tahun !== undefined) data.tahun = Number(body.tahun)
    if (body.jumlahPegawai !== undefined) data.jumlahPegawai = Number(body.jumlahPegawai)
    const item = await db.analisisKebutuhan.update({
      where: { id },
      data: data as any,
      include: { pelatihan: true },
    })
    await auditLog(session, 'UPDATE', 'ANALISIS', `Ubah analisis kebutuhan: ${item.judul}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('analisis update error:', e)
    return NextResponse.json({ error: 'Gagal mengubah analisis' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.analisisKebutuhan.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'ANALISIS', `Hapus analisis kebutuhan: ${item.judul}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('analisis delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus analisis' }, { status: 500 })
  }
}
