import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

const ALLOWED_SORT = ['kode', 'skemaSertifikasi', 'tempat', 'status', 'tanggalUji', 'createdAt', 'updatedAt']

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, status, angkatanId, ...rest } = params
    const filters: Record<string, string | number | undefined> = { status, angkatanId }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere(search as string, ['kode', 'skemaSertifikasi', 'tempat'], filters)
    where.deleted = false
    const safeSortBy = (sortBy && ALLOWED_SORT.includes(sortBy as string)) ? sortBy as string : 'createdAt'
    const [data, total] = await Promise.all([
      db.ujiKompetensi.findMany({
        where,
        include: {
          angkatan: { include: { pelatihan: true } },
          asesor: { include: { asesor: true } },
          _count: { select: { nilai: true } },
        },
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: { [safeSortBy]: (sortOrder as 'asc' | 'desc') || 'desc' },
      }),
      db.ujiKompetensi.count({ where }),
    ])
    return NextResponse.json({
      data: data.map((u) => ({
        ...u,
        asesor: u.asesor.map((a) => a.asesor),
      })),
      total,
      page: page as number,
      pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('uji-kompetensi list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data uji kompetensi' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    // Ekstrak hanya field yang diizinkan — cegah mass assignment
    const asesorIds = body.asesorIds
    const data: Record<string, unknown> = {
      kode: body.kode,
      angkatanId: body.angkatanId || null,
      tanggalUji: body.tanggalUji ? new Date(body.tanggalUji) : new Date(),
      tempat: body.tempat,
      skemaSertifikasi: body.skemaSertifikasi,
      jumlahPeserta: body.jumlahPeserta ? Number(body.jumlahPeserta) : 0,
      status: body.status || 'DIJADWALKAN',
      catatan: body.catatan || null,
    }
    if (Array.isArray(asesorIds) && asesorIds.length > 0) {
      data.asesor = {
        create: asesorIds.map((asesorId: string) => ({ asesorId })),
      }
    }
    const item = await db.ujiKompetensi.create({
      data: data as any,
      include: {
        angkatan: { include: { pelatihan: true } },
        asesor: { include: { asesor: true } },
      },
    })
    await auditLog(session, 'CREATE', 'UJI_KOMPETENSI', `Tambah uji kompetensi: ${item.kode}`, req)
    return NextResponse.json({
      ...item,
      asesor: item.asesor.map((a) => a.asesor),
    })
  } catch (e) {
    console.error('uji-kompetensi create error:', e)
    return NextResponse.json({ error: 'Gagal menambah uji kompetensi' }, { status: 500 })
  }
}
