import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Kolom yang dikenali dari header Excel.
// NIP & Nama wajib; sisanya opsional.
const REQUIRED_COLUMNS = ['NIP', 'Nama']
const OPTIONAL_COLUMNS = ['L/P', 'Tempat Lahir', 'Tanggal Lahir', 'Jabatan', 'Pangkat/Golongan', 'Unit Kerja', 'Instansi', 'No. Telp', 'Email', 'Pendidikan', 'Alamat']

const JK_MAP: Record<string, string> = {
  l: 'L',
  p: 'P',
  'laki-laki': 'L',
  perempuan: 'P',
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function parseTanggalLahir(raw: unknown): Date | null {
  if (raw == null || raw === '') return null
  // Jika angka (serial date Excel), konversi via XLSX
  if (typeof raw === 'number') {
    const d = XLSX.SSF ? XLSX.SSF.parse_date_code(raw) : null
    if (d && d.y) {
      const date = new Date(Date.UTC(d.y, (d.m || 1) - 1, d.d || 1))
      return isNaN(date.getTime()) ? null : date
    }
  }
  const str = String(raw).trim()
  if (!str) return null
  // Format dd/mm/yyyy atau dd-mm-yyyy
  const m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) {
    let [, dd, mm, yy] = m
    const year = yy.length === 2 ? `19${yy}` : yy
    const date = new Date(Number(year), Number(mm) - 1, Number(dd))
    return isNaN(date.getTime()) ? null : date
  }
  // Format yyyy-mm-dd (ISO)
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return isNaN(date.getTime()) ? null : date
  }
  const fallback = new Date(str)
  return isNaN(fallback.getTime()) ? null : fallback
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan. Silakan upload file Excel (.xlsx)' }, { status: 400 })
    }

    const buf = await file.arrayBuffer()
    const workbook = XLSX.read(buf, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'Sheet tidak ditemukan dalam file Excel' }, { status: 400 })
    }
    const sheet = workbook.Sheets[sheetName]
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File Excel kosong — tidak ada baris data' }, { status: 400 })
    }

    // Validasi header wajib
    const sampleKeys = Object.keys(rows[0]).map(normalizeHeader)
    for (const required of REQUIRED_COLUMNS.map((c) => c.toLowerCase())) {
      if (!sampleKeys.includes(required)) {
        return NextResponse.json(
          { error: `Kolom wajib "${required.toUpperCase()}" tidak ditemukan. Unduh template untuk format yang benar.` },
          { status: 400 }
        )
      }
    }

    // Ambil semua NIP yang sudah ada di DB untuk skip duplikat (1 query)
    const allNipInRows = rows
      .map((r) => String(r[normalizeHeader('NIP')] ?? '').trim())
      .filter(Boolean)
    const existing = await db.peserta.findMany({
      where: { nip: { in: allNipInRows } },
      select: { nip: true },
    })
    const existingNips = new Set(existing.map((e) => e.nip))

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const nip = String(row['NIP'] ?? row[normalizeHeader('NIP')] ?? '').trim()
      const nama = String(row['Nama'] ?? row[normalizeHeader('Nama')] ?? '').trim()

      if (!nip || !nama) {
        skipped++
        errors.push(`Baris ${i + 2}: NIP atau Nama kosong, dilewati`)
        continue
      }
      if (existingNips.has(nip)) {
        skipped++
        errors.push(`Baris ${i + 2}: NIP ${nip} sudah terdaftar, dilewati`)
        continue
      }

      const jkRaw = String(row['L/P'] ?? row[normalizeHeader('L/P')] ?? 'L').trim().toLowerCase()
      const jenisKelamin = JK_MAP[jkRaw] || 'L'

      try {
        await db.peserta.create({
          data: {
            nip,
            nama,
            jenisKelamin,
            tempatLahir: String(row['Tempat Lahir'] ?? row[normalizeHeader('Tempat Lahir')] ?? '').trim() || null,
            tanggalLahir: parseTanggalLahir(row['Tanggal Lahir'] ?? row[normalizeHeader('Tanggal Lahir')]),
            jabatan: String(row['Jabatan'] ?? row[normalizeHeader('Jabatan')] ?? '').trim() || null,
            pangkatGolongan: String(row['Pangkat/Golongan'] ?? row[normalizeHeader('Pangkat/Golongan')] ?? '').trim() || null,
            unitKerja: String(row['Unit Kerja'] ?? row[normalizeHeader('Unit Kerja')] ?? '').trim() || null,
            instansi: String(row['Instansi'] ?? row[normalizeHeader('Instansi')] ?? '').trim() || null,
            noTelp: String(row['No. Telp'] ?? row[normalizeHeader('No. Telp')] ?? '').trim() || null,
            email: String(row['Email'] ?? row[normalizeHeader('Email')] ?? '').trim() || null,
            pendidikan: String(row['Pendidikan'] ?? row[normalizeHeader('Pendidikan')] ?? '').trim() || null,
            alamat: String(row['Alamat'] ?? row[normalizeHeader('Alamat')] ?? '').trim() || null,
            status: 'AKTIF',
          },
        })
        created++
        existingNips.add(nip) // cegah duplikat antar-baris di file yang sama
      } catch (e) {
        skipped++
        errors.push(`Baris ${i + 2}: Gagal menyimpan ${nama} (${nip}) — ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    await auditLog(
      session,
      'CREATE',
      'PESERTA',
      `Import Excel peserta: ${created} dibuat, ${skipped} dilewati`,
      req
    )

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: rows.length,
      errors: errors.slice(0, 50),
      message: `${created} peserta berhasil diimport, ${skipped} dilewati (duplikat/invalid)`,
    })
  } catch (error) {
    console.error('[peserta/import] Gagal:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal import data peserta' },
      { status: 500 }
    )
  }
}
