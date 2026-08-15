import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

const KATEGORI_LABEL: Record<string, string> = {
  TEKNIS: 'Teknis',
  MANAJERIAL: 'Manajerial',
  FUNGSIONAL: 'Fungsional',
  SOSIAL_KULTURAL: 'Sosial Kultural',
}

function fmtTanggal(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'xlsx'
    const search = searchParams.get('search') || undefined

    const where: Record<string, unknown> = { deleted: true, nama: { not: { contains: 'uji kompetensi' } } }
    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { kode: { contains: search } },
      ]
    }

    const data = await db.pelatihan.findMany({
      where,
      include: { _count: { select: { angkatan: true } } },
      orderBy: { deletedAt: 'desc' },
    })

    const totalArsip = data.length
    const totalAngkatan = data.reduce((s, p) => s + (p._count?.angkatan || 0), 0)

    // === FORMAT PDF ===
    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [330, 215] })
      const pageW = 330
      const pageH = 215
      const marginL = 15
      const marginR = 15

      // HEADER
      let y = 12
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('ARSIP PELATIHAN', pageW / 2, y, { align: 'center' })
      y += 6
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Sistem Informasi Kompetensi Teknis BPSDM Aceh', pageW / 2, y, { align: 'center' })
      y += 10

      // SUMMARY BOX
      const summaryItems = [
        ['Total Arsip', String(totalArsip)],
        ['Total Angkatan', String(totalAngkatan)],
      ]
      doc.setFillColor(241, 245, 249)
      const boxW = pageW - marginL - marginR
      doc.roundedRect(marginL, y, boxW, 18, 2, 2, 'F')
      let sx = marginL + 10
      const sy = y + 7
      doc.setFontSize(9)
      summaryItems.forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 116, 139)
        doc.text(`${label}:`, sx, sy)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text(value, sx + doc.getTextWidth(`${label}: `), sy)
        sx += 60
      })
      doc.setTextColor(0, 0, 0)
      y += 26

      // TABLE
      const headerRow = [['No.', 'KODE', 'NAMA PELATIHAN', 'KATEGORI', 'DURASI (HARI)', 'JP', 'STATUS', 'JML ANGKATAN', 'TGL DIARSIPKAN']]
      const bodyRows = data.map((p, i) => [
        String(i + 1),
        p.kode,
        p.nama,
        KATEGORI_LABEL[p.kategori] || p.kategori,
        String(p.durasiHari),
        String(p.jp),
        p.status,
        String(p._count?.angkatan || 0),
        p.deletedAt ? fmtTanggal(p.deletedAt) : '-',
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
          fontSize: 7.5,
          cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center', valign: 'middle' },
          1: { cellWidth: 25 },
          2: { cellWidth: 80 },
          3: { cellWidth: 24, halign: 'center' },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 15, halign: 'center' },
          6: { cellWidth: 20, halign: 'center' },
          7: { cellWidth: 22, halign: 'center' },
          8: { cellWidth: 28 },
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
        doc.text(`Halaman ${i} dari ${pageCount}`, pageW / 2, pageH - 12, { align: 'center' })
        doc.setTextColor(0, 0, 0)
      }

      await auditLog(session, 'EXPORT', 'ARSIP_PELATIHAN', `Export arsip pelatihan (${totalArsip} data) ke PDF`, req)

      const pdfBuf = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(pdfBuf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="arsip-pelatihan.pdf"',
        },
      })
    }

    // === FORMAT XLSX (default) ===
    const rows = data.map((p, idx) => ({
      No: idx + 1,
      'Kode Pelatihan': p.kode,
      'Nama Pelatihan': p.nama,
      'Kategori': KATEGORI_LABEL[p.kategori] || p.kategori,
      'Deskripsi': p.deskripsi || '-',
      'Durasi (Hari)': p.durasiHari,
      'Jam Pelatihan': p.jp,
      'Status': p.status,
      'Jumlah Angkatan': p._count?.angkatan || 0,
      'Tanggal Diarsipkan': p.deletedAt ? fmtTanggal(p.deletedAt) : '-',
    }))

    const ringkasanRows = [
      { Keterangan: 'Total Arsip Pelatihan', Jumlah: totalArsip },
      { Keterangan: 'Total Angkatan', Jumlah: totalAngkatan },
    ]

    const wb = XLSX.utils.book_new()

    const wsData = XLSX.utils.json_to_sheet(rows)
    wsData['!cols'] = [
      { wch: 5 }, { wch: 18 }, { wch: 40 }, { wch: 15 }, { wch: 30 },
      { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, wsData, 'Arsip Pelatihan')

    const wsRingkasan = XLSX.utils.json_to_sheet(ringkasanRows)
    wsRingkasan['!cols'] = [{ wch: 30 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    await auditLog(session, 'EXPORT', 'ARSIP_PELATIHAN', `Export arsip pelatihan (${totalArsip} data) ke XLSX`, req)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="arsip-pelatihan.xlsx"',
      },
    })
  } catch (e) {
    console.error('arsip pelatihan export error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor arsip pelatihan' }, { status: 500 })
  }
}
