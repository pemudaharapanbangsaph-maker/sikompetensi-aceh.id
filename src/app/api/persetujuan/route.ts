import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

const ALLOWED_SORT = ['judul', 'jenis', 'status', 'pemohonNama', 'createdAt']
const VALID_JENIS = ['PELATIHAN', 'UJI_KOMPETENSI', 'ANGKATAN', 'SURAT_TUGAS']

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, status, jenis, ...rest } = params
    const filters: Record<string, string | number | undefined> = {}
    if (status) filters.status = status as string
    if (jenis) filters.jenis = jenis as string
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '' && !['page', 'pageSize', 'search', 'sortBy', 'sortOrder'].includes(k)) {
        filters[k] = v as string
      }
    }

    const where = buildWhere(search as string, ['judul', 'deskripsi', 'pemohonNama'], filters)
    const safeSortBy = (sortBy && ALLOWED_SORT.includes(sortBy as string)) ? sortBy as string : 'createdAt'

    const [data, total] = await Promise.all([
      db.persetujuan.findMany({
        where,
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: { [safeSortBy]: (sortOrder as 'asc' | 'desc') || 'desc' },
      }),
      db.persetujuan.count({ where }),
    ])

    return NextResponse.json({
      data,
      total,
      page: page as number,
      pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('persetujuan list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data persetujuan' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { jenis, referensiId, judul, deskripsi, pemohonId, pemohonNama } = body

    if (!jenis || !VALID_JENIS.includes(jenis)) {
      return NextResponse.json({ error: `Jenis harus salah satu dari: ${VALID_JENIS.join(', ')}` }, { status: 400 })
    }
    if (!referensiId) return NextResponse.json({ error: 'Referensi ID wajib diisi' }, { status: 400 })
    if (!judul) return NextResponse.json({ error: 'Judul wajib diisi' }, { status: 400 })

    const item = await db.persetujuan.create({
      data: {
        jenis,
        referensiId,
        judul,
        deskripsi: deskripsi || null,
        pemohonId: pemohonId || session.user.id,
        pemohonNama: pemohonNama || session.user.nama,
        status: 'MENUNGGU',
      },
    })

    await auditLog(session, 'CREATE', 'PERSETUJUAN', `Ajukan persetujuan ${jenis}: ${judul}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('persetujuan create error:', e)
    return NextResponse.json({ error: 'Gagal membuat permohonan persetujuan' }, { status: 500 })
  }
}
