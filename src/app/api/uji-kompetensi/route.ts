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
    const { page, pageSize, search, sortBy, sortOrder, status, angkatanId, ...rest } = params
    const filters: Record<string, string | number | undefined> = { status, angkatanId }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere(search as string, ['kode', 'skemaSertifikasi', 'tempat'], filters)
    const [data, total] = await Promise.all([
      db.ujiKompetensi.findMany({
        where,
        include: {
          angkatan: { include: { pelatihan: true } },
          asesor: { include: { asesor: true } },
          _count: { select: { nilai: true } },
        },
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: sortBy ? { [sortBy as string]: (sortOrder as 'asc' | 'desc') || 'asc' } : { createdAt: 'desc' },
      }),
      db.ujiKompetensi.count({ where }),
    ])
    return NextResponse.json({
      data: data.map((u) => ({
        ...u,
        asesor: u.asesor.map((a) => a.asesor),
      })),
      total,
      page: page as number,
      pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('uji-kompetensi list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data uji kompetensi' }, { status: 500 })
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
    const { tanggalUji, asesorIds, ...rest } = body
    const data: Record<string, unknown> = { ...rest }
    if (tanggalUji) data.tanggalUji = new Date(tanggalUji)
    if (body.jumlahPeserta !== undefined) data.jumlahPeserta = Number(body.jumlahPeserta)
    if (Array.isArray(asesorIds) && asesorIds.length > 0) {
      data.asesor = {
        create: asesorIds.map((asesorId: string) => ({ asesorId })),
      }
    }
    const item = await db.ujiKompetensi.create({
      data: data as any,
      include: {
        angkatan: { include: { pelatihan: true } },
        asesor: { include: { asesor: true } },
      },
    })
    await auditLog(session, 'CREATE', 'UJI_KOMPETENSI', `Tambah uji kompetensi: ${item.kode}`, req)
    return NextResponse.json({
      ...item,
      asesor: item.asesor.map((a) => a.asesor),
    })
  } catch (e) {
    console.error('uji-kompetensi create error:', e)
    return NextResponse.json({ error: 'Gagal menambah uji kompetensi' }, { status: 500 })
  }
}
