import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'

const JENIS_KELAMIN_LABEL: Record<string, string> = {
  L: 'Laki-laki',
  P: 'Perempuan',
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const peserta = await db.peserta.findMany({
      orderBy: { nama: 'asc' },
    })

    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = 210
    const marginL = 15
    const marginR = 15

    // Summary data
    const totalPeserta = peserta.length
    const totalLaki = peserta.filter((p) => p.jenisKelamin === 'L').length
    const totalPerempuan = peserta.filter((p) => p.jenisKelamin === 'P').length
    const totalInstansi = new Set(peserta.map((p) => p.instansi).filter(Boolean)).size
    const totalUnitKerja = new Set(peserta.map((p) => p.unitKerja).filter(Boolean)).size

    // HEADER
    let y = 15
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('LAPORAN DATA PESERTA', pageW / 2, y, { align: 'center' })
    y += 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Sistem Informasi Kompetensi Teknis BPSDM Aceh', pageW / 2, y, { align: 'center' })
    y += 10

    // SUMMARY BOX
    const summaryItems = [
      ['Total Peserta', String(totalPeserta)],
      ['Laki-laki', String(totalLaki)],
      ['Perempuan', String(totalPerempuan)],
      ['Jumlah Instansi', String(totalInstansi)],
      ['Jumlah Unit Kerja', String(totalUnitKerja)],
    ]
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(marginL, y, pageW - marginL - marginR, 22, 2, 2, 'F')
    let sx = marginL + 8
    const sy = y + 7
    doc.setFontSize(9)
    summaryItems.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(`${label}:`, sx, sy)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(value, sx + doc.getTextWidth(`${label}: `), sy)
      sx += 35
    })
    doc.setTextColor(0, 0, 0)
    y += 30

    // TABLE
    const headerRow = [['No.', 'NAMA', 'NIP', 'JENIS KELAMIN', 'JABATAN', 'UNIT KERJA', 'INSTANSI', 'PENDIDIKAN']]
    const bodyRows = peserta.map((p, i) => [
      String(i + 1),
      p.nama,
      p.nip,
      JENIS_KELAMIN_LABEL[p.jenisKelamin] || p.jenisKelamin || '-',
      p.jabatan || '-',
      p.unitKerja || '-',
      p.instansi || '-',
      p.pendidikan || '-',
    ])

    autoTable(doc, {
      startY: y,
      head: headerRow,
      body: bodyRows,
      headStyles: {
        fillColor: [15, 76, 129],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
        halign: 'center',
        valign: 'middle',
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center', valign: 'middle' },
        1: { cellWidth: 35 },
        2: { cellWidth: 28 },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 28 },
        5: { cellWidth: 28 },
        6: { cellWidth: 25 },
        7: { cellWidth: 18, halign: 'center' },
      },
      margin: { left: marginL, right: marginR },
      rowPageBreak: 'avoid',
      theme: 'grid',
    })

    // Page numbers
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.text(`Halaman ${i} dari ${pageCount}`, pageW / 2, 290, { align: 'center' })
      doc.setTextColor(0, 0, 0)
    }

    await auditLog(session, 'EXPORT', 'LAPORAN_PESERTA', `Export laporan peserta (${peserta.length} peserta) ke PDF`, req)

    const pdfBuf = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="laporan-peserta.pdf"',
      },
    })
  } catch (e) {
    console.error('laporan peserta export pdf error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor laporan peserta' }, { status: 500 })
  }
}
