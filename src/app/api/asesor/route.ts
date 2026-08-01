import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, status, ...rest } = params
    const filters: Record<string, string | number | undefined> = { status }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere(search as string, ['nama', 'nip', 'bidangKeahlian'], filters)
    const [data, total] = await Promise.all([
      db.asesor.findMany({
        where,
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: sortBy ? { [sortBy as string]: (sortOrder as 'asc' | 'desc') || 'asc' } : { createdAt: 'desc' },
      }),
      db.asesor.count({ where }),
    ])
    return NextResponse.json({
      data, total, page: page as number, pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('asesor list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data asesor' }, { status: 500 })
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
    const { tanggalSertifikat, ...rest } = body
    const data: Record<string, unknown> = { ...rest }
    if (tanggalSertifikat) data.tanggalSertifikat = new Date(tanggalSertifikat)
    const item = await db.asesor.create({ data: data as any })
    await auditLog(session, 'CREATE', 'ASESOR', `Tambah asesor: ${item.nama}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('asesor create error:', e)
    return NextResponse.json({ error: 'Gagal menambah asesor' }, { status: 500 })
  }
}
