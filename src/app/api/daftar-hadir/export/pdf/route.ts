import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const angkatanId = searchParams.get('angkatanId')
    if (!angkatanId) return NextResponse.json({ error: 'angkatanId wajib diisi' }, { status: 400 })

    const angkatan = await db.angkatan.findUnique({
      where: { id: angkatanId },
      include: {
        pelatihan: true,
        peserta: {
          include: { peserta: true },
          orderBy: { peserta: { nama: 'asc' } },
        },
      },
    })

    if (!angkatan) return NextResponse.json({ error: 'Angkatan tidak ditemukan' }, { status: 404 })

    const pesertaList = angkatan.peserta.map((pa) => pa.peserta)
    const bulanNama = angkatan.tanggalMulai.toLocaleString('id-ID', { month: 'long', timeZone: 'Asia/Jakarta' })
    const tahun = angkatan.tanggalMulai.getFullYear()
    const tglMulai = angkatan.tanggalMulai.getDate()
    const tglSelesai = angkatan.tanggalSelesai.getDate()
    const lokasi = angkatan.lokasi || 'Banda Aceh'

    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [215.9, 355.6] })
    const pageW = 215.9
    const marginL = 15
    const marginR = 15
    const contentW = pageW - marginL - marginR

    // HEADER
    let y = 12
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('DAFTAR HADIR PESERTA', pageW / 2, y, { align: 'center' })
    y += 7

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    const pelatihanText = `${angkatan.pelatihan.nama.toUpperCase()} TAHUN ${tahun}`
    doc.text(pelatihanText, pageW / 2, y, { align: 'center' })
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`${lokasi}, ${tglMulai} s.d ${tglSelesai} ${bulanNama} ${tahun}`, pageW / 2, y, { align: 'center' })
    y += 10

    // FIELDS
    doc.setFontSize(10)
    const fields = [
      ['Hari/Tanggal', ': ……………………………….'],
      ['Waktu', ': ……………………………….'],
      ['Fasilitator', ': ……………………………….'],
      ['Materi', '.……………….'],
    ]

    for (const [label, value] of fields) {
      doc.setFont('helvetica', 'normal')
      doc.text(`${label}`, marginL, y)
      const labelW = doc.getTextWidth(`${label} `)
      doc.text(value, marginL + labelW, y)
      y += 7
    }
    y += 3

    // TABLE
    const headerRow = [['No.', 'NAMA', 'NIP', 'INSTANSI', 'TANDA TANGAN']]
    const bodyRows = pesertaList.map((p, i) => [
      String(i + 1),
      p.nama,
      p.nip,
      p.instansi || p.unitKerja || '-',
      '',
    ])

    autoTable(doc, {
      startY: y,
      head: headerRow,
      body: bodyRows,
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        halign: 'center',
        valign: 'middle',
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: { top: 4, bottom: 4, left: 2, right: 2 },
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', valign: 'middle' },
        1: { cellWidth: 42 },
        2: { cellWidth: 38 },
        3: { cellWidth: 40 },
        4: { cellWidth: 55.9, halign: 'center' },
      },
      margin: { left: marginL, right: marginR },
      rowPageBreak: 'avoid',
      theme: 'grid',
    })

    // FOOTER - 3 kolom tanda tangan
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y
    let fy = finalY + 10

    // Banda Aceh di atas, centered
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`${lokasi},       ${bulanNama} ${tahun}`, pageW / 2, fy, { align: 'center' })
    fy += 14

    // 3 kolom: Tanda Tangan | DTO | Penyelenggara
    const colW = contentW / 3
    const signX1 = marginL + colW / 2
    const signX2 = marginL + colW + colW / 2
    const signX3 = marginL + colW * 2 + colW / 2

    doc.text('Tanda Tangan', signX1, fy, { align: 'center' })
    doc.text('DTO', signX2, fy, { align: 'center' })
    doc.text('Penyelenggara', signX3, fy, { align: 'center' })
    fy += 25

    doc.text('(..................................)', signX1, fy, { align: 'center' })
    doc.text('(..................................)', signX2, fy, { align: 'center' })
    doc.text('(..................................)', signX3, fy, { align: 'center' })

    // Page numbers
    const pageCount = doc.getNumberOfPages()
    const pageH = 355.6
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.text(`Halaman ${i} dari ${pageCount}`, pageW / 2, pageH - 8, { align: 'center' })
      doc.setTextColor(0, 0, 0)
    }

    const pdfBuf = Buffer.from(doc.output('arraybuffer'))
    const safeName = angkatan.pelatihan.nama.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').slice(0, 60)
    return new NextResponse(pdfBuf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="daftar-hadir-${safeName}.pdf"`,
      },
    })
  } catch (e) {
    console.error('daftar-hadir export pdf error:', e)
    return NextResponse.json({ error: 'Gagal export PDF' }, { status: 500 })
  }
}
