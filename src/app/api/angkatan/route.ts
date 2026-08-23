import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

const ALLOWED_SORT = ['namaAngkatan', 'lokasi', 'status', 'metode', 'createdAt', 'updatedAt']

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, status, metode, pelatihanId, ...rest } = params
    const filters: Record<string, string | number | undefined> = { status, metode, pelatihanId }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere(search as string, ['namaAngkatan', 'lokasi'], filters)
    where.pelatihan = { deleted: false }
    where.deleted = false
    const safeSortBy = (sortBy && ALLOWED_SORT.includes(sortBy as string)) ? sortBy as string : 'createdAt'
    const [data, total] = await Promise.all([
      db.angkatan.findMany({
        where,
        include: {
          pelatihan: true,
          _count: { select: { peserta: true } },
        },
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: { [safeSortBy]: (sortOrder as 'asc' | 'desc') || 'desc' },
      }),
      db.angkatan.count({ where }),
    ])
    return NextResponse.json({
      data, total, page: page as number, pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('angkatan list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data angkatan' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    // Ekstrak hanya field yang diizinkan — cegah mass assignment
    const item = await db.angkatan.create({
      data: {
        pelatihanId: body.pelatihanId,
        namaAngkatan: body.namaAngkatan,
        tanggalMulai: body.tanggalMulai ? new Date(body.tanggalMulai) : new Date(),
        tanggalSelesai: body.tanggalSelesai ? new Date(body.tanggalSelesai) : new Date(),
        lokasi: body.lokasi || null,
        metode: body.metode || 'TATAP_MUKA',
        kuota: body.kuota ? Number(body.kuota) : 30,
        status: body.status || 'PERENCANAAN',
        catatan: body.catatan || null,
      },
    })
    await auditLog(session, 'CREATE', 'ANGKATAN', `Tambah angkatan: ${item.namaAngkatan}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('angkatan create error:', e)
    return NextResponse.json({ error: 'Gagal menambah angkatan' }, { status: 500 })
  }
}
