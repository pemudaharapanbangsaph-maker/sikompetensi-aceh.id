import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'
import * as XLSX from 'xlsx'

const HEADERS = [
  'NIP',
  'Nama',
  'L/P',
  'Tempat Lahir',
  'Tanggal Lahir',
  'Jabatan',
  'Pangkat/Golongan',
  'Unit Kerja',
  'Instansi',
  'Pendidikan',
  'No. Telp',
  'Email',
]

const EXAMPLE_ROWS = [
  [
    '198501012010011001',
    'Ahmad Fauzi, S.STP, M.Si',
    'L',
    'Banda Aceh',
    '1985-01-01',
    'Kepala Bidang',
    'III/c',
    'BPSDM Provinsi Aceh',
    'Pemerintah Aceh',
    'S2',
    '081234567890',
    'ahmad.fauzi@aceh.go.id',
  ],
  [
    '199002152015012002',
    'Siti Nurhaliza, S.Kom',
    'P',
    'Lhokseumawe',
    '15/02/1990',
    'Analis Kebijakan',
    'III/b',
    'Dinas Pendidikan',
    'Pemerintah Aceh',
    'S1',
    '081298765432',
    'siti.nurhaliza@aceh.go.id',
  ],
]

export async function GET(
  _req: Request,
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
      include: { pelatihan: true },
    })
    if (!angkatan) {
      return NextResponse.json({ error: 'Angkatan tidak ditemukan' }, { status: 404 })
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...EXAMPLE_ROWS])

    // Kolom wajib di-bold (tapi di xlsx kita cuma bisa set width)
    ws['!cols'] = [
      { wch: 24 }, // NIP
      { wch: 35 }, // Nama
      { wch: 6 },  // L/P
      { wch: 18 }, // Tempat Lahir
      { wch: 16 }, // Tanggal Lahir
      { wch: 25 }, // Jabatan
      { wch: 18 }, // Pangkat/Golongan
      { wch: 28 }, // Unit Kerja
      { wch: 25 }, // Instansi
      { wch: 14 }, // Pendidikan
      { wch: 18 }, // No. Telp
      { wch: 28 }, // Email
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Peserta')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const safeName = `${angkatan.namaAngkatan}_${angkatan.pelatihan?.kode || 'template'}`.replace(/[^a-zA-Z0-9_\-]/g, '_')

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="template_peserta_${safeName}.xlsx"`,
      },
    })
  } catch (e) {
    console.error('template peserta download error:', e)
    return NextResponse.json({ error: 'Gagal mengunduh template' }, { status: 500 })
  }
}
