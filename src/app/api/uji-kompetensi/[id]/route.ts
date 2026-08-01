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
    const item = await db.ujiKompetensi.findUnique({
      where: { id },
      include: {
        angkatan: { include: { pelatihan: true } },
        asesor: { include: { asesor: true } },
        nilai: { include: { peserta: true } },
      },
    })
    if (!item) return NextResponse.json({ error: 'Uji kompetensi tidak ditemukan' }, { status: 404 })
    return NextResponse.json({
      ...item,
      asesor: item.asesor.map((a) => a.asesor),
    })
  } catch (e) {
    console.error('uji-kompetensi get error:', e)
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
    const { tanggalUji, asesorIds, ...rest } = body
    const data: Record<string, unknown> = { ...rest }
    if (tanggalUji) data.tanggalUji = new Date(tanggalUji)
    if (body.jumlahPeserta !== undefined) data.jumlahPeserta = Number(body.jumlahPeserta)

    if (Array.isArray(asesorIds)) {
      // Replace asesor relations
      await db.ujiKompetensiAsesor.deleteMany({ where: { ujiKompetensiId: id } })
      if (asesorIds.length > 0) {
        data.asesor = {
          create: asesorIds.map((asesorId: string) => ({ asesorId })),
        }
      }
    }

    const item = await db.ujiKompetensi.update({
      where: { id },
      data: data as any,
      include: {
        angkatan: { include: { pelatihan: true } },
        asesor: { include: { asesor: true } },
      },
    })
    await auditLog(session, 'UPDATE', 'UJI_KOMPETENSI', `Ubah uji kompetensi: ${item.kode}`, req)
    return NextResponse.json({
      ...item,
      asesor: item.asesor.map((a) => a.asesor),
    })
  } catch (e) {
    console.error('uji-kompetensi update error:', e)
    return NextResponse.json({ error: 'Gagal mengubah uji kompetensi' }, { status: 500 })
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
    const item = await db.ujiKompetensi.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'UJI_KOMPETENSI', `Hapus uji kompetensi: ${item.kode}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('uji-kompetensi delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus uji kompetensi' }, { status: 500 })
  }
}
