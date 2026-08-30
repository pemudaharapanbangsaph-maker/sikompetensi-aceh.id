import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

/** Format Date ke "YYYY-MM-DD" menggunakan LOCAL timezone */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function generateDates(start: Date, end: Date): string[] {
  const out: string[] = []
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return out
  e.setHours(23, 59, 59, 999)
  const cur = new Date(s)
  while (cur <= e) {
    out.push(toLocalDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

const STATUS_SHORT: Record<string, string> = {
  HADIR: 'H',
  SAKIT: 'S',
  IZIN: 'I',
  ALPA: 'A',
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const angkatanId = searchParams.get('angkatanId')
    if (!angkatanId) return NextResponse.json({ error: 'angkatanId wajib diisi' }, { status: 400 })

    // Parse optional days filter (comma-separated JS day numbers, e.g. "4" = Kamis)
    const daysParam = searchParams.get('days')
    const allowedDays: Set<number> | null = daysParam
      ? new Set(daysParam.split(',').map(Number))
      : null

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

    const kehadiranRecords = await db.kehadiran.findMany({
      where: { angkatanId },
      orderBy: [{ tanggal: 'asc' }, { pesertaId: 'asc' }],
    })

    const kehadiranMap: Record<string, { status: string; keterangan: string | null }> = {}
    for (const rec of kehadiranRecords) {
      // rec.tanggal dari Prisma adalah Date object — pakai toLocalDateStr
      const key = `${rec.pesertaId}_${toLocalDateStr(rec.tanggal)}`
      kehadiranMap[key] = { status: rec.statusKehadiran, keterangan: rec.keterangan }
    }

    // Generate all dates, then filter by day if specified
    let dates = generateDates(angkatan.tanggalMulai, angkatan.tanggalSelesai)
    if (allowedDays && allowedDays.size > 0) {
      dates = dates.filter((d) => {
        const dt = new Date(d + 'T00:00:00')
        return allowedDays.has(dt.getDay())
      })
    }

    const dateHeaders = dates.map((d) => {
      const dt = new Date(d + 'T00:00:00')
      const dayName = dt.toLocaleDateString('id-ID', { weekday: 'short' })
      const dayNum = dt.getDate()
      return `${dayName} ${dayNum}`
    })

    const headers = ['No', 'Nama Peserta', 'NIP', 'Instansi', ...dateHeaders, 'Keterangan']

    const rows = angkatan.peserta.map((pa, i) => {
      const row: (string | number)[] = [
        i + 1,
        pa.peserta.nama,
        pa.peserta.nip,
        pa.peserta.instansi || pa.peserta.unitKerja || '-',
      ]
      for (const d of dates) {
        const key = `${pa.pesertaId}_${d}`
        const rec = kehadiranMap[key]
        row.push(rec ? (STATUS_SHORT[rec.status] || rec.status) : '-')
      }
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

    const wsData = [headers, ...rows]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    const colWidths = [
      { wch: 5 },  // No
      { wch: 35 }, // Nama
      { wch: 25 }, // NIP
      { wch: 30 }, // Instansi
      ...dates.map(() => ({ wch: 10 })),
      { wch: 35 }, // Keterangan
    ]
    ws['!cols'] = colWidths
    ws['!freeze'] = { xSplit: 4, ySplit: 1 }

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
