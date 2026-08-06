import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''

    const where: Record<string, unknown> = {}
    if (status) where.status = status

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

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
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
    doc.text(`Total: ${totalAll}`, 18, 39)
    doc.text(`Menunggu: ${menunggu}`, 70, 39)
    doc.text(`Diterima: ${diterima}`, 130, 39)
    doc.text(`Ditolak: ${ditolak}`, 190, 39)

    // Table
    const rows = data.map((d, i) => [
      i + 1,
      d.nama,
      d.nip,
      d.pangkatGolongan || '-',
      d.jabatan || '-',
      d.instansi || '-',
      d.nomorHP || '-',
      d.analisisDiklatItem?.namaPelatihan || '-',
      d._count.dokumen,
      STATUS_LABEL[d.status] || d.status,
      d.createdAt.toISOString().slice(0, 10),
    ])

    autoTable(doc, {
      startY: 46,
      head: [[
        'No', 'Nama', 'NIP', 'Pangkat/Gol', 'Jabatan',
        'Instansi', 'No. HP', 'Pelatihan', 'Dok', 'Status', 'Tgl Daftar',
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
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 32 },
        2: { cellWidth: 28 },
        3: { cellWidth: 18 },
        4: { cellWidth: 30 },
        5: { cellWidth: 35 },
        6: { cellWidth: 18 },
        7: { cellWidth: 45 },
        8: { cellWidth: 10, halign: 'center' },
        9: { cellWidth: 16, halign: 'center' },
        10: { cellWidth: 22 },
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
