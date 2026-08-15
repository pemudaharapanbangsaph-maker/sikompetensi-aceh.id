import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

function fmtTanggal(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const JK_LABEL: Record<string, string> = { L: 'Laki-laki', P: 'Perempuan' }

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'xlsx'
    const search = searchParams.get('search') || undefined

    const where: Record<string, unknown> = { deleted: true }
    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { nip: { contains: search } },
        { unitKerja: { contains: search } },
      ]
    }

    const data = await db.peserta.findMany({
      where,
      include: { _count: { select: { angkatan: true, nilai: true } } },
      orderBy: { deletedAt: 'desc' },
    })

    const totalArsip = data.length

    // === FORMAT PDF ===
    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [330, 215] })
      const pageW = 330
      const pageH = 215
      const marginL = 15
      const marginR = 15

      let y = 12
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('ARSIP PESERTA', pageW / 2, y, { align: 'center' })
      y += 6
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Sistem Informasi Kompetensi Teknis BPSDM Aceh', pageW / 2, y, { align: 'center' })
      y += 10

      doc.setFillColor(241, 245, 249)
      const boxW = pageW - marginL - marginR
      doc.roundedRect(marginL, y, boxW, 18, 2, 2, 'F')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text(`Total Arsip:`, marginL + 10, y + 7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(String(totalArsip), marginL + 10 + doc.getTextWidth('Total Arsip: '), y + 7)
      doc.setTextColor(0, 0, 0)
      y += 26

      const headerRow = [['No.', 'NIP', 'NAMA', 'JK', 'JABATAN', 'PANGKAT/GOL', 'UNIT KERJA', 'ANGKATAN', 'NILAI', 'TGL DIARSIPKAN']]
      const bodyRows = data.map((p, i) => [
        String(i + 1),
        p.nip,
        p.nama,
        JK_LABEL[p.jenisKelamin] || p.jenisKelamin,
        p.jabatan || '-',
        p.pangkatGolongan || '-',
        p.unitKerja || '-',
        String(p._count?.angkatan || 0),
        String(p._count?.nilai || 0),
        p.deletedAt ? fmtTanggal(p.deletedAt) : '-',
      ])

      autoTable(doc, {
        startY: y, head: headerRow, body: bodyRows,
        headStyles: { fillColor: [15, 76, 129], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: { top: 3, bottom: 3, left: 2, right: 2 }, halign: 'center', valign: 'middle' },
        bodyStyles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 22 }, 2: { cellWidth: 40 }, 3: { cellWidth: 14, halign: 'center' },
          4: { cellWidth: 28 }, 5: { cellWidth: 24 }, 6: { cellWidth: 40 }, 7: { cellWidth: 18, halign: 'center' }, 8: { cellWidth: 14, halign: 'center' }, 9: { cellWidth: 26 },
        },
        margin: { left: marginL, right: marginR }, rowPageBreak: 'avoid', theme: 'grid',
      })

      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.text(`Halaman ${i} dari ${pageCount}`, pageW / 2, pageH - 12, { align: 'center' })
        doc.setTextColor(0, 0, 0)
      }

      await auditLog(session, 'EXPORT', 'ARSIP_PESERTA', `Export arsip peserta (${totalArsip} data) ke PDF`, req)
      const pdfBuf = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(pdfBuf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="arsip-peserta.pdf"' } })
    }

    // === FORMAT XLSX ===
    const rows = data.map((p, idx) => ({
      No: idx + 1, NIP: p.nip, Nama: p.nama,
      'Jenis Kelamin': JK_LABEL[p.jenisKelamin] || p.jenisKelamin,
      Jabatan: p.jabatan || '-', 'Pangkat/Golongan': p.pangkatGolongan || '-',
      'Unit Kerja': p.unitKerja || '-', Instansi: p.instansi || '-',
      Pendidikan: p.pendidikan || '-', 'No. Telp': p.noTelp || '-',
      Email: p.email || '-', Angkatan: p._count?.angkatan || 0,
      Nilai: p._count?.nilai || 0,
      'Tanggal Diarsipkan': p.deletedAt ? fmtTanggal(p.deletedAt) : '-',
    }))

    const wb = XLSX.utils.book_new()
    const wsData = XLSX.utils.json_to_sheet(rows)
    wsData['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 30 }, { wch: 14 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsData, 'Arsip Peserta')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    await auditLog(session, 'EXPORT', 'ARSIP_PESERTA', `Export arsip peserta (${totalArsip} data) ke XLSX`, req)
    return new NextResponse(buf, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="arsip-peserta.xlsx"' } })
  } catch (e) {
    console.error('arsip peserta export error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor arsip peserta' }, { status: 500 })
  }
}
