import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'monitoring:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, jenisEvaluasi, angkatanId, ...rest } = params
    const filters: Record<string, string | number | undefined> = { jenisEvaluasi, angkatanId }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere(search as string, ['aspek', 'catatan'], filters)
    const [data, total] = await Promise.all([
      db.evaluasi.findMany({
        where,
        include: {
          angkatan: { include: { pelatihan: true } },
          peserta: true,
        },
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: sortBy ? { [sortBy as string]: (sortOrder as 'asc' | 'desc') || 'asc' } : { createdAt: 'desc' },
      }),
      db.evaluasi.count({ where }),
    ])
    return NextResponse.json({
      data, total, page: page as number, pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('evaluasi list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data evaluasi' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'monitoring:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    const item = await db.evaluasi.create({
      data: {
        ...body,
        nilai: body.nilai ? Number(body.nilai) : 0,
        diinputOleh: session.user.id,
      },
      include: {
        angkatan: { include: { pelatihan: true } },
        peserta: true,
      },
    })
    await auditLog(session, 'CREATE', 'EVALUASI', `Tambah evaluasi ${body.jenisEvaluasi || ''}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('evaluasi create error:', e)
    return NextResponse.json({ error: 'Gagal menambah evaluasi' }, { status: 500 })
  }
}
