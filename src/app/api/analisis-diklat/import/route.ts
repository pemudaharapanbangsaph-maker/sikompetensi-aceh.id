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

const PRIORITAS_TO_ANALISIS: Record<string, string> = {
  TINGGI: 'TINGGI',
  SEDANG: 'NORMAL',
  RENDAH: 'RENDAH',
}

const TINGKAT_TO_ANALISIS: Record<string, string> = {
  TINGGI: 'TINGGI',
  SEDANG: 'SEDANG',
  RENDAH: 'RENDAH',
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

      const prioritas = PRIORITAS_MAP[prioritasRaw.toLowerCase()] || 'SEDANG'
      const tahun = tahunRaw ? Number(tahunRaw) : new Date().getFullYear()

      return {
        diklatItem: {
          outcome: String(row[findCol(['Outcome'])] || ''),
          programPrioritasRPJMA: String(row[findCol(['Program Prioritas RPJMA'])] || ''),
          sasaranRPJMA: String(row[findCol(['Sasaran RPJMA'])] || ''),
          skpaSasaran: String(row[findCol(['SKPA Sasaran'])] || ''),
          namaPelatihan: String(row[findCol(['Nama Pelatihan'])] || ''),
          metodePembelajaran: METODE_MAP[metodeRaw.toLowerCase()] || 'TATAP_MUKA',
          durasiJP: Number(row[findCol(['Durasi (JP)'])] || 0),
          targetOutput: String(row[findCol(['Target Output'])] || ''),
          prioritas,
          tahunPelaksanaan: tahun,
          dibuatOleh: session.user.id,
        },
        analisisKebutuhan: {
          judul: String(row[findCol(['Nama Pelatihan'])] || ''),
          tahun: tahun,
          unitKerja: String(row[findCol(['SKPA Sasaran'])] || ''),
          jenisKompetensi: 'TEKNIS',
          jumlahPegawai: 0,
          tingkatKebutuhan: TINGKAT_TO_ANALISIS[prioritas] || 'SEDANG',
          prioritas: PRIORITAS_TO_ANALISIS[prioritas] || 'NORMAL',
          catatan: [
            String(row[findCol(['Outcome'])] || ''),
            String(row[findCol(['Program Prioritas RPJMA'])] || ''),
          ].filter(Boolean).join(' | '),
          status: 'DRAFT' as const,
          dibuatOleh: session.user.id,
        },
      }
    })

    // Simpan ke kedua tabel
    const [diklatResult] = await Promise.all([
      db.analisisDiklatItem.createMany({ data: items.map((i) => i.diklatItem) }),
      db.analisisKebutuhan.createMany({ data: items.map((i) => i.analisisKebutuhan) }),
    ])

    await auditLog(session, 'IMPORT', 'ANALISIS_DIKLAT', `Import ${diklatResult.count} item analisis diklat dari XLS ke kedua tabel`, req)

    return NextResponse.json({ success: true, imported: diklatResult.count })
  } catch (e) {
    console.error('analisis-diklat import error:', e)
    return NextResponse.json({ error: 'Gagal mengimpor data' }, { status: 500 })
  }
}
