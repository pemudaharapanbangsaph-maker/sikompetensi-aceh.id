import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import * as XLSX from 'xlsx'

const METODE_MAP: Record<string, string> = {
  'tatap muka': 'TATAP_MUKA', 'daring': 'DARING', 'blended': 'BLENDED',
}
const PRIORITAS_MAP: Record<string, string> = {
  'tinggi': 'TINGGI', 'sedang': 'SEDANG', 'rendah': 'RENDAH',
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
    let imported = 0
    for (const row of rows) {
      const metodeRaw = String(row['Metode Pembelajaran'] || '').toLowerCase().trim()
      const prioritasRaw = String(row['Prioritas'] || '').toLowerCase().trim()
      await db.analisisDiklatItem.create({
        data: {
          outcome: String(row['Outcome'] || ''),
          programPrioritasRPJMA: String(row['Program Prioritas RPJMA'] || ''),
          sasaranRPJMA: String(row['Sasaran RPJMA'] || ''),
          skpaSasaran: String(row['SKPA Sasaran'] || ''),
          namaPelatihan: String(row['Nama Pelatihan'] || ''),
          metodePembelajaran: METODE_MAP[metodeRaw] || 'TATAP_MUKA',
          durasiJP: Number(row['Durasi (JP)']) || 0,
          targetOutput: String(row['Target Output'] || ''),
          prioritas: PRIORITAS_MAP[prioritasRaw] || 'SEDANG',
          tahunPelaksanaan: Number(row['Tahun Pelaksanaan']) || new Date().getFullYear(),
          dibuatOleh: session.user.id,
        },
      })
      imported++
    }
    await auditLog(session, 'CREATE', 'ANALISIS_DIKLAT', `Impor ${imported} item analisis diklat dari XLS`, req)
    return NextResponse.json({ imported })
  } catch (e) {
    console.error('import error:', e)
    return NextResponse.json({ error: 'Gagal mengimpor' }, { status: 500 })
  }
}
