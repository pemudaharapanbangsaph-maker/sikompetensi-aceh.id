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
    const item = await db.angkatan.findUnique({
      where: { id },
      include: {
        pelatihan: true,
        peserta: { include: { peserta: true } },
        _count: { select: { peserta: true, kehadiran: true, ujiKompetensi: true } },
      },
    })
    if (!item) return NextResponse.json({ error: 'Angkatan tidak ditemukan' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    console.error('angkatan get error:', e)
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
    const { tanggalMulai, tanggalSelesai, ...rest } = body
    const data: Record<string, unknown> = { ...rest }
    if (tanggalMulai) data.tanggalMulai = new Date(tanggalMulai)
    if (tanggalSelesai) data.tanggalSelesai = new Date(tanggalSelesai)
    if (body.kuota !== undefined) data.kuota = Number(body.kuota)
    const item = await db.angkatan.update({ where: { id }, data: data as any })
    await auditLog(session, 'UPDATE', 'ANGKATAN', `Ubah angkatan: ${item.namaAngkatan}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('angkatan update error:', e)
    return NextResponse.json({ error: 'Gagal mengubah angkatan' }, { status: 500 })
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
    const item = await db.angkatan.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'ANGKATAN', `Hapus angkatan: ${item.namaAngkatan}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('angkatan delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus angkatan' }, { status: 500 })
  }
}
