import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

const REQUIRED_COLUMNS = ['NIP', 'Nama', 'L/P']

const JK_MAP: Record<string, string> = {
  'l': 'L',
  'p': 'P',
  'laki-laki': 'L',
  'perempuan': 'P',
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Validasi angkatan ada
    const angkatan = await db.angkatan.findUnique({
      where: { id },
      include: { peserta: true },
    })
    if (!angkatan) {
      return NextResponse.json({ error: 'Angkatan tidak ditemukan' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan. Silakan upload file Excel (.xlsx)' }, { status: 400 })
    }

    // Validasi tipe file
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: 'Format file harus .xlsx atau .xls' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    let wb: XLSX.WorkBook
    try {
      wb = XLSX.read(buf, { type: 'buffer' })
    } catch {
      return NextResponse.json({ error: 'File tidak dapat dibaca. Pastikan file Excel valid' }, { status: 400 })
    }

    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File kosong atau tidak valid' }, { status: 400 })
    }

    // Validasi kolom wajib
    const headers = Object.keys(rows[0])
    for (const col of REQUIRED_COLUMNS) {
      if (!headers.some((h) => h.toLowerCase().trim() === col.toLowerCase())) {
        return NextResponse.json({ error: `Kolom wajib "${col}" tidak ditemukan. Gunakan template yang tersedia.` }, { status: 400 })
      }
    }

    // Helper: cari kolom berdasarkan nama (case-insensitive)
    const findCol = (names: string[]) =>
      headers.find((h) => names.some((n) => h.toLowerCase().trim() === n.toLowerCase()))

    // Kumpulkan NIP yang sudah terdaftar di angkatan ini
    const existingPesertaIds = new Set(angkatan.peserta.map((pa) => pa.pesertaId))
    const existingNips = new Set<string>()
    if (existingPesertaIds.size > 0) {
      const existingPesertaRecords = await db.peserta.findMany({
        where: { id: { in: [...existingPesertaIds] } },
        select: { id: true, nip: true },
      })
      existingPesertaRecords.forEach((p) => existingNips.add(p.nip))
    }

    let created = 0
    let skipped = 0
    let updated = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // Excel row number (1-indexed + header)

      const nip = String(row[findCol(['NIP'])] || '').trim()
      const nama = String(row[findCol(['Nama'])] || '').trim()
      const jkRaw = String(row[findCol(['L/P', 'Jenis Kelamin', 'JK'])] || '').trim().toLowerCase()

      // Validasi baris
      if (!nip) {
        errors.push(`Baris ${rowNum}: NIP kosong, dilewati`)
        skipped++
        continue
      }
      if (!nama) {
        errors.push(`Baris ${rowNum}: Nama kosong, dilewati`)
        skipped++
        continue
      }
      if (!jkRaw || !JK_MAP[jkRaw]) {
        errors.push(`Baris ${rowNum}: Jenis kelamin tidak valid ("${jkRaw}"), gunakan L/P`)
        skipped++
        continue
      }

      const jenisKelamin = JK_MAP[jkRaw]

      // Cek apakah peserta sudah ada berdasarkan NIP
      let peserta = await db.peserta.findUnique({ where: { nip } })

      if (peserta) {
        // Update data peserta jika ada info baru
        const updates: Record<string, string | Date | null> = {}
        if (nama && nama !== peserta.nama) updates.nama = nama
        if (jenisKelamin && jenisKelamin !== peserta.jenisKelamin) updates.jenisKelamin = jenisKelamin

        const tempatLahir = String(row[findCol(['Tempat Lahir'])] || '').trim() || null
        if (tempatLahir && tempatLahir !== peserta.tempatLahir) updates.tempatLahir = tempatLahir

        const tglLahirRaw = row[findCol(['Tanggal Lahir'])]
        if (tglLahirRaw) {
          const tglLahir = parseDate(tglLahirRaw)
          if (tglLahir) updates.tanggalLahir = tglLahir
        }

        const jabatan = String(row[findCol(['Jabatan'])] || '').trim() || null
        if (jabatan && jabatan !== peserta.jabatan) updates.jabatan = jabatan

        const pangkat = String(row[findCol(['Pangkat/Golongan', 'Pangkat Golongan', 'Golongan'])] || '').trim() || null
        if (pangkat && pangkat !== peserta.pangkatGolongan) updates.pangkatGolongan = pangkat

        const unitKerja = String(row[findCol(['Unit Kerja'])] || '').trim() || null
        if (unitKerja && unitKerja !== peserta.unitKerja) updates.unitKerja = unitKerja

        const instansi = String(row[findCol(['Instansi'])] || '').trim() || null
        if (instansi && instansi !== peserta.instansi) updates.instansi = instansi

        const pendidikan = String(row[findCol(['Pendidikan'])] || '').trim() || null
        if (pendidikan && pendidikan !== peserta.pendidikan) updates.pendidikan = pendidikan

        const noTelp = String(row[findCol(['No. Telp', 'No Telp', 'Telepon'])] || '').trim() || null
        if (noTelp && noTelp !== peserta.noTelp) updates.noTelp = noTelp

        const email = String(row[findCol(['Email'])] || '').trim() || null
        if (email && email !== peserta.email) updates.email = email

        if (Object.keys(updates).length > 0) {
          await db.peserta.update({ where: { id: peserta.id }, data: updates })
          updated++
        }
      } else {
        // Buat peserta baru
        const tglLahirRaw = row[findCol(['Tanggal Lahir'])]
        peserta = await db.peserta.create({
          data: {
            nip,
            nama,
            jenisKelamin,
            tempatLahir: String(row[findCol(['Tempat Lahir'])] || '').trim() || null,
            tanggalLahir: tglLahirRaw ? parseDate(tglLahirRaw) : null,
            jabatan: String(row[findCol(['Jabatan'])] || '').trim() || null,
            pangkatGolongan: String(row[findCol(['Pangkat/Golongan', 'Pangkat Golongan', 'Golongan'])] || '').trim() || null,
            unitKerja: String(row[findCol(['Unit Kerja'])] || '').trim() || null,
            instansi: String(row[findCol(['Instansi'])] || '').trim() || null,
            pendidikan: String(row[findCol(['Pendidikan'])] || '').trim() || null,
            noTelp: String(row[findCol(['No. Telp', 'No Telp', 'Telepon'])] || '').trim() || null,
            email: String(row[findCol(['Email'])] || '').trim() || null,
          },
        })
      }

      // Cek apakah peserta sudah terdaftar di angkatan ini
      if (existingNips.has(peserta.nip)) {
        skipped++
        continue
      }

      // Cek apakah sudah ada relasi (double check)
      const existingLink = await db.pesertaAngkatan.findUnique({
        where: { angkatanId_pesertaId: { angkatanId: id, pesertaId: peserta.id } },
      })
      if (existingLink) {
        existingNips.add(peserta.nip)
        skipped++
        continue
      }

      // Tambahkan ke angkatan
      await db.pesertaAngkatan.create({
        data: {
          angkatanId: id,
          pesertaId: peserta.id,
          status: 'TERDAFTAR',
        },
      })
      existingNips.add(peserta.nip)
      created++
    }

    await auditLog(
      session,
      'IMPORT',
      'PESERTA_KEGIATAN',
      `Import peserta ke angkatan "${angkatan.namaAngkatan}": ${created} baru, ${updated} diperbarui, ${skipped} dilewati`,
      req
    )

    return NextResponse.json({
      success: true,
      created,
      updated,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      message: `Berhasil: ${created} peserta ditambahkan, ${updated} data diperbarui, ${skipped} dilewati`,
    })
  } catch (e) {
    console.error('peserta import error:', e)
    return NextResponse.json({ error: 'Gagal mengimpor data peserta' }, { status: 500 })
  }
}

// Helper: parse various date formats
function parseDate(val: unknown): Date | null {
  if (!val) return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) {
      return new Date(d.y, d.m - 1, d.d)
    }
    return null
  }
  const str = String(val).trim()
  if (!str) return null
  // Format: DD/MM/YYYY atau DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    return isNaN(d.getTime()) ? null : d
  }
  // Format: YYYY-MM-DD
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}
