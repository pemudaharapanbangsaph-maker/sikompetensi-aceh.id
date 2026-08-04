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

// --- Helper: sinkronisasi AnalisisDiklat → Pelatihan ---
async function syncToPelatihan(analisisId: string, data: {
  namaPelatihan: string
  kategori: string
  metodePembelajaran: string
  durasiJP: number
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
  const durasiHari = Math.max(1, Math.ceil(data.durasiJP / 8))
  const deskripsi = [
    data.outcome ? `Outcome: ${data.outcome}` : '',
    `Metode: ${data.metodePembelajaran === 'TATAP_MUKA' ? 'Tatap Muka' : data.metodePembelajaran === 'DARING' ? 'Daring' : 'Blended'}`,
    `Prioritas: ${data.prioritas}`,
    data.targetOutput ? `Target: ${data.targetOutput}` : '',
    `Tahun: ${data.tahunPelaksanaan}`,
  ].filter(Boolean).join(' | ')

  if (existing) {
    // Update existing linked Pelatihan
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
  } else if (data.status === 'AKTIF') {
    // Create new Pelatihan only if status AKTIF
    const kode = await generateKodePelatihan()
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
    const tahunPelaksanaan = body.tahunPelaksanaan ? Number(body.tahunPelaksanaan) : new Date().getFullYear()
    const item = await db.analisisDiklatItem.create({
      data: {
        ...body,
        durasiJP,
        tahunPelaksanaan,
        dibuatOleh: session.user.id,
      },
    })
    // Sinkronisasi ke Pelatihan
    await syncToPelatihan(item.id, {
      namaPelatihan: item.namaPelatihan,
      kategori: item.kategori,
      metodePembelajaran: item.metodePembelajaran,
      durasiJP: item.durasiJP,
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
