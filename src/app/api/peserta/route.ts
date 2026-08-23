import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

const ALLOWED_SORT = ['nama', 'nip', 'unitKerja', 'instansi', 'jenisKelamin', 'status', 'createdAt', 'updatedAt']

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
    where.deleted = false
    const safeSortBy = (sortBy && ALLOWED_SORT.includes(sortBy as string)) ? sortBy as string : 'createdAt'
    const [data, total] = await Promise.all([
      db.peserta.findMany({
        where,
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: { [safeSortBy]: (sortOrder as 'asc' | 'desc') || 'desc' },
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
    // Ekstrak hanya field yang diizinkan — cegah mass assignment
    const item = await db.peserta.create({
      data: {
        nip: body.nip,
        nama: body.nama,
        jenisKelamin: body.jenisKelamin || 'L',
        tempatLahir: body.tempatLahir || null,
        tanggalLahir: body.tanggalLahir ? new Date(body.tanggalLahir) : null,
        jabatan: body.jabatan || null,
        pangkatGolongan: body.pangkatGolongan || null,
        unitKerja: body.unitKerja || null,
        instansi: body.instansi || null,
        pendidikan: body.pendidikan || null,
        noTelp: body.noTelp || null,
        email: body.email || null,
        alamat: body.alamat || null,
        fotoUrl: body.fotoUrl || null,
        status: body.status || 'AKTIF',
      },
    })
    await auditLog(session, 'CREATE', 'PESERTA', `Tambah peserta: ${body.nama || '-'}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('peserta create error:', e)
    return NextResponse.json({ error: 'Gagal menambah peserta' }, { status: 500 })
  }
}
