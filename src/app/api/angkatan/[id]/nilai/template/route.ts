import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'
import * as XLSX from 'xlsx'

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
      include: {
        pelatihan: true,
        peserta: {
          include: { peserta: true },
          orderBy: { createdAt: 'asc' },
        },
        evaluasi: {
          where: {
            OR: [{ jenisEvaluasi: 'PRE_TEST' }, { jenisEvaluasi: 'POST_TEST' }],
          },
        },
      },
    })
    if (!angkatan) {
      return NextResponse.json({ error: 'Angkatan tidak ditemukan' }, { status: 404 })
    }

    const existingNilai = new Map<string, { preTest?: number; postTest?: number }>()
    for (const ev of angkatan.evaluasi || []) {
      if (!ev.pesertaId) continue
      const entry = existingNilai.get(ev.pesertaId) || {}
      if (ev.jenisEvaluasi === 'PRE_TEST') {
        entry.preTest = entry.preTest === undefined ? ev.nilai : entry.preTest + ev.nilai
      } else if (ev.jenisEvaluasi === 'POST_TEST') {
        entry.postTest = entry.postTest === undefined ? ev.nilai : entry.postTest + ev.nilai
      }
      existingNilai.set(ev.pesertaId, entry)
    }

    const HEADERS = ['NIP', 'Nama Peserta', 'Pre-Test', 'Post-Test']

    const rows: (string | number)[][] = angkatan.peserta.map((pa) => {
      const ev = existingNilai.get(pa.pesertaId)
      return [
        pa.peserta?.nip || '',
        pa.peserta?.nama || '',
        ev?.preTest !== undefined ? ev.preTest : '',
        ev?.postTest !== undefined ? ev.postTest : '',
      ]
    })

    for (let i = 0; i < 3; i++) {
      rows.push(['', '', '', ''])
    }

    const INSTRUCTIONS = [
      ['PETUNJUK PENGISIAN TEMPLATE NILAI'],
      [''],
      ['1. Sheet "Input Nilai" berisi daftar peserta yang sudah terdaftar di angkatan ini.'],
      ['2. Isi kolom "Pre-Test" dan "Post-Test" dengan angka (0-100).'],
      ['3. Kolom "NIP" dan "Nama Peserta" JANGAN diubah (dipakai untuk matching).'],
      ['4. Jika peserta belum punya nilai sebelumnya, kolom Pre-Test/Post-Test kosong — silakan isi.'],
      ['5. Jika peserta sudah punya nilai, kolom menampilkan nilai lama — boleh edit untuk update.'],
      ['6. Kosongkan kolom Pre-Test atau Post-Test jika hanya ingin input salah satu.'],
      ['7. Setelah selesai, upload file Excel ini via tombol "Import Nilai" di halaman Peserta per Kegiatan.'],
      ['8. Sistem akan otomatis:'],
      ['   - Hapus nilai Pre-Test lama untuk peserta tersebut (jika ada nilai baru di Excel)'],
      ['   - Hapus nilai Post-Test lama untuk peserta tersebut (jika ada nilai baru di Excel)'],
      ['   - Buat record Evaluasi baru dengan nilai dari Excel'],
      ['   - Nilai Akhir akan otomatis dihitung = (Pre-Test + Post-Test) / 2'],
      ['9. Peserta yang NIP-nya tidak terdaftar di angkatan akan di-skip (tidak diimpor).'],
      ['10. Format file harus .xlsx atau .xls'],
      [''],
      ['CONTOH PENGISIAN:'],
      ['NIP                  | Nama Peserta        | Pre-Test | Post-Test'],
      ['198501012010011001  | Ahmad Fauzi, S.STP  | 75       | 85'],
      ['199002152015012002  | Siti Nurhaliza     | 80       | 90'],
    ]

    const wb = XLSX.utils.book_new()

    const wsInput = XLSX.utils.aoa_to_sheet([HEADERS, ...rows])
    wsInput['!cols'] = [
      { wch: 24 },
      { wch: 35 },
      { wch: 12 },
      { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(wb, wsInput, 'Input Nilai')

    const wsInstr = XLSX.utils.aoa_to_sheet(INSTRUCTIONS)
    wsInstr['!cols'] = [{ wch: 100 }]
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Petunjuk')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const safeName = `${angkatan.namaAngkatan}_${angkatan.pelatihan?.kode || 'template'}`
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .slice(0, 60)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="template_nilai_${safeName}.xlsx"`,
      },
    })
  } catch (e) {
    console.error('template nilai download error:', e)
    return NextResponse.json({ error: 'Gagal mengunduh template nilai' }, { status: 500 })
  }
}
