import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * GET /api/pendaftaran/by-nip/[nip]/dokumen
 * Ambil data pendaftaran + dokumen berdasarkan NIP.
 * Dipakai oleh Riwayat Peserta untuk menampilkan dokumen.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ nip: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { nip } = await params

    const data = await db.pendaftaranPortal.findUnique({
      where: { nip },
      include: {
        analisisDiklatItem: { select: { namaPelatihan: true, kategori: true } },
        dokumen: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!data) {
      return NextResponse.json({ found: false, dokumen: [], pendaftaran: null })
    }

    return NextResponse.json({
      found: true,
      pendaftaran: {
        id: data.id,
        nama: data.nama,
        nip: data.nip,
        pelatihan: data.analisisDiklatItem?.namaPelatihan || '',
        status: data.status,
        tanggalDaftar: data.createdAt.toISOString(),
      },
      dokumen: data.dokumen.map((doc) => ({
        id: doc.id,
        tipe: doc.tipe,
        namaFile: doc.namaFile,
        ukuran: doc.ukuranFile,
      })),
    })
  } catch (e) {
    console.error('pendaftaran by-nip dokumen error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}
