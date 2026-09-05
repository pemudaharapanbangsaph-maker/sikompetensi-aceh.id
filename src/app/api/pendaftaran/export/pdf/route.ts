import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const analisisDiklatItemId = searchParams.get('analisisDiklatItemId') || ''

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (analisisDiklatItemId) where.analisisDiklatItemId = analisisDiklatItemId

    const data = await db.pendaftaranPortal.findMany({
      where,
      include: {
        analisisDiklatItem: { select: { namaPelatihan: true, kategori: true, metodePembelajaran: true, durasiJP: true, tahunPelaksanaan: true } },
        _count: { select: { dokumen: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const STATUS_LABEL: Record<string, string> = { MENUNGGU: 'Menunggu', DITERIMA: 'Diterima', DITOLAK: 'Ditolak' }

    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    // Kertas F4 / Folio (8.5" x 13" = 215.9 x 330.2 mm) — orientasi landscape
    // menghasilkan halaman 330.2 mm (lebar) x 215.9 mm (tinggi).
    // jsPDF menukar sisi otomatis sesuai orientasi, jadi format ditulis [lebar-portrait, tinggi-portrait].
    const F4 = [215.9, 330.2]
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: F4 })
    const pageW = doc.internal.pageSize.getWidth()

    // Header
    doc.setFillColor(15, 76, 129) // #0F4C81
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('SIKOMPETENSI ACEH — BPSDM Provinsi Aceh', pageW / 2, 10, { align: 'center' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Data Pendaftar Portal Pendaftaran Pelatihan', pageW / 2, 17, { align: 'center' })
    doc.setFontSize(8)
    doc.text(`Diekspor: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`, pageW / 2, 23, { align: 'center' })

    // Stats bar
    const totalAll = data.length
    const menunggu = data.filter((d) => d.status === 'MENUNGGU').length
    const diterima = data.filter((d) => d.status === 'DITERIMA').length
    const ditolak = data.filter((d) => d.status === 'DITOLAK').length

    doc.setFillColor(245, 247, 250)
    doc.rect(14, 32, pageW - 28, 10, 'F')
    doc.setTextColor(71, 85, 105)
    doc.setFontSize(8)
    // posisi disebar merata mengikuti lebar kertas F4 (330.2 mm)
    doc.text(`Total: ${totalAll}`, 18, 39)
    doc.text(`Menunggu: ${menunggu}`, 105, 39)
    doc.text(`Diterima: ${diterima}`, 200, 39)
    doc.text(`Ditolak: ${ditolak}`, 290, 39)

    // Table
    const rows = data.map((d, i) => [
      i + 1,
      d.nama,
      d.nip,
      d.pangkatGolongan || '-',
      d.jabatan || '-',
      d.unitKerja || '-',
      d.instansi || '-',
      d.nomorHP || '-',
      d.email || '-',
      d.analisisDiklatItem?.namaPelatihan || '-',
      d._count.dokumen,
      STATUS_LABEL[d.status] || d.status,
      d.createdAt.toISOString().slice(0, 10),
    ])

    autoTable(doc, {
      startY: 46,
      head: [[
        'No', 'Nama', 'NIP', 'Pangkat/Gol', 'Jabatan',
        'Unit Kerja', 'Instansi', 'No. HP', 'Email', 'Pelatihan', 'Dok', 'Status', 'Tgl Daftar',
      ]],
      body: rows,
      headStyles: {
        fillColor: [15, 76, 129],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: 'bold',
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      // Lebar kolom untuk 13 kolom (0-12) pada kertas F4 landscape:
      // ruang tersedia = 330.2 - margin kiri 14 - kanan 14 = 302.2 mm.
      // Total lebar di bawah = 298 mm agar selalu muat (tidak ada kolom tergeser/menimpa).
      // CATATAN: sebelumnya indeks style bergeser satu setelah kolom Email ditambahkan
      // (style "10 mm" untuk Dok salah diterapkan ke Pelatihan → teks Pelatihan menimpa).
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },   // No
        1: { cellWidth: 27 },                    // Nama
        2: { cellWidth: 30 },                    // NIP (18 digit)
        3: { cellWidth: 15 },                    // Pangkat/Gol
        4: { cellWidth: 24 },                    // Jabatan
        5: { cellWidth: 27 },                    // Unit Kerja
        6: { cellWidth: 27 },                    // Instansi
        7: { cellWidth: 17 },                    // No. HP
        8: { cellWidth: 36 },                    // Email
        9: { cellWidth: 42 },                    // Pelatihan (dulu kejepit 10 mm → menimpa)
        10: { cellWidth: 9, halign: 'center' },  // Dok
        11: { cellWidth: 17, halign: 'center' }, // Status
        12: { cellWidth: 19, halign: 'center' }, // Tgl Daftar
      },
      margin: { left: 14, right: 14 },
    })

    // Footer on every page
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      const pageH = doc.internal.pageSize.getHeight()
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.text(`Halaman ${i} dari ${pageCount}`, pageW / 2, pageH - 8, { align: 'center' })
    }

    const pdfBuf = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="data-pendaftar-portal.pdf"',
      },
    })
  } catch (e) {
    console.error('pendaftaran export pdf error:', e)
    return NextResponse.json({ error: 'Gagal export PDF' }, { status: 500 })
  }
}
