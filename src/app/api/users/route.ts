import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hashPassword, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'users:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, role, status, ...rest } = params
    const filters: Record<string, string | number | undefined> = { role, status }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere(search as string, ['nama', 'username', 'email'], filters)
    const [data, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, username: true, nama: true, email: true, role: true,
          status: true, noTelp: true, lastLogin: true, createdAt: true,
        },
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: sortBy ? { [sortBy as string]: (sortOrder as 'asc' | 'desc') || 'asc' } : { createdAt: 'desc' },
      }),
      db.user.count({ where }),
    ])
    return NextResponse.json({
      data, total, page: page as number, pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('users list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data user' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'users:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    if (!body.username || !body.email || !body.password) {
      return NextResponse.json({ error: 'Username, email, dan password wajib diisi' }, { status: 400 })
    }
    const existing = await db.user.findFirst({
      where: { OR: [{ username: body.username }, { email: body.email }] },
    })
    if (existing) {
      return NextResponse.json({ error: 'Username atau email sudah digunakan' }, { status: 400 })
    }
    const hashed = await hashPassword(body.password)
    const user = await db.user.create({
      data: {
        username: body.username,
        nama: body.nama || body.username,
        email: body.email,
        password: hashed,
        role: body.role || 'OPERATOR',
        status: body.status || 'AKTIF',
        noTelp: body.noTelp || null,
      },
      select: {
        id: true, username: true, nama: true, email: true, role: true,
        status: true, noTelp: true, lastLogin: true, createdAt: true,
      },
    })
    await auditLog(session, 'CREATE', 'USER', `Tambah user: ${user.username} (${user.role})`, req)
    return NextResponse.json(user)
  } catch (e) {
    console.error('users create error:', e)
    return NextResponse.json({ error: 'Gagal menambah user' }, { status: 500 })
  }
}
