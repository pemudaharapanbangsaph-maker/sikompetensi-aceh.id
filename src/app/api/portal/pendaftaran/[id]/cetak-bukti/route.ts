import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch pendaftaran with relasi (public, tanpa auth)
    const p = await db.pendaftaranPortal.findUnique({
      where: { id },
      include: {
        analisisDiklatItem: {
          select: {
            namaPelatihan: true,
            kategori: true,
            metodePembelajaran: true,
            durasiJP: true,
            durasiHari: true,
            tahunPelaksanaan: true,
            pelatihan: {
              select: {
                angkatan: {
                  select: { namaAngkatan: true, tanggalMulai: true, tanggalSelesai: true, lokasi: true },
                  orderBy: { createdAt: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
        dokumen: { select: { tipe: true, namaFile: true } },
      },
    })
    if (!p) return NextResponse.json({ error: 'Data pendaftaran tidak ditemukan' }, { status: 404 })

    // Fetch pengaturan (nama instansi, dll)
    const settingsRows = await db.pengaturan.findMany()
    const settings: Record<string, string> = {}
    for (const r of settingsRows) settings[r.key] = r.value

    const instansiNama = settings.instansi_nama || 'Badan Pengembangan Sumber Daya Manusia Aceh'
    const instansiSingkat = settings.instansi_singkat || 'BPSDM Aceh'
    const instansiAlamat = settings.instansi_alamat || 'Jl.T.Panglima Nyak Makam No 8 Lampineng, Kota Banda Aceh, 24415 Email: bpsdm@acehprov.go.id'

    const KATEGORI_LABEL: Record<string, string> = {
      TEKNIS: 'Teknis',
      MANAJERIAL: 'Manajerial',
      FUNGSIONAL: 'Fungsional',
      SOSIAL_KULTURAL: 'Sosial Kultural',
    }
    const METODE_LABEL: Record<string, string> = {
      TATAP_MUKA: 'Tatap Muka',
      DARING: 'Daring',
      BLENDED: 'Blended',
    }
    const STATUS_LABEL: Record<string, string> = {
      MENUNGGU: 'Menunggu Verifikasi',
      DITERIMA: 'Diterima',
      DITOLAK: 'Ditolak',
    }
    const TIPE_DOK: Record<string, string> = {
      KTP: 'KTP',
      SURAT_TUGAS: 'Surat Tugas',
      NPWP: 'NPWP',
      REK_BANK: 'Rekening Bank',
    }

    // PDF generation
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pw = 210
    const ph = 297
    const ml = 20
    const mr = 20
    const cw = pw - ml - mr
    let y = 15

    // ========== KOP SURAT ==========
    doc.setFillColor(15, 76, 129)
    doc.rect(0, 0, pw, 8, 'F')

    const logoPath = path.join(process.cwd(), 'public', 'logo-pancacita.png')
    let logoAdded = false
    try {
      const logoBuf = await readFile(logoPath)
      const logoBase64 = 'data:image/png;base64,' + logoBuf.toString('base64')
      doc.addImage(logoBase64, 'PNG', ml, y + 5, 14, 14)
      logoAdded = true
    } catch { }
    if (!logoAdded) {
      doc.setFillColor(15, 76, 129)
      doc.circle(ml + 7, y + 5, 7, 'F')
      doc.setFontSize(7)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text('BPSDM', ml + 7, y + 5.5, { align: 'center' })
      doc.setFontSize(5)
      doc.text('ACEH', ml + 7, y + 8, { align: 'center' })
    }

    doc.setTextColor(15, 76, 129)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('PEMERINTAH ACEH', pw / 2, y + 2, { align: 'center' })
    doc.setFontSize(10)
    doc.text(instansiNama.toUpperCase(), pw / 2, y + 8, { align: 'center' })
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('BIDANG PENGEMBANGAN DAN SERTIFIKASI KOMPETENSI TEKNIS INTI', pw / 2, y + 13, { align: 'center' })
    doc.text(instansiAlamat, pw / 2, y + 17.5, { align: 'center' })

    y += 22
    doc.setDrawColor(15, 76, 129)
    doc.setLineWidth(0.8)
    doc.line(ml, y, pw - mr, y)
    doc.setLineWidth(0.3)
    doc.line(ml, y + 1, pw - mr, y + 1)

    y += 10

    // ========== JUDUL ==========
    doc.setFillColor(15, 76, 129)
    doc.roundedRect(ml, y, cw, 10, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('BUKTI PENDAFTARAN PELATIHAN', pw / 2, y + 6.5, { align: 'center' })
    y += 16

    // ========== NOMOR PENDAFTARAN ==========
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const noPendaftaran = `REG-${p.createdAt.getFullYear()}${String(p.createdAt.getMonth() + 1).padStart(2, '0')}${String(p.createdAt.getDate()).padStart(2, '0')}-${p.id.slice(-6).toUpperCase()}`
    doc.text(`No. Pendaftaran: ${noPendaftaran}`, pw - mr, y, { align: 'right' })
    y += 8

    // ========== INFORMASI PELATIHAN ==========
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(9)
    const pelatihanNama = p.analisisDiklatItem?.namaPelatihan || '-'
    const pelatihanKategori = KATEGORI_LABEL[p.analisisDiklatItem?.kategori || ''] || '-'
    const pelatihanMetode = METODE_LABEL[p.analisisDiklatItem?.metodePembelajaran || ''] || '-'
    const pelatihanJP = p.analisisDiklatItem?.durasiJP || 0
    const pelatihanHari = p.analisisDiklatItem?.durasiHari || 0
    const pelatihanTahun = p.analisisDiklatItem?.tahunPelaksanaan || '-'
    const angkatanPertama = p.analisisDiklatItem?.pelatihan?.angkatan?.[0]
    const tanggalMulai = angkatanPertama?.tanggalMulai
      ? new Date(angkatanPertama.tanggalMulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : ''
    const tanggalSelesai = angkatanPertama?.tanggalSelesai
      ? new Date(angkatanPertama.tanggalSelesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : ''
    const tanggalPelaksanaan = tanggalMulai && tanggalSelesai
      ? `${tanggalMulai} s/d ${tanggalSelesai}`
      : tanggalMulai || tanggalSelesai || '-'
    const pelatihanLokasi = angkatanPertama?.lokasi || '-'

    const tanggalTextLen = tanggalPelaksanaan.length
    const extraHeight = tanggalTextLen > 40 ? 8 : 0
    const boxHeight = 44 + extraHeight

    doc.setFillColor(248, 250, 252)
    doc.roundedRect(ml, y, cw, boxHeight, 2, 2, 'F')

    doc.setTextColor(15, 76, 129)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('INFORMASI PELATIHAN', ml + 4, y + 6)

    let ly = y + 13
    doc.setFont('helvetica', 'bold')
    doc.text('Nama Pelatihan', ml + 4, ly)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${pelatihanNama}`, ml + 38, ly)
    ly += 6

    const rcol = pw / 2 + 5
    doc.setFont('helvetica', 'bold')
    doc.text('Kategori', ml + 4, ly)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${pelatihanKategori}`, ml + 38, ly)
    doc.setFont('helvetica', 'bold')
    doc.text('JP / Hari', rcol, ly)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${pelatihanJP} JP / ${pelatihanHari} Hari`, rcol + 28, ly)
    ly += 6

    doc.setFont('helvetica', 'bold')
    doc.text('Metode', ml + 4, ly)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${pelatihanMetode}`, ml + 38, ly)
    doc.setFont('helvetica', 'bold')
    doc.text('Tahun', rcol, ly)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${pelatihanTahun}`, rcol + 28, ly)
    ly += 6

    doc.setFont('helvetica', 'bold')
    doc.text('Tgl Pelaksanaan', ml + 4, ly)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${tanggalPelaksanaan}`, ml + 38, ly)
    doc.setFont('helvetica', 'bold')
    doc.text('Lokasi', rcol, ly)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${pelatihanLokasi}`, rcol + 28, ly)

    y += boxHeight + 6

    // ========== DATA PESERTA ==========
    doc.setTextColor(15, 76, 129)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('DATA PESERTA', ml, y)
    y += 7

    const tglLahir = p.tanggalLahir ? new Date(p.tanggalLahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'
    const tglDaftar = p.createdAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const statusLabel = STATUS_LABEL[p.status] || p.status

    const biodata: [string, string][] = [
      ['Nama Lengkap', p.nama],
      ['NIP', p.nip],
      ['Pangkat/Golongan', p.pangkatGolongan || '-'],
      ['Tempat, Tgl Lahir', `${p.tempatLahir || '-'}, ${tglLahir}`],
      ['Jabatan', p.jabatan || '-'],
      ['Unit Kerja', p.unitKerja || '-'],
      ['Instansi', p.instansi || '-'],
      ['No. HP', p.nomorHP || '-'],
      ['NPWP', p.npwp || '-'],
      ['No. Rekening', p.nomorRekening || '-'],
    ]

    doc.setFontSize(9)
    for (const [label, value] of biodata) {
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'normal')
      doc.text(label, ml + 4, y)
      doc.setTextColor(30, 41, 59)
      doc.text(`: ${value}`, ml + 42, y)
      y += 6.5
    }

    y += 3

    // ========== STATUS PENDAFTARAN ==========
    doc.setDrawColor(15, 76, 129)
    doc.setLineWidth(0.5)
    doc.roundedRect(ml, y, cw, 10, 2, 2, 'S')
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Tanggal Pendaftaran: ${tglDaftar}`, ml + 4, y + 4)
    doc.text(`Status: ${statusLabel}`, ml + 4, y + 8)
    doc.text(`Waktu: ${p.createdAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`, pw - mr, y + 6, { align: 'right' })

    y += 16

    // ========== DOKUMEN YANG DIUNGGAH ==========
    doc.setTextColor(15, 76, 129)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('DOKUMEN YANG DIUNGGAH', ml, y)
    y += 6

    if (p.dokumen.length > 0) {
      for (const d of p.dokumen) {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(30, 41, 59)
        doc.setFontSize(8.5)
        const tipeLabel = TIPE_DOK[d.tipe] || d.tipe
        doc.setTextColor(21, 128, 61)
        doc.text('\u2713', ml + 4, y)
        doc.setTextColor(30, 41, 59)
        doc.text(`${tipeLabel}`, ml + 9, y)
        y += 5.5
      }
    } else {
      doc.setTextColor(148, 163, 184)
      doc.setFontSize(8)
      doc.text('Belum ada dokumen yang diunggah', ml + 4, y)
      y += 5.5
    }

    y += 8

    // ========== CATATAN ADMIN ==========
    if (p.catatanAdmin) {
      doc.setFillColor(255, 251, 235)
      doc.roundedRect(ml, y, cw, 12, 2, 2, 'F')
      doc.setDrawColor(251, 191, 36)
      doc.setLineWidth(0.3)
      doc.roundedRect(ml, y, cw, 12, 2, 2, 'S')
      doc.setTextColor(146, 64, 14)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Catatan Admin:', ml + 4, y + 5)
      doc.setFont('helvetica', 'normal')
      doc.text(p.catatanAdmin, ml + 4, y + 9.5)
      y += 18
    }

    // ========== FOOTER: TTD ==========
    if (y < 200) y = 200

    y += 5
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Bukti ini diterbitkan secara otomatis oleh sistem.', ml, y)
    y += 5
    doc.text('Verifikasi kelengkapan data dan dokumen dilakukan oleh admin.', ml, y)

    y += 15
    doc.text(`Banda Aceh, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pw - mr - 30, y)
    y += 3
    doc.setFont('helvetica', 'bold')
    doc.text('Admin Pendaftaran', pw - mr - 30, y)

    y += 15
    doc.setDrawColor(30, 41, 59)
    doc.setLineWidth(0.5)
    doc.line(pw - mr - 35, y, pw - mr + 5, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('Dicetak: ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }), pw - mr, y, { align: 'right' })

    // ========== PAGE FOOTER ==========
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setDrawColor(15, 76, 129)
      doc.setLineWidth(0.3)
      doc.line(ml, ph - 12, pw - mr, ph - 12)
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.text(`SIKOMPETENSI \u2014 ${instansiSingkat}`, ml, ph - 8)
      doc.text(`Halaman ${i} dari ${pageCount}`, pw - mr, ph - 8, { align: 'right' })
    }

    const pdfBuf = Buffer.from(doc.output('arraybuffer'))
    const filename = `bukti-pendaftaran-${p.nama.replace(/\s+/g, '-').toLowerCase()}-${p.nip}.pdf`
    return new NextResponse(pdfBuf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error('portal cetak bukti error:', e)
    return NextResponse.json({ error: 'Gagal mencetak bukti pendaftaran' }, { status: 500 })
  }
}
