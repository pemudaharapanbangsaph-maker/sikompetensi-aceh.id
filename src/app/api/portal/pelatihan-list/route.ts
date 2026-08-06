import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// API ini dipakai oleh dropdown "Pilih Pelatihan" di portal pendaftaran.
// Data diambil dari AnalisisDiklatItem (sumber sama dengan Jelajahi Program),
// bukan dari tabel Pelatihan (master data).

export async function GET() {
  try {
    const items = await db.analisisDiklatItem.findMany({
      where: { status: 'AKTIF' },
      select: {
        id: true,
        namaPelatihan: true,
        kategori: true,
        durasiJP: true,
        metodePembelajaran: true,
        prioritas: true,
        tahunPelaksanaan: true,
      },
      orderBy: { namaPelatihan: 'asc' },
    })

    // Generate kode dari urutan untuk ditampilkan di dropdown
    const list = items.map((p, i) => ({
      id: p.id,
      nama: p.namaPelatihan,
      kode: `AD-${String(i + 1).padStart(3, '0')}`,
      kategori: p.kategori,
      jp: p.durasiJP,
      metode: p.metodePembelajaran,
      prioritas: p.prioritas,
      tahun: p.tahunPelaksanaan,
    }))

    return NextResponse.json(list)
  } catch (e) {
    console.error('portal pelatihan list error:', e)
    return NextResponse.json([], { status: 500 })
  }
}
