// src/app/api/analisis-diklat/route.ts

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

const ALLOWED_SORT = ['outcome', 'namaPelatihan', 'programPrioritasRPJMA', 'sasaranRPJMA', 'prioritas', 'kategori', 'tahunPelaksanaan', 'createdAt', 'updatedAt']

// --- Helper: cek apakah nama mengandung "uji kompetensi" ---
function isUjiKompetensi(nama: string): boolean {
  return /uji\s+kompetensi/i.test(nama)
}

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
// Jika nama mengandung "uji kompetensi", TIDAK disinkronkan ke pelatihan
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
  // Skip sync jika ini Uji Kompetensi — punya menu sendiri
  if (isUjiKompetensi(data.namaPelatihan)) return null

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
    await db.analisisDiklatItem.update({
      where: { id: analisisId },
      data: { pelatihanId: newPelatihan.id },
    })
    pelatihanId = newPelatihan.id

    const tahun = data.tahunPelaksanaan || new Date().getFullYear()
    const startAngkatan = new Date(tahun, 0, 1)
    const endAngkatan = new Date(startAngkatan)
    const hariAngkatan = durasiHari > 0 ? durasiHari : 1
    endAngkatan.setDate(endAngkatan.getDate() + hariAngkatan - 1)
    await db.angkatan.create({
      data: {
        pelatihanId: newPelatihan.id,
        namaAngkatan: `Angkatan 1 - ${data.namaPelatihan}`,
        tanggalMulai: startAngkatan,
        tanggalSelesai: endAngkatan,
        metode: data.metodePembelajaran || 'TATAP_MUKA',
        kuota: 30,
        status: 'PERENCANAAN',
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
    const { page, pageSize, search, sortBy, sortOrder, tahun, prioritas, kategori, tipe, ...rest } = params
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
    // Filter tipe: "uji_kompetensi" = nama mengandung "uji kompetensi", "pelatihan" = selain itu
    if (tipe === 'uji_kompetensi') {
      where.namaPelatihan = { ...((where.namaPelatihan as object) || {}), contains: 'uji kompetensi', mode: 'insensitive' }
    } else if (tipe === 'pelatihan') {
      where.namaPelatihan = { ...((where.namaPelatihan as object) || {}), not: { contains: 'uji kompetensi' }, mode: 'insensitive' }
    }
    const safeSortBy = (sortBy && ALLOWED_SORT.includes(sortBy as string)) ? sortBy as string : 'createdAt'
    const [data, total] = await Promise.all([
      db.analisisDiklatItem.findMany({
        where,
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: { [safeSortBy]: (sortOrder as 'asc' | 'desc') || 'desc' },
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
    // Ekstrak hanya field yang diizinkan — cegah mass assignment
    const durasiJP = body.durasiJP ? Number(body.durasiJP) : 0
    const durasiHari = body.durasiHari ? Number(body.durasiHari) : 0
    const tahunPelaksanaan = body.tahunPelaksanaan ? Number(body.tahunPelaksanaan) : new Date().getFullYear()
    const tanggalPelaksanaan = body.tanggalPelaksanaan ? new Date(body.tanggalPelaksanaan) : null
    const item = await db.analisisDiklatItem.create({
      data: {
        outcome: body.outcome || '',
        programPrioritasRPJMA: body.programPrioritasRPJMA || '',
        sasaranRPJMA: body.sasaranRPJMA || '',
        skpaSasaran: body.skpaSasaran || '',
        namaPelatihan: body.namaPelatihan || '',
        kategori: body.kategori || 'TEKNIS',
        metodePembelajaran: body.metodePembelajaran || 'TATAP_MUKA',
        durasiJP,
        durasiHari,
        targetOutput: body.targetOutput || '',
        prioritas: body.prioritas || 'SEDANG',
        tahunPelaksanaan,
        tanggalPelaksanaan,
        status: body.status || 'AKTIF',
        pelatihanId: body.pelatihanId || null,
        dibuatOleh: session.user.id,
      },
    })
    // Sinkronisasi ke Pelatihan — otomatis skip untuk Uji Kompetensi
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
