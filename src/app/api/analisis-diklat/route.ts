// src/app/api/analisis-diklat/route.ts

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

// --- Helper: generate kode pelatihan otomatis dari counter ---
async function generateKodePelatihan(): Promise<string> {
  const all = await db.pelatihan.findMany({
    select: { kode: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  let maxNum = 0
  for (const p of all) {
    const m = p.kode.match(/PL-(\d+)/)
    if (m) maxNum = Math.max(maxNum, Number(m[1]))
  }
  return `PL-${String(maxNum + 1).padStart(3, '0')}`
}

// --- Helper: sinkronisasi AnalisisDiklat → Pelatihan + Angkatan default ---
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
}, userId?: string): Promise<string | null> {
  // Cek apakah item analisis sudah punya linked pelatihan
  const analisisItem = await db.analisisDiklatItem.findUnique({
    where: { id: analisisId },
    select: { pelatihanId: true },
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

  let pelatihanId = analisisItem?.pelatihanId || null

  if (pelatihanId) {
    // Update Pelatihan yang sudah terlink
    await db.pelatihan.update({
      where: { id: pelatihanId },
      data: {
        nama: data.namaPelatihan,
        kategori: data.kategori,
        deskripsi,
        jp: data.durasiJP || 8,
        durasiHari,
        status: pelatihanStatus,
      },
    })
  } else if (data.status === 'AKTIF') {
    // Buat Pelatihan baru hanya jika status AKTIF
    const kode = await generateKodePelatihan()
    const newPelatihan = await db.pelatihan.create({
      data: {
        kode,
        nama: data.namaPelatihan,
        kategori: data.kategori,
        deskripsi,
        jp: data.durasiJP || 8,
        durasiHari,
        status: pelatihanStatus,
        createdBy: userId,
      },
    })
    // Simpan ID Pelatihan ke AnalisisDiklatItem
    await db.analisisDiklatItem.update({
      where: { id: analisisId },
      data: { pelatihanId: newPelatihan.id },
    })
    pelatihanId = newPelatihan.id

    // Otomatis buat Angkatan default agar muncul di dropdown Peserta Per Kegiatan
    const tahun = data.tahunPelaksanaan || new Date().getFullYear()
    await db.angkatan.create({
      data: {
        pelatihanId: newPelatihan.id,
        namaAngkatan: `Angkatan 1 - ${data.namaPelatihan}`,
        tanggalMulai: new Date(tahun, 0, 1),
        tanggalSelesai: new Date(tahun, 11, 31),
        metode: data.metodePembelajaran || 'TATAP_MUKA',
        kuota: 30,
        status: 'PERENCANAAN',
        createdBy: userId,
      },
    })
  }

  return pelatihanId
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, tahun, prioritas, kategori, ...rest } = params
    const filters: Record<string, string | number | undefined> = { prioritas, kategori }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere<Record<string, unknown>>(
      search as string,
      ['outcome', 'programPrioritasRPJMA', 'sasaranRPJMA', 'skpaSasaran', 'namaPelatihan', 'targetOutput'],
      filters
    )
    if (tahun !== undefined && tahun !== '') {
      where.tahunPelaksanaan = Number(tahun)
    }
    const [data, total] = await Promise.all([
      db.analisisDiklatItem.findMany({
        where,
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: sortBy ? { [sortBy as string]: (sortOrder as 'asc' | 'desc') || 'asc' } : { createdAt: 'desc' },
      }),
      db.analisisDiklatItem.count({ where }),
    ])
    return NextResponse.json({
      data,
      total,
      page: page as number,
      pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('analisis-diklat list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    const durasiJP = body.durasiJP ? Number(body.durasiJP) : 0
    const durasiHari = body.durasiHari ? Number(body.durasiHari) : 0
    const tahunPelaksanaan = body.tahunPelaksanaan ? Number(body.tahunPelaksanaan) : new Date().getFullYear()
    const item = await db.analisisDiklatItem.create({
      data: {
        ...body,
        durasiJP,
        durasiHari,
        tahunPelaksanaan,
        dibuatOleh: session.user.id,
      },
    })
    // Sinkronisasi ke Pelatihan + Angkatan
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
    await auditLog(session, 'CREATE', 'ANALISIS_DIKLAT', 'Tambah item analisis diklat', req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('analisis-diklat create error:', e)
    return NextResponse.json({ error: 'Gagal menambah data' }, { status: 500 })
  }
}
