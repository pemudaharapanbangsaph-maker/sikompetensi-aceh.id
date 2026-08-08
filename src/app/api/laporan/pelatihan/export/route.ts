import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

const JENIS_KELAMIN_LABEL: Record<string, string> = {
  L: 'Laki-laki',
  P: 'Perempuan',
}

const STATUS_LABEL: Record<string, string> = {
  AKTIF: 'Aktif',
  NONAKTIF: 'Nonaktif',
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ambil semua peserta
    const peserta = await db.peserta.findMany({
      orderBy: { nama: 'asc' },
    })

    // === Sheet 1: Data Peserta ===
    const dataRows = peserta.map((p, idx) => ({
      No: idx + 1,
      'Nama': p.nama,
      'NIP': p.nip,
      'Jenis Kelamin': JENIS_KELAMIN_LABEL[p.jenisKelamin] || p.jenisKelamin || '-',
      'Tempat Lahir': p.tempatLahir || '-',
      'Tanggal Lahir': p.tanggalLahir
        ? new Date(p.tanggalLahir).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '-',
      'Jabatan': p.jabatan || '-',
      'Pangkat/Golongan': p.pangkatGolongan || '-',
      'Unit Kerja': p.unitKerja || '-',
      'Instansi': p.instansi || '-',
      'Pendidikan': p.pendidikan || '-',
      'No. Telp': p.noTelp || '-',
      'Email': p.email || '-',
      'Status': STATUS_LABEL[p.status] || p.status,
    }))

    // === Sheet 2: Rekap per Instansi ===
    const instansiMap = new Map<string, number>()
    peserta.forEach((p) => {
      const instansi = p.instansi || 'Lainnya'
      instansiMap.set(instansi, (instansiMap.get(instansi) || 0) + 1)
    })
    const rekapInstansi = Array.from(instansiMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([instansi, jumlah], idx) => ({
        No: idx + 1,
        Instansi: instansi,
        'Jumlah Peserta': jumlah,
      }))
    rekapInstansi.push({ No: '', Instansi: 'TOTAL', 'Jumlah Peserta': peserta.length })

    // === Sheet 3: Rekap per Unit Kerja ===
    const unitKerjaMap = new Map<string, number>()
    peserta.forEach((p) => {
      const uk = p.unitKerja || 'Lainnya'
      unitKerjaMap.set(uk, (unitKerjaMap.get(uk) || 0) + 1)
    })
    const rekapUnitKerja = Array.from(unitKerjaMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([unitKerja, jumlah], idx) => ({
        No: idx + 1,
        'Unit Kerja': unitKerja,
        'Jumlah Peserta': jumlah,
      }))
    rekapUnitKerja.push({ No: '', 'Unit Kerja': 'TOTAL', 'Jumlah Peserta': peserta.length })

    // Buat workbook
    const wb = XLSX.utils.book_new()

    const wsData = XLSX.utils.json_to_sheet(dataRows)
    wsData['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 14 }, { wch: 16 },
      { wch: 25 }, { wch: 10 },
    ]
    XLSX.utils.book_append_sheet(wb, wsData, 'Data Peserta')

    const wsInstansi = XLSX.utils.json_to_sheet(rekapInstansi)
    wsInstansi['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsInstansi, 'Rekap Instansi')

    const wsUnitKerja = XLSX.utils.json_to_sheet(rekapUnitKerja)
    wsUnitKerja['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsUnitKerja, 'Rekap Unit Kerja')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    await auditLog(session, 'EXPORT', 'LAPORAN_PESERTA', `Export laporan peserta (${peserta.length} peserta) ke XLS`, req)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="laporan-peserta.xlsx"',
      },
    })
  } catch (e) {
    console.error('laporan peserta export xlsx error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor laporan peserta' }, { status: 500 })
  }
}
