import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

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
    const item = await db.analisisDiklatItem.create({
      data: {
        ...body,
        durasiJP: body.durasiJP ? Number(body.durasiJP) : 0,
        durasiHari: body.durasiHari ? Number(body.durasiHari) : 0,
        tahunPelaksanaan: body.tahunPelaksanaan ? Number(body.tahunPelaksanaan) : new Date().getFullYear(),
        dibuatOleh: session.user.id,
      },
    })
    await auditLog(session, 'CREATE', 'ANALISIS_DIKLAT', 'Tambah item analisis diklat', req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('analisis-diklat create error:', e)
    return NextResponse.json({ error: 'Gagal menambah data' }, { status: 500 })
  }
}
