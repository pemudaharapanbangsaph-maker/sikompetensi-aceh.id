import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const item = await db.persetujuan.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Persetujuan tidak ditemukan' }, { status: 404 })
    return NextResponse.json(item)
  } catch (e) {
    console.error('persetujuan get error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const existing = await db.persetujuan.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Persetujuan tidak ditemukan' }, { status: 404 })

    if (existing.status !== 'MENUNGGU') {
      return NextResponse.json({ error: `Persetujuan sudah ${existing.status}, tidak dapat diubah` }, { status: 400 })
    }

    const body = await req.json()
    const { action, catatan, approverId, approverNama } = body

    if (!action || !['DISETUJUI', 'DITOLAK'].includes(action)) {
      return NextResponse.json({ error: 'Action harus DISETUJUI atau DITOLAK' }, { status: 400 })
    }

    const item = await db.persetujuan.update({
      where: { id },
      data: {
        status: action,
        catatan: catatan || existing.catatan || null,
        approverId: approverId || session.user.id,
        approverNama: approverNama || session.user.nama,
      },
    })

    const aksiLabel = action === 'DISETUJUI' ? 'Setujui' : 'Tolak'
    await auditLog(session, 'UPDATE', 'PERSETUJUAN', `${aksiLabel} persetujuan ${existing.jenis}: ${existing.judul}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('persetujuan update error:', e)
    return NextResponse.json({ error: 'Gagal memproses persetujuan' }, { status: 500 })
  }
}
