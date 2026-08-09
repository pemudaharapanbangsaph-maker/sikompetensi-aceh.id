import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

const STATUS_LABEL: Record<string, string> = {
  TERDAFTAR: 'Terdaftar',
  LULUS: 'Lulus',
  TIDAK_LULUS: 'Tidak Lulus',
  DROP_OUT: 'Drop Out',
}

const METODE_LABEL: Record<string, string> = {
  TATAP_MUKA: 'Tatap Muka',
  DARING: 'Daring',
  BLENDED: 'Blended',
}

const STATUS_ANGKATAN_LABEL: Record<string, string> = {
  PERENCANAAN: 'Perencanaan',
  BERJALAN: 'Berjalan',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

function fmtTanggal(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const angkatan = await db.angkatan.findUnique({
      where: { id },
      include: {
        pelatihan: true,
        peserta: {
          include: { peserta: true },
          orderBy: { createdAt: 'asc' },
        },
        evaluasi: {
          include: { peserta: { select: { id: true } } },
        },
      },
    })

    if (!angkatan) {
      return NextResponse.json({ error: 'Angkatan tidak ditemukan' }, { status: 404 })
    }

    // Buat map evaluasi per peserta: { pesertaId: { PRE_TEST: nilai, POST_TEST: nilai } }
    const evaluasiMap = new Map<string, Record<string, number>>()
    for (const ev of angkatan.evaluasi) {
      if (!ev.pesertaId) continue
      if (ev.jenisEvaluasi !== 'PRE_TEST' && ev.jenisEvaluasi !== 'POST_TEST') continue
      if (!evaluasiMap.has(ev.pesertaId)) {
        evaluasiMap.set(ev.pesertaId, {})
      }
      const map = evaluasiMap.get(ev.pesertaId)!
      // Jika ada multiple aspek, jumlahkan semua
      if (map[ev.jenisEvaluasi] === undefined) {
        map[ev.jenisEvaluasi] = ev.nilai
      } else {
        map[ev.jenisEvaluasi] += ev.nilai
      }
    }

    // === Sheet 1: Daftar Peserta ===
    const rows = angkatan.peserta.map((pa, idx) => {
      const ev = evaluasiMap.get(pa.pesertaId)
      const preTest = ev?.PRE_TEST
      const postTest = ev?.POST_TEST
      let nilaiAkhir: string | number = '-'
      if (preTest !== undefined && postTest !== undefined) {
        nilaiAkhir = Number(((preTest + postTest) / 2).toFixed(1))
      }
      return {
        No: idx + 1,
        NIP: pa.peserta.nip,
        Nama: pa.peserta.nama,
        'L/P': pa.peserta.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan',
        'Tempat Lahir': pa.peserta.tempatLahir || '-',
        'Tanggal Lahir': pa.peserta.tanggalLahir ? fmtTanggal(pa.peserta.tanggalLahir) : '-',
        Jabatan: pa.peserta.jabatan || '-',
        'Pangkat/Golongan': pa.peserta.pangkatGolongan || '-',
        'Unit Kerja': pa.peserta.unitKerja || '-',
        Instansi: pa.peserta.instansi || '-',
        'No. Telp': pa.peserta.noTelp || '-',
        Email: pa.peserta.email || '-',
        'Nilai Pre-Test': preTest !== undefined ? preTest : '-',
        'Nilai Post-Test': postTest !== undefined ? postTest : '-',
        'Nilai Akhir': nilaiAkhir,
      }
    })

    // Tambah baris total
    rows.push({
      No: '',
      NIP: '',
      Nama: 'TOTAL PESERTA',
      'L/P': '',
      'Tempat Lahir': '',
      'Tanggal Lahir': '',
      Jabatan: '',
      'Pangkat/Golongan': '',
      'Unit Kerja': '',
      Instansi: '',
      'No. Telp': '',
      Email: '',
      'Nilai Pre-Test': '',
      'Nilai Post-Test': '',
      'Nilai Akhir': String(angkatan.peserta.length),
    })

    // === Sheet 2: Informasi Kegiatan ===
    const l = angkatan.peserta.filter((pa) => pa.peserta.jenisKelamin === 'L').length
    const p = angkatan.peserta.filter((pa) => pa.peserta.jenisKelamin === 'P').length
    const infoRows = [
      { Keterangan: 'Nama Pelatihan', Isi: angkatan.pelatihan?.nama || '-' },
      { Keterangan: 'Kode Pelatihan', Isi: angkatan.pelatihan?.kode || '-' },
      { Keterangan: 'Nama Angkatan', Isi: angkatan.namaAngkatan },
      { Keterangan: 'Tanggal Mulai', Isi: fmtTanggal(angkatan.tanggalMulai) },
      { Keterangan: 'Tanggal Selesai', Isi: fmtTanggal(angkatan.tanggalSelesai) },
      { Keterangan: 'Lokasi', Isi: angkatan.lokasi || '-' },
      { Keterangan: 'Metode', Isi: METODE_LABEL[angkatan.metode] || angkatan.metode },
      { Keterangan: 'Status Angkatan', Isi: STATUS_ANGKATAN_LABEL[angkatan.status] || angkatan.status },
      { Keterangan: 'Kuota', Isi: String(angkatan.kuota) },
      { Keterangan: 'Total Peserta', Isi: String(angkatan.peserta.length) },
      { Keterangan: 'Peserta Laki-laki', Isi: String(l) },
      { Keterangan: 'Peserta Perempuan', Isi: String(p) },
    ]

    const wb = XLSX.utils.book_new()

    const wsPeserta = XLSX.utils.json_to_sheet(rows)
    wsPeserta['!cols'] = [
      { wch: 5 }, { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 25 },
      { wch: 16 }, { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(wb, wsPeserta, 'Daftar Peserta')

    const wsInfo = XLSX.utils.json_to_sheet(infoRows)
    wsInfo['!cols'] = [{ wch: 25 }, { wch: 45 }]
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Informasi Kegiatan')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const safeName = `${angkatan.namaAngkatan}_${angkatan.pelatihan?.kode || 'peserta'}`.replace(/[^a-zA-Z0-9_\-]/g, '_')

    await auditLog(session, 'EXPORT', 'PESERTA_KEGIATAN', `Export peserta kegiatan "${angkatan.namaAngkatan}" ke XLS (${angkatan.peserta.length} peserta)`, req)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="peserta_${safeName}.xlsx"`,
      },
    })
  } catch (e) {
    console.error('peserta per kegiatan export xls error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor data peserta' }, { status: 500 })
  }
}
