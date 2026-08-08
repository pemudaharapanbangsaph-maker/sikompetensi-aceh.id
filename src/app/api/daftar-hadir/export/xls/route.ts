import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

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

    const rows = angkatan.peserta.map((pa, i) => ({
      'No': i + 1,
      'NAMA': pa.peserta.nama,
      'NIP': pa.peserta.nip,
      'INSTANSI': pa.peserta.instansi || pa.peserta.unitKerja || '-',
      'Paraf 1': '',
      'Paraf 2': '',
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)

    ws['!cols'] = [
      { wch: 5 }, { wch: 35 }, { wch: 25 }, { wch: 40 }, { wch: 12 }, { wch: 12 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Daftar Hadir')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const safeName = angkatan.pelatihan.nama.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').slice(0, 60)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="daftar-hadir-${safeName}.xlsx"`,
      },
    })
  } catch (e) {
    console.error('daftar-hadir export xls error:', e)
    return NextResponse.json({ error: 'Gagal export Excel' }, { status: 500 })
  }
}
