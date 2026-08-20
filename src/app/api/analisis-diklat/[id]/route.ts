import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

// --- Helper: sinkronisasi AnalisisDiklat → Pelatihan (update saja, angkatan sudah ada) ---
async function syncToPelatihan(analisisId: string, data: {
  namaPelatihan: string
  kategori: string
  metodePembelajaran: string
  durasiJP: number
  durasiHari: number
  tahunPelaksanaan: number
  prioritas: string
  targetOutput: string
  status: string
  outcome: string
}) {
  const analisisItem = await db.analisisDiklatItem.findUnique({
    where: { id: analisisId },
    select: { pelatihanId: true },
  })

  if (!analisisItem?.pelatihanId) return

  const pelatihanStatus = data.status === 'AKTIF' ? 'AKTIF' : 'NONAKTIF'
  const durasiHari = data.durasiHari > 0 ? data.durasiHari : Math.max(1, Math.ceil(data.durasiJP / 8))
  const deskripsi = [
    data.outcome ? `Outcome: ${data.outcome}` : '',
    `Metode: ${data.metodePembelajaran === 'TATAP_MUKA' ? 'Tatap Muka' : data.metodePembelajaran === 'DARING' ? 'Daring' : 'Blended'}`,
    `Prioritas: ${data.prioritas}`,
    data.targetOutput ? `Target: ${data.targetOutput}` : '',
    `Tahun: ${data.tahunPelaksanaan}`,
  ].filter(Boolean).join(' | ')

  await db.pelatihan.update({
    where: { id: analisisItem.pelatihanId },
    data: {
      nama: data.namaPelatihan,
      kategori: data.kategori,
      deskripsi,
      jp: data.durasiJP || 8,
      durasiHari,
      status: pelatihanStatus,
    },
  })
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
    const item = await db.analisisDiklatItem.update({
      where: { id },
      data: {
        ...body,
        durasiJP: body.durasiJP !== undefined ? Number(body.durasiJP) : undefined,
        durasiHari: body.durasiHari !== undefined ? Number(body.durasiHari) : undefined,
        tahunPelaksanaan: body.tahunPelaksanaan !== undefined ? Number(body.tahunPelaksanaan) : undefined,
        tanggalPelaksanaan: body.tanggalPelaksanaan ? new Date(body.tanggalPelaksanaan) : body.tanggalPelaksanaan === null ? null : undefined,
      },
    })
    // Sinkronisasi ke Pelatihan
    await syncToPelatihan(item.id, {
      namaPelatihan: item.namaPelatihan,
      kategori: item.kategori,
      metodePembelajaran: item.metodePembelajaran,
      durasiJP: item.durasiJP,
      durasiHari: item.durasiHari,
      tahunPelaksanaan: item.tahunPelaksanaan,
      prioritas: item.prioritas,
      targetOutput: item.targetOutput,
      status: item.status,
      outcome: item.outcome,
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
    // Cek dan nonaktifkan Pelatihan yang terlink sebelum hapus
    const analisisItem = await db.analisisDiklatItem.findUnique({
      where: { id },
      select: { pelatihanId: true },
    })
    if (analisisItem?.pelatihanId) {
      await db.pelatihan.update({
        where: { id: analisisItem.pelatihanId },
        data: { status: 'NONAKTIF' },
      })
    }
    await db.analisisDiklatItem.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'ANALISIS_DIKLAT', 'Hapus item analisis diklat', req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('analisis-diklat delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus data' }, { status: 500 })
  }
}
