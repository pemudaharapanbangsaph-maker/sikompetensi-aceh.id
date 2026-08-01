import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // Any authenticated user can view (audit log is admin function but keep simple per spec)
    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, aksi, modul, ...rest } = params
    const filters: Record<string, string | number | undefined> = { aksi, modul }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere(search as string, ['username', 'deskripsi'], filters)
    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: sortBy ? { [sortBy as string]: (sortOrder as 'asc' | 'desc') || 'asc' } : { createdAt: 'desc' },
      }),
      db.auditLog.count({ where }),
    ])
    return NextResponse.json({
      data, total, page: page as number, pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('audit-log list error:', e)
    return NextResponse.json({ error: 'Gagal memuat audit log' }, { status: 500 })
  }
}
