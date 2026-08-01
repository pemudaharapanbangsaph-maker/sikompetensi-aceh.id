import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.asesor.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Asesor tidak ditemukan' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    console.error('asesor get error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const { tanggalSertifikat, ...rest } = body
    const data: Record<string, unknown> = { ...rest }
    if (tanggalSertifikat) data.tanggalSertifikat = new Date(tanggalSertifikat)
    const item = await db.asesor.update({ where: { id }, data: data as any })
    await auditLog(session, 'UPDATE', 'ASESOR', `Ubah asesor: ${item.nama}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('asesor update error:', e)
    return NextResponse.json({ error: 'Gagal mengubah asesor' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.asesor.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'ASESOR', `Hapus asesor: ${item.nama}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('asesor delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus asesor' }, { status: 500 })
  }
}
