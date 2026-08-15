import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, kategori, status, ...rest } = params
    const filters: Record<string, string | number | undefined> = { kategori, status }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere(search as string, ['nama', 'kode'], filters)
    where.deleted = true
    // Kecualikan data yang namanya mengandung "uji kompetensi" (masuk ke arsip uji kompetensi)
    where.nama = { ...(where.nama as Record<string, unknown> || {}), not: { contains: 'uji kompetensi', mode: 'insensitive' } }
    const [data, total] = await Promise.all([
      db.pelatihan.findMany({
        where,
        include: { _count: { select: { angkatan: true } } },
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: sortBy ? { [sortBy as string]: (sortOrder as 'asc' | 'desc') || 'asc' } : { deletedAt: 'desc' },
      }),
      db.pelatihan.count({ where }),
    ])
    return NextResponse.json({
      data, total, page: page as number, pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('arsip pelatihan list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data arsip pelatihan' }, { status: 500 })
  }
}
