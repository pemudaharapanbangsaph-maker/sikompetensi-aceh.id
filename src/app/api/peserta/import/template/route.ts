import { NextResponse } from 'next/server'
import { getSession, hasPermission } from '@/lib/auth'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  'No. Telp',
  'Email',
  'Pendidikan',
  'Alamat',
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
    '081234567890',
    'ahmad.fauzi@aceh.go.id',
    'S2',
    'Jl. T. Iskandar No. 1, Banda Aceh',
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
    '081298765432',
    'siti.nurhaliza@aceh.go.id',
    'S1',
    '',
  ],
  [
    '198803202012011003',
    'Muhammad Iqbal, M.T',
    'L',
    'Bireuen',
    '1988-03-20',
    'Pranata Komputer',
    'III/d',
    'Dinas Komunikasi dan Informatika',
    'Pemerintah Aceh',
    '085277889900',
    'm.iqbal@aceh.go.id',
    'S2',
    '',
  ],
]

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const wsData = [HEADERS, ...EXAMPLE_ROWS]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Atur lebar kolom agar mudah dibaca
    ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 18) }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Peserta')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-import-peserta.xlsx"',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('[peserta/template] Gagal:', error)
    return NextResponse.json({ error: 'Gagal membuat template' }, { status: 500 })
  }
}
