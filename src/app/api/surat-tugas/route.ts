import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'
import * as fs from 'fs/promises'
import * as path from 'path'
import crypto from 'crypto'

const ALLOWED_SORT = ['nomor', 'perihal', 'penerima', 'tanggalSurat', 'status', 'createdAt']
const ALLOWED_EXT = ['.pdf', '.doc', '.docx']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

async function ensureUploadDir() {
  await fs.mkdir(path.join(process.cwd(), 'uploads', 'surat-tugas'), { recursive: true })
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, status, ...rest } = params
    const filters: Record<string, string | number | undefined> = {}
    if (status) filters.status = status as string
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '' && !['page', 'pageSize', 'search', 'sortBy', 'sortOrder'].includes(k)) {
        filters[k] = v as string
      }
    }

    const where = buildWhere(search as string, ['nomor', 'perihal', 'penerima'], filters)
    const safeSortBy = (sortBy && ALLOWED_SORT.includes(sortBy as string)) ? sortBy as string : 'createdAt'

    const [data, total] = await Promise.all([
      db.suratTugas.findMany({
        where,
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: { [safeSortBy]: (sortOrder as 'asc' | 'desc') || 'desc' },
        include: {
          peserta: { select: { id: true, nama: true, nip: true, jabatan: true, unitKerja: true } },
          pelatihan: { select: { id: true, nama: true, kode: true } },
          angkatan: { select: { id: true, namaAngkatan: true } },
        },
      }),
      db.suratTugas.count({ where }),
    ])

    return NextResponse.json({
      data,
      total,
      page: page as number,
      pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('surat-tugas list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data surat tugas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureUploadDir()
    const fd = await req.formData()
    const file = fd.get('file') as File | null

    // Ambil metadata dari FormData
    const nomor = (fd.get('nomor') as string) || ''
    const perihal = (fd.get('perihal') as string) || ''
    const tanggalSurat = (fd.get('tanggalSurat') as string) || ''
    const tanggalMulai = fd.get('tanggalMulai') as string | null
    const tanggalSelesai = fd.get('tanggalSelesai') as string | null
    const penerima = (fd.get('penerima') as string) || ''
    const pesertaId = fd.get('pesertaId') as string | null
    const pelatihanId = fd.get('pelatihanId') as string | null
    const angkatanId = fd.get('angkatanId') as string | null
    const statusSurat = (fd.get('status') as string) || 'DRAFT'
    const catatan = fd.get('catatan') as string | null

    if (!nomor) return NextResponse.json({ error: 'Nomor surat wajib diisi' }, { status: 400 })
    if (!perihal) return NextResponse.json({ error: 'Perihal wajib diisi' }, { status: 400 })
    if (!tanggalSurat) return NextResponse.json({ error: 'Tanggal surat wajib diisi' }, { status: 400 })
    if (!penerima) return NextResponse.json({ error: 'Penerima wajib diisi' }, { status: 400 })

    if (!['DRAFT', 'TERBIT'].includes(statusSurat)) {
      return NextResponse.json({ error: 'Status harus DRAFT atau TERBIT' }, { status: 400 })
    }

    let storedPath: string | null = null
    let ukuranFile: string | null = null

    // Upload file opsional
    if (file) {
      const ext = path.extname(file.name).toLowerCase()
      if (!ALLOWED_EXT.includes(ext)) {
        return NextResponse.json({ error: `Format file harus: ${ALLOWED_EXT.join(', ')}` }, { status: 400 })
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 400 })
      }

      const uniqueName = `${crypto.randomUUID()}${ext}`
      const filePath = path.join(process.cwd(), 'uploads', 'surat-tugas', uniqueName)
      const bytes = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(filePath, bytes)

      storedPath = `uploads/surat-tugas/${uniqueName}`
      ukuranFile = `${(file.size / 1024).toFixed(1)} KB`
    }

    const item = await db.suratTugas.create({
      data: {
        nomor,
        perihal,
        tanggalSurat: new Date(tanggalSurat),
        tanggalMulai: tanggalMulai ? new Date(tanggalMulai) : null,
        tanggalSelesai: tanggalSelesai ? new Date(tanggalSelesai) : null,
        penerima,
        pesertaId: pesertaId || null,
        pelatihanId: pelatihanId || null,
        angkatanId: angkatanId || null,
        file: storedPath,
        ukuranFile,
        status: statusSurat,
        catatan,
      },
      include: {
        peserta: { select: { id: true, nama: true, nip: true, jabatan: true, unitKerja: true } },
        pelatihan: { select: { id: true, nama: true, kode: true } },
        angkatan: { select: { id: true, namaAngkatan: true } },
      },
    })

    await auditLog(session, 'CREATE', 'SURAT_TUGAS', `Tambah surat tugas: ${item.nomor} - ${item.perihal}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('surat-tugas create error:', e)
    return NextResponse.json({ error: 'Gagal menambah surat tugas' }, { status: 500 })
  }
}
