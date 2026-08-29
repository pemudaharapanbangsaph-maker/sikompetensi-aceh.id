import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

function generateDates(start: Date, end: Date): string[] {
  const out: string[] = []
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return out
  const cur = new Date(s)
  while (cur <= e) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const angkatanId = searchParams.get('angkatanId')
    if (!angkatanId) return NextResponse.json({ error: 'angkatanId wajib diisi' }, { status: 400 })

    const angkatan = await db.angkatan.findUnique({
      where: { id: angkatanId },
      include: {
        pelatihan: true,
        peserta: {
          include: { peserta: true },
          orderBy: { peserta: { nama: 'asc' } },
        },
      },
    })
    if (!angkatan) return NextResponse.json({ error: 'Angkatan tidak ditemukan' }, { status: 404 })

    // Fetch kehadiran records
    const kehadiranRecords = await db.kehadiran.findMany({
      where: { angkatanId },
      orderBy: [{ tanggal: 'asc' }, { pesertaId: 'asc' }],
    })

    // Build kehadiran map
    const kehadiranMap: Record<string, { status: string; keterangan: string | null }> = {}
    for (const rec of kehadiranRecords) {
      const key = `${rec.pesertaId}_${rec.tanggal.toISOString().slice(0, 10)}`
      kehadiranMap[key] = { status: rec.statusKehadiran, keterangan: rec.keterangan }
    }

    const dates = generateDates(angkatan.tanggalMulai, angkatan.tanggalSelesai)

    // Build header row
    const dateHeaders = dates.map((d) => {
      const dt = new Date(d + 'T00:00:00')
      const dayName = dt.toLocaleDateString('id-ID', { weekday: 'short' })
      const dayNum = dt.getDate()
      return `${dayName} ${dayNum}`
    })

    const headers = ['No', 'Nama Peserta', 'NIP', ...dateHeaders, 'Keterangan']

    // Build data rows
    const rows = angkatan.peserta.map((pa, i) => {
      const row: (string | number)[] = [i + 1, pa.peserta.nama, pa.peserta.nip]
      for (const d of dates) {
        const key = `${pa.pesertaId}_${d}`
        const rec = kehadiranMap[key]
        row.push(rec ? rec.status : '-')
      }
      // Keterangan
      const keters: string[] = []
      for (const d of dates) {
        const key = `${pa.pesertaId}_${d}`
        const rec = kehadiranMap[key]
        if (rec?.keterangan) {
          const dt = new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
          keters.push(`${dt}: ${rec.keterangan}`)
        }
      }
      row.push(keters.length > 0 ? keters.join('; ') : '')
      return row
    })

    // Create workbook with header + rows
    const wsData = [headers, ...rows]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Column widths
    const colWidths = [
      { wch: 5 },  // No
      { wch: 35 }, // Nama
      { wch: 25 }, // NIP
      ...dates.map(() => ({ wch: 10 })), // date columns
      { wch: 35 }, // Keterangan
    ]
    ws['!cols'] = colWidths

    // Freeze panes: freeze first 3 columns and header row
    ws['!freeze'] = { xSplit: 3, ySplit: 1 }

    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Kehadiran')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const safeName = angkatan.pelatihan.nama.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').slice(0, 60)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="rekap-kehadiran-${safeName}.xlsx"`,
      },
    })
  } catch (e) {
    console.error('daftar-hadir export xls error:', e)
    return NextResponse.json({ error: 'Gagal export Excel' }, { status: 500 })
  }
}
