import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'
import * as fs from 'fs/promises'
import * as path from 'path'
import crypto from 'crypto'

const ALLOWED_SORT = ['namaPeserta', 'nomorSertifikat', 'jenis', 'tanggalTerbit', 'createdAt']
const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

async function ensureUploadDir() {
  await fs.mkdir(path.join(process.cwd(), 'uploads', 'sertifikat'), { recursive: true })
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, jenis, ...rest } = params
    const filters: Record<string, string | number | undefined> = {}
    if (jenis) filters.jenis = jenis as string
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '' && k !== 'page' && k !== 'pageSize' && k !== 'search' && k !== 'sortBy' && k !== 'sortOrder') {
        filters[k] = v as string
      }
    }

    const where = buildWhere(search as string, ['namaPeserta', 'nomorSertifikat', 'namaKegiatan'], filters)
    const safeSortBy = (sortBy && ALLOWED_SORT.includes(sortBy as string)) ? sortBy as string : 'createdAt'

    const [data, total] = await Promise.all([
      db.sertifikat.findMany({
        where,
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: { [safeSortBy]: (sortOrder as 'asc' | 'desc') || 'desc' },
        include: {
          angkatan: { select: { id: true, namaAngkatan: true, pelatihanId: true, pelatihan: { select: { id: true, nama: true, kode: true } } } },
          peserta: { select: { id: true, nama: true, nip: true } },
          ujiKompetensi: { select: { id: true, kode: true, skemaSertifikasi: true } },
        },
      }),
      db.sertifikat.count({ where }),
    ])

    return NextResponse.json({
      data,
      total,
      page: page as number,
      pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('sertifikat list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data sertifikat' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureUploadDir()
    const fd = await req.formData()
    const file = fd.get('file') as File | null

    const jenis = (fd.get('jenis') as string) || 'PELATIHAN'
    const angkatanId = fd.get('angkatanId') as string | null
    const ujiKompetensiId = fd.get('ujiKompetensiId') as string | null
    const pesertaId = fd.get('pesertaId') as string | null
    const nomorSertifikat = fd.get('nomorSertifikat') as string | null
    const namaPeserta = fd.get('namaPeserta') as string | null
    const namaKegiatan = fd.get('namaKegiatan') as string | null
    const tanggalTerbit = fd.get('tanggalTerbit') as string | null
    const catatan = fd.get('catatan') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File sertifikat wajib diupload' }, { status: 400 })
    }

    if (!['PELATIHAN', 'UJI_KOMPETENSI'].includes(jenis)) {
      return NextResponse.json({ error: 'Jenis harus PELATIHAN atau UJI_KOMPETENSI' }, { status: 400 })
    }

    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: `Format file harus: ${ALLOWED_EXT.join(', ')}` }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 })
    }

    const uniqueName = `${crypto.randomUUID()}${ext}`
    const filePath = path.join(process.cwd(), 'uploads', 'sertifikat', uniqueName)
    const bytes = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, bytes)

    const ukuranKB = (file.size / 1024).toFixed(1)
    const storedPath = `uploads/sertifikat/${uniqueName}`

    const item = await db.sertifikat.create({
      data: {
        jenis,
        angkatanId: angkatanId || null,
        ujiKompetensiId: ujiKompetensiId || null,
        pesertaId: pesertaId || null,
        nomorSertifikat,
        namaPeserta,
        namaKegiatan,
        file: storedPath,
        ukuranFile: `${ukuranKB} KB`,
        tanggalTerbit: tanggalTerbit ? new Date(tanggalTerbit) : null,
        catatan,
      },
      include: {
        angkatan: { select: { id: true, namaAngkatan: true, pelatihanId: true, pelatihan: { select: { id: true, nama: true, kode: true } } } },
        peserta: { select: { id: true, nama: true, nip: true } },
        ujiKompetensi: { select: { id: true, kode: true, skemaSertifikasi: true } },
      },
    })

    await auditLog(session, 'CREATE', 'SERTIFIKAT', `Tambah sertifikat: ${item.nomorSertifikat || item.namaPeserta || item.id}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('sertifikat create error:', e)
    return NextResponse.json({ error: 'Gagal menambah sertifikat' }, { status: 500 })
  }
}
