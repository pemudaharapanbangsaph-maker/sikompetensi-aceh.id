import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, status, tipe, angkatanId, ...rest } = params
    const filters: Record<string, string | number | undefined> = { status }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '') filters[k] = v as string
    }
    const where = buildWhere(search as string, ['nama', 'nip', 'unitKerja'], filters)
    where.deleted = true
    if (tipe === 'PELATIHAN') {
      where.angkatan = { some: angkatanId ? { id: angkatanId as string } : {} }
    } else if (tipe === 'UJI_KOMPETENSI') {
      where.nilai = { some: angkatanId ? { ujiKompetensiId: angkatanId as string } : {} }
    }
    const [rawData, total] = await Promise.all([
      db.peserta.findMany({
        where,
        include: {
          angkatan: {
            include: {
              angkatan: {
                include: { pelatihan: true }
              }
            }
          },
          nilai: {
            include: {
              ujiKompetensi: true
            }
          },
        },
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: sortBy ? { [sortBy as string]: (sortOrder as 'asc' | 'desc') || 'asc' } : { deletedAt: 'desc' },
      }),
      db.peserta.count({ where }),
    ])

    const data = rawData.map(p => {
      const pelatihanLabels = (p.angkatan || [])
        .map(pa => {
          const a = pa.angkatan
          const pel = a?.pelatihan
          return pel ? `${a.namaAngkatan} - ${pel.nama}` : a?.namaAngkatan || ''
        })
        .filter(Boolean)
      const ukSet = new Set<string>()
      ;(p.nilai || []).forEach(n => {
        const uk = n.ujiKompetensi
        if (uk) {
          const label = `${uk.kode} - ${uk.skemaSertifikasi}`
          if (!ukSet.has(label)) ukSet.add(label)
        }
      })
      const ukLabels = Array.from(ukSet)
      const allLabels = [...pelatihanLabels, ...ukLabels]
      return {
        ...p,
        angkatanLabel: allLabels.length > 0 ? allLabels.join('; ') : '-',
      }
    })

    return NextResponse.json({
      data, total, page: page as number, pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('arsip peserta list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data arsip peserta' }, { status: 500 })
  }
}
