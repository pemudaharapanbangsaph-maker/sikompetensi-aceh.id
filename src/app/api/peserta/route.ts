import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, status, jenisKelamin, ...rest } = params
    const filters: Record<string, string | number | undefined> = { status, jenisKelamin }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere(search as string, ['nama', 'nip', 'unitKerja', 'instansi'], filters)
    const [data, total] = await Promise.all([
      db.peserta.findMany({
        where,
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: sortBy ? { [sortBy as string]: (sortOrder as 'asc' | 'desc') || 'asc' } : { createdAt: 'desc' },
      }),
      db.peserta.count({ where }),
    ])
    return NextResponse.json({
      data, total, page: page as number, pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('peserta list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data peserta' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    const { tanggalLahir, ...rest } = body
    const data: Record<string, unknown> = { ...rest }
    if (tanggalLahir) data.tanggalLahir = new Date(tanggalLahir)
    const item = await db.peserta.create({ data: data as any })
    await auditLog(session, 'CREATE', 'PESERTA', `Tambah peserta: ${body.nama || '-'}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('peserta create error:', e)
    return NextResponse.json({ error: 'Gagal menambah peserta' }, { status: 500 })
  }
}
