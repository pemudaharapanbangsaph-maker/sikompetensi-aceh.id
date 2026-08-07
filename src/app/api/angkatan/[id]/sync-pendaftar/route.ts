import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'

/**
 * POST /api/angkatan/[id]/sync-pendaftar
 * Ambil data pendaftar DITERIMA yang pelatihannya cocok, lalu jadikan peserta di angkatan ini.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: angkatanId } = await params

    // 1. Ambil data angkatan + nama pelatihan
    const angkatan = await db.angkatan.findUnique({
      where: { id: angkatanId },
      include: { pelatihan: { select: { id: true, nama: true } } },
    })
    if (!angkatan) return NextResponse.json({ error: 'Angkatan tidak ditemukan' }, { status: 404 })

    const namaPelatihan = angkatan.pelatihan?.nama || ''
    if (!namaPelatihan) {
      return NextResponse.json({ error: 'Angkatan belum terhubung ke pelatihan' }, { status: 400 })
    }

    // 2. Cari pendaftar DITERIMA yang nama pelatihannya cocok
    const pendaftarList = await db.pendaftaranPortal.findMany({
      where: {
        status: 'DITERIMA',
        analisisDiklatItem: {
          namaPelatihan: namaPelatihan,
          status: 'AKTIF',
        },
      },
      include: {
        analisisDiklatItem: { select: { namaPelatihan: true } },
      },
    })

    if (pendaftarList.length === 0) {
      return NextResponse.json({
        added: 0,
        skipped: 0,
        skippedNames: [],
        message: `Tidak ada pendaftar DITERIMA untuk pelatihan "${namaPelatihan}"`,
      })
    }

    // 3. Ambil peserta yang sudah ada di angkatan ini (by NIP)
    const existingInAngkatan = await db.pesertaAngkatan.findMany({
      where: { angkatanId },
      include: { peserta: { select: { nip: true } } },
    })
    const existingNips = new Set(existingInAngkatan.map((pa) => pa.peserta.nip))

    // 4. Ambil semua NIP peserta master yang sudah ada
    const allPeserta = await db.peserta.findMany({ select: { id: true, nip: true } })
    const nipToPesertaId = new Map(allPeserta.map((p) => [p.nip, p.id]))

    let added = 0
    const skippedNames: string[] = []

    for (const pendaftar of pendaftarList) {
      // Skip jika sudah ada di angkatan ini
      if (existingNips.has(pendaftar.nip)) {
        skippedNames.push(pendaftar.nama)
        continue
      }

      // Cari atau buat peserta master
      let pesertaId = nipToPesertaId.get(pendaftar.nip)
      if (!pesertaId) {
        const newPeserta = await db.peserta.create({
          data: {
            nip: pendaftar.nip,
            nama: pendaftar.nama,
            pangkatGolongan: pendaftar.pangkatGolongan || undefined,
            tempatLahir: pendaftar.tempatLahir || undefined,
            tanggalLahir: pendaftar.tanggalLahir || undefined,
            jabatan: pendaftar.jabatan || undefined,
            instansi: pendaftar.instansi || undefined,
            noTelp: pendaftar.nomorHP || undefined,
          },
        })
        pesertaId = newPeserta.id
        nipToPesertaId.set(pendaftar.nip, pesertaId)
      }

      // Tambahkan ke angkatan
      await db.pesertaAngkatan.create({
        data: {
          angkatanId,
          pesertaId,
          status: 'TERDAFTAR',
        },
      })
      existingNips.add(pendaftar.nip)
      added++
    }

    await auditLog(
      session,
      'CREATE',
      'PESERTA_ANGKATAN',
      `Sync pendaftar ke angkatan "${angkatan.namaAngkatan}": ${added} ditambahkan, ${skippedNames.length} dilewati`,
      req
    )

    const message = skippedNames.length > 0
      ? `${added} peserta berhasil ditambahkan, ${skippedNames.length} sudah ada di angkatan`
      : `${added} peserta berhasil ditambahkan ke angkatan`

    return NextResponse.json({ added, skipped: skippedNames.length, skippedNames, message })
  } catch (e) {
    console.error('sync-pendaftar error:', e)
    return NextResponse.json({ error: 'Gagal sinkronisasi data pendaftar' }, { status: 500 })
  }
}
