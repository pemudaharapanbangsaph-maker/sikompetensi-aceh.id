import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

const METODE_MAP: Record<string, string> = {
  'tatap muka': 'TATAP_MUKA',
  'daring': 'DARING',
  'blended': 'BLENDED',
}

const PRIORITAS_MAP: Record<string, string> = {
  'tinggi': 'TINGGI',
  'sedang': 'SEDANG',
  'rendah': 'RENDAH',
}

const KATEGORI_MAP: Record<string, string> = {
  'teknis': 'TEKNIS',
  'manajerial': 'MANAJERIAL',
  'fungsional': 'FUNGSIONAL',
  'sosial kultural': 'SOSIAL_KULTURAL',
}

const STATUS_MAP: Record<string, string> = {
  'aktif': 'AKTIF',
  'tampilkan di portal': 'AKTIF',
  'nonaktif': 'NONAKTIF',
  'sembunyikan': 'NONAKTIF',
}

const REQUIRED_COLUMNS = ['Outcome', 'Nama Pelatihan']

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File kosong atau tidak valid' }, { status: 400 })
    }

    const headers = Object.keys(rows[0])
    for (const col of REQUIRED_COLUMNS) {
      if (!headers.some((h) => h.toLowerCase().trim() === col.toLowerCase())) {
        return NextResponse.json({ error: `Kolom wajib "${col}" tidak ditemukan` }, { status: 400 })
      }
    }

    const findCol = (names: string[]) => headers.find((h) => names.some((n) => h.toLowerCase().trim() === n.toLowerCase()))

    const items = rows.map((row) => {
      const metodeRaw = String(row[findCol(['Metode Pembelajaran'])] || 'Tatap Muka')
      const prioritasRaw = String(row[findCol(['Prioritas'])] || 'Sedang')
      const tahunRaw = row[findCol(['Tahun Pelaksanaan'])]
      const kategoriRaw = String(row[findCol(['Kategori'])] || 'Teknis')
      const statusRaw = String(row[findCol(['Status Publikasi'])] || 'Aktif')

      return {
        outcome: String(row[findCol(['Outcome'])] || ''),
        programPrioritasRPJMA: String(row[findCol(['Program Prioritas RPJMA'])] || ''),
        sasaranRPJMA: String(row[findCol(['Sasaran RPJMA'])] || ''),
        skpaSasaran: String(row[findCol(['SKPA Sasaran'])] || ''),
        namaPelatihan: String(row[findCol(['Nama Pelatihan'])] || ''),
        kategori: KATEGORI_MAP[kategoriRaw.toLowerCase()] || 'TEKNIS',
        metodePembelajaran: METODE_MAP[metodeRaw.toLowerCase()] || 'TATAP_MUKA',
        durasiJP: Number(row[findCol(['Durasi (JP)'])] || 0),
        targetOutput: String(row[findCol(['Target Output'])] || ''),
        prioritas: PRIORITAS_MAP[prioritasRaw.toLowerCase()] || 'SEDANG',
        tahunPelaksanaan: tahunRaw ? Number(tahunRaw) : new Date().getFullYear(),
        status: STATUS_MAP[statusRaw.toLowerCase()] || 'AKTIF',
        dibuatOleh: session.user.id,
      }
    })

    const result = await db.analisisDiklatItem.createMany({ data: items })

    await auditLog(session, 'IMPORT', 'ANALISIS_DIKLAT', `Import ${result.count} item analisis diklat dari XLS`, req)

    return NextResponse.json({ success: true, imported: result.count })
  } catch (e) {
    console.error('analisis-diklat import error:', e)
    return NextResponse.json({ error: 'Gagal mengimpor data' }, { status: 500 })
  }
}
