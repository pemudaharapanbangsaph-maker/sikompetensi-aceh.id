import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

// --- Helper: sinkronisasi AnalisisDiklat → Pelatihan (saat update) ---
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
}, userId?: string) {
  const existing = await db.pelatihan.findUnique({
    where: { analisisDiklatId: analisisId },
  })

  const pelatihanStatus = data.status === 'AKTIF' ? 'AKTIF' : 'NONAKTIF'
  const durasiHari = data.durasiHari > 0 ? data.durasiHari : Math.max(1, Math.ceil(data.durasiJP / 8))
  const deskripsi = [
    data.outcome ? `Outcome: ${data.outcome}` : '',
    `Metode: ${data.metodePembelajaran === 'TATAP_MUKA' ? 'Tatap Muka' : data.metodePembelajaran === 'DARING' ? 'Daring' : 'Blended'}`,
    `Prioritas: ${data.prioritas}`,
    data.targetOutput ? `Target: ${data.targetOutput}` : '',
    `Tahun: ${data.tahunPelaksanaan}`,
  ].filter(Boolean).join(' | ')

  if (existing) {
    if (data.status === 'NONAKTIF') {
      // Status nonaktif → update pelatihan jadi nonaktif
      await db.pelatihan.update({
        where: { id: existing.id },
        data: { status: 'NONAKTIF', nama: data.namaPelatihan, kategori: data.kategori, deskripsi, jp: data.durasiJP || 8, durasiHari },
      })
    } else {
      await db.pelatihan.update({
        where: { id: existing.id },
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
  } else if (data.status === 'AKTIF') {
    // Belum ada Pelatihan terkait & status aktif → buat baru
    const all = await db.pelatihan.findMany({ orderBy: { createdAt: 'desc' }, select: { kode: true }, take: 100 })
    let maxNum = 0
    for (const p of all) {
      const m = p.kode.match(/PL-(\d+)/)
      if (m) maxNum = Math.max(maxNum, Number(m[1]))
    }
    const kode = `PL-${String(maxNum + 1).padStart(3, '0')}`
    await db.pelatihan.create({
      data: {
        kode,
        nama: data.namaPelatihan,
        kategori: data.kategori,
        deskripsi,
        jp: data.durasiJP || 8,
        durasiHari,
        status: pelatihanStatus,
        analisisDiklatId: analisisId,
        createdBy: userId,
      },
    })
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
    const item = await db.analisisDiklatItem.update({
      where: { id },
      data: {
        ...body,
        durasiJP: body.durasiJP !== undefined ? Number(body.durasiJP) : undefined,
        durasiHari: body.durasiHari !== undefined ? Number(body.durasiHari) : undefined,
        tahunPelaksanaan: body.tahunPelaksanaan !== undefined ? Number(body.tahunPelaksanaan) : undefined,
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
    }, session.user.id)
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
    // Cek apakah ada angkatan terkait di pelatihan
    const linkedPelatihan = await db.pelatihan.findUnique({
      where: { analisisDiklatId: id },
      include: { _count: { select: { angkatan: true } } },
    })
    if (linkedPelatihan) {
      if (linkedPelatihan._count.angkatan > 0) {
        // Ada angkatan → jangan hapus pelatihan, cukup unlink
        await db.pelatihan.update({
          where: { id: linkedPelatihan.id },
          data: { analisisDiklatId: null, deskripsi: (linkedPelatihan.deskripsi || '') + ' [Dihapus dari Analisis]' },
        })
      } else {
        // Tidak ada angkatan → hapus pelatihan juga
        await db.pelatihan.delete({ where: { id: linkedPelatihan.id } })
      }
    }
    await db.analisisDiklatItem.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'ANALISIS_DIKLAT', 'Hapus item analisis diklat', req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('analisis-diklat delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus data' }, { status: 500 })
  }
}
