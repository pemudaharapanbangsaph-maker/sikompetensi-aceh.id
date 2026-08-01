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
    const { page, pageSize, search, sortBy, sortOrder, tahun, status, prioritas, jenisKompetensi, ...rest } = params
    const filters: Record<string, string | number | undefined> = { status, prioritas, jenisKompetensi }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere(search as string, ['judul', 'unitKerja'], filters)
    if (tahun !== undefined && tahun !== '') {
      (where as Record<string, unknown>).tahun = Number(tahun)
    }
    const [data, total] = await Promise.all([
      db.analisisKebutuhan.findMany({
        where,
        include: { pelatihan: true, user: true },
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: sortBy ? { [sortBy as string]: (sortOrder as 'asc' | 'desc') || 'asc' } : { createdAt: 'desc' },
      }),
      db.analisisKebutuhan.count({ where }),
    ])
    return NextResponse.json({
      data, total, page: page as number, pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('analisis list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data analisis' }, { status: 500 })
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
    const item = await db.analisisKebutuhan.create({
      data: {
        ...body,
        tahun: body.tahun ? Number(body.tahun) : new Date().getFullYear(),
        jumlahPegawai: body.jumlahPegawai ? Number(body.jumlahPegawai) : 0,
        dibuatOleh: session.user.id,
      },
      include: { pelatihan: true },
    })
    await auditLog(session, 'CREATE', 'ANALISIS', `Tambah analisis kebutuhan: ${item.judul}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('analisis create error:', e)
    return NextResponse.json({ error: 'Gagal menambah analisis' }, { status: 500 })
  }
}
