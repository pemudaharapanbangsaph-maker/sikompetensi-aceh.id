import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

// POST: bulk add peserta to angkatan (use upsert to avoid duplicates)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const { pesertaIds } = await req.json()
    if (!Array.isArray(pesertaIds) || pesertaIds.length === 0) {
      return NextResponse.json({ error: 'pesertaIds wajib diisi' }, { status: 400 })
    }
    const angkatan = await db.angkatan.findUnique({ where: { id } })
    if (!angkatan) return NextResponse.json({ error: 'Angkatan tidak ditemukan' }, { status: 404 })

    await Promise.all(
      pesertaIds.map((pesertaId) =>
        db.pesertaAngkatan.upsert({
          where: { angkatanId_pesertaId: { angkatanId: id, pesertaId } },
          update: {},
          create: { angkatanId: id, pesertaId },
        })
      )
    )
    await auditLog(session, 'UPDATE', 'ANGKATAN', `Tambah ${pesertaIds.length} peserta ke angkatan: ${angkatan.namaAngkatan}`, req)
    return NextResponse.json({ success: true, count: pesertaIds.length })
  } catch (e) {
    console.error('angkatan add peserta error:', e)
    return NextResponse.json({ error: 'Gagal menambah peserta' }, { status: 500 })
  }
}
