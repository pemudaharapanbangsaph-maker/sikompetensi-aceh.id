import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

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
    const [data, total] = await Promise.all([
      db.angkatan.findMany({
        where,
        include: {
          pelatihan: true,
          _count: { select: { peserta: true } },
        },
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: sortBy ? { [sortBy as string]: (sortOrder as 'asc' | 'desc') || 'asc' } : { createdAt: 'desc' },
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
    const { tanggalMulai, tanggalSelesai, ...rest } = body
    const item = await db.angkatan.create({
      data: {
        ...rest,
        tanggalMulai: tanggalMulai ? new Date(tanggalMulai) : new Date(),
        tanggalSelesai: tanggalSelesai ? new Date(tanggalSelesai) : new Date(),
        kuota: body.kuota ? Number(body.kuota) : undefined,
        createdBy: session.user.id,
      },
    })
    await auditLog(session, 'CREATE', 'ANGKATAN', `Tambah angkatan: ${item.namaAngkatan}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('angkatan create error:', e)
    return NextResponse.json({ error: 'Gagal menambah angkatan' }, { status: 500 })
  }
}
