import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const item = await db.analisisDiklatItem.update({
      where: { id },
      data: {
        ...body,
        durasiJP: body.durasiJP !== undefined ? Number(body.durasiJP) : undefined,
        durasiHari: body.durasiHari !== undefined ? Number(body.durasiHari) : undefined,
        tahunPelaksanaan: body.tahunPelaksanaan !== undefined ? Number(body.tahunPelaksanaan) : undefined,
      },
    })
    await auditLog(session, 'UPDATE', 'ANALISIS_DIKLAT', 'Update item analisis diklat', req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('analisis-diklat update error:', e)
    return NextResponse.json({ error: 'Gagal memperbarui data' }, { status: 500 })
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
    await db.analisisDiklatItem.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'ANALISIS_DIKLAT', 'Hapus item analisis diklat', req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('analisis-diklat delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus data' }, { status: 500 })
  }
}
