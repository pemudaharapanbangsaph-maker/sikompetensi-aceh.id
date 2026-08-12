import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import { Prisma } from '@prisma/client'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page') || 1)
    const pageSize = Number(searchParams.get('pageSize') || 10)
    const search = searchParams.get('search') || ''
    const ujiId = searchParams.get('ujiId') || ''
    const pelatihan = searchParams.get('pelatihan') || ''
    const isExport = searchParams.get('export') === '1'

    // Build where clause for PendaftaranPortal
    const where: Record<string, unknown> = { status: 'DITERIMA' }

    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { nip: { contains: search } },
      ]
    }

    if (pelatihan) {
      where.analisisDiklatItem = { namaPelatihan: { contains: pelatihan } }
    }

    const take = isExport ? undefined : pageSize
    const skip = isExport ? undefined : (page - 1) * pageSize

    const [pendaftarans, total] = await Promise.all([
      db.pendaftaranPortal.findMany({
        where,
        include: {
          analisisDiklatItem: { select: { id: true, namaPelatihan: true, kategori: true } },
          pelatihan: { select: { id: true, nama: true, kategori: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      db.pendaftaranPortal.count({ where }),
    ])

    // Collect all NIPs to batch-lookup Peserta
    const nips = pendaftarans.map((p) => p.nip)
    const pesertaMap = new Map<string, any>()
    if (nips.length > 0) {
      const pesertas = await db.peserta.findMany({
        where: { nip: { in: nips } },
        include: {
          angkatan: {
            include: {
              angkatan: {
                include: {
                  pelatihan: { select: { nama: true, kategori: true } },
                  ujiKompetensi: { select: { id: true, kode: true, tanggalUji: true, skemaSertifikasi: true, status: true } },
                },
              },
            },
          },
          nilai: {
            include: {
              ujiKompetensi: { select: { id: true, kode: true, tanggalUji: true, skemaSertifikasi: true, status: true } },
            },
          },
        },
      })
      for (const p of pesertas) {
        pesertaMap.set(p.nip, p)
      }
    }

    // Build response rows
    const data = pendaftarans.map((d) => {
      const peserta = pesertaMap.get(d.nip)

      // Find angkatan info
      let angkatanInfo: any = null
      if (peserta?.angkatan?.length) {
        const pa = peserta.angkatan[0]
        angkatanInfo = {
          angkatanId: pa.angkatanId,
          namaAngkatan: pa.angkatan.namaAngkatan,
          pelatihan: pa.angkatan.pelatihan?.nama || '',
          status: pa.angkatan.status,
          tanggalMulai: pa.angkatan.tanggalMulai?.toISOString() || '',
          tanggalSelesai: pa.angkatan.tanggalSelesai?.toISOString() || '',
        }
      }

      // Find uji kompetensi info - either from angkatan.ujiKompetensi or from nilai
      let jadwalUji: any = null
      if (peserta) {
        // Check from angkatan's ujiKompetensi
        if (angkatanInfo && peserta.angkatan[0]?.angkatan?.ujiKompetensi?.length) {
          const uk = peserta.angkatan[0].angkatan.ujiKompetensi[0]
          jadwalUji = {
            id: uk.id,
            kode: uk.kode,
            tanggalUji: uk.tanggalUji?.toISOString() || '',
            skemaSertifikasi: uk.skemaSertifikasi,
            status: uk.status,
          }
        }
        // Also check from nilai records
        if (!jadwalUji && peserta.nilai?.length) {
          const nilaiFirst = peserta.nilai[0]
          jadwalUji = {
            id: nilaiFirst.ujiKompetensi.id,
            kode: nilaiFirst.ujiKompetensi.kode,
            tanggalUji: nilaiFirst.ujiKompetensi.tanggalUji?.toISOString() || '',
            skemaSertifikasi: nilaiFirst.ujiKompetensi.skemaSertifikasi,
            status: nilaiFirst.ujiKompetensi.status,
          }
        }
      }

      // Find nilai / kelulusan
      let nilaiInfo: any = null
      if (peserta?.nilai?.length) {
        // Find nilai that matches the jadwalUji if we have one
        const matchedNilai = jadwalUji
          ? peserta.nilai.find((n) => n.ujiKompetensiId === jadwalUji.id)
          : peserta.nilai[0]
        if (matchedNilai) {
          nilaiInfo = {
            id: matchedNilai.id,
            nilaiPreTest: matchedNilai.nilaiPreTest,
            nilaiPostTest: matchedNilai.nilaiPostTest,
            nilaiPraktik: matchedNilai.nilaiPraktik,
            nilaiTeori: matchedNilai.nilaiTeori,
            nilaiAkhir: matchedNilai.nilaiAkhir,
            statusKelulusan: matchedNilai.statusKelulusan,
          }
        }
      }

      return {
        id: d.id,
        nama: d.nama,
        nip: d.nip,
        jenisKelamin: peserta?.jenisKelamin || '',
        pangkatGolongan: d.pangkatGolongan || peserta?.pangkatGolongan || '',
        tempatLahir: d.tempatLahir || '',
        tanggalLahir: d.tanggalLahir ? d.tanggalLahir.toISOString() : '',
        jabatan: d.jabatan || '',
        unitKerja: d.unitKerja || '',
        instansi: d.instansi || '',
        nomorHP: d.nomorHP || '',
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        // linked analisis diklat
        namaPelatihan: d.analisisDiklatItem?.namaPelatihan || d.pelatihan?.nama || '',
        kategori: d.analisisDiklatItem?.kategori || d.pelatihan?.kategori || '',
        // sync info
        pesertaId: peserta?.id || null,
        angkatanInfo,
        jadwalUji,
        nilaiInfo,
      }
    })

    // Filter by ujiId if provided (client-side filter since we need the join)
    let filtered = data
    if (ujiId) {
      filtered = data.filter((r) => r.jadwalUji?.id === ujiId)
    }

    // Recalculate total if ujiId filter is active
    const filteredTotal = ujiId ? filtered.length : total
    const paginatedData = ujiId
      ? filtered.slice((page - 1) * pageSize, page * pageSize)
      : filtered

    return NextResponse.json({
      data: paginatedData,
      total: isExport ? paginatedData.length : filteredTotal,
      page,
      pageSize: isExport ? paginatedData.length : pageSize,
      totalPages: isExport ? 1 : Math.ceil(filteredTotal / pageSize),
    })
  } catch (e) {
    console.error('biodata-peserta list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data biodata peserta' }, { status: 500 })
  }
}
