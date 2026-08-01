import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

// GET: list kehadiran for angkatan (with peserta)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const data = await db.kehadiran.findMany({
      where: { angkatanId: id },
      include: { peserta: true },
      orderBy: { tanggal: 'desc' },
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error('kehadiran list error:', e)
    return NextResponse.json({ error: 'Gagal memuat kehadiran' }, { status: 500 })
  }
}

// POST: set/update kehadiran (upsert on [angkatanId, pesertaId, tanggal])
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const { pesertaId, tanggal, statusKehadiran, keterangan } = body
    if (!pesertaId || !tanggal) {
      return NextResponse.json({ error: 'pesertaId dan tanggal wajib diisi' }, { status: 400 })
    }
    const tanggalDate = new Date(tanggal)
    const item = await db.kehadiran.upsert({
      where: {
        angkatanId_pesertaId_tanggal: { angkatanId: id, pesertaId, tanggal: tanggalDate },
      },
      update: {
        statusKehadiran: statusKehadiran || 'HADIR',
        keterangan: keterangan || null,
      },
      create: {
        angkatanId: id,
        pesertaId,
        tanggal: tanggalDate,
        statusKehadiran: statusKehadiran || 'HADIR',
        keterangan: keterangan || null,
      },
      include: { peserta: true },
    })
    await auditLog(session, 'UPDATE', 'KEHADIRAN', `Set kehadiran peserta ${pesertaId} pada ${tanggal}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('kehadiran set error:', e)
    return NextResponse.json({ error: 'Gagal menyimpan kehadiran' }, { status: 500 })
  }
}
