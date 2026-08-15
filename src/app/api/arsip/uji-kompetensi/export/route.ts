import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

const STATUS_LABEL: Record<string, string> = {
  DIJADWALKAN: 'Dijadwalkan',
  BERLANGSUNG: 'Berlangsung',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

function fmtTanggal(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'xlsx'
    const search = searchParams.get('search') || undefined

    const where: Record<string, unknown> = { deleted: true }
    if (search) {
      where.OR = [
        { kode: { contains: search } },
        { skemaSertifikasi: { contains: search } },
        { tempat: { contains: search } },
      ]
    }

    const data = await db.ujiKompetensi.findMany({
      where,
      include: {
        angkatan: { include: { pelatihan: true } },
        asesor: { include: { asesor: true } },
        _count: { select: { nilai: true } },
      },
      orderBy: { deletedAt: 'desc' },
    })

    const totalArsip = data.length
    const totalNilai = data.reduce((s, u) => s + (u._count?.nilai || 0), 0)
    const totalPeserta = data.reduce((s, u) => s + (u.jumlahPeserta || 0), 0)

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
      doc.text('ARSIP UJI KOMPETENSI', pageW / 2, y, { align: 'center' })
      y += 6
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Sistem Informasi Kompetensi Teknis BPSDM Aceh', pageW / 2, y, { align: 'center' })
      y += 10

      // SUMMARY BOX
      const summaryItems = [
        ['Total Arsip', String(totalArsip)],
        ['Total Peserta', String(totalPeserta)],
        ['Total Nilai', String(totalNilai)],
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
      const headerRow = [[
        'No.', 'KODE UJI', 'SKEMA SERTIFIKASI', 'PELATIHAN', 'ANGKATAN',
        'TANGGAL UJI', 'TEMPAT', 'PESERTA', 'NILAI', 'ASESOR', 'STATUS', 'TGL DIARSIPKAN'
      ]]
      const bodyRows = data.map((u, i) => [
        String(i + 1),
        u.kode,
        u.skemaSertifikasi.length > 30 ? u.skemaSertifikasi.slice(0, 29) + '...' : u.skemaSertifikasi,
        u.angkatan?.pelatihan?.nama || '-',
        u.angkatan?.namaAngkatan || '-',
        fmtTanggal(u.tanggalUji),
        u.tempat || '-',
        String(u.jumlahPeserta || 0),
        String(u._count?.nilai || 0),
        u.asesor.map((a) => a.asesor.nama).join(', ') || '-',
        STATUS_LABEL[u.status] || u.status,
        u.deletedAt ? fmtTanggal(u.deletedAt) : '-',
      ])

      autoTable(doc, {
        startY: y,
        head: headerRow,
        body: bodyRows,
        headStyles: {
          fillColor: [15, 76, 129],
          textColor: [255, 255, 255],
          fontSize: 7,
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
          1: { cellWidth: 18 },
          2: { cellWidth: 36 },
          3: { cellWidth: 30 },
          4: { cellWidth: 24 },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 20 },
          7: { cellWidth: 15, halign: 'center' },
          8: { cellWidth: 12, halign: 'center' },
          9: { cellWidth: 34 },
          10: { cellWidth: 18, halign: 'center' },
          11: { cellWidth: 24 },
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

      await auditLog(session, 'EXPORT', 'ARSIP_UJI_KOMPETENSI', `Export arsip uji kompetensi (${totalArsip} data) ke PDF`, req)

      const pdfBuf = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(pdfBuf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="arsip-uji-kompetensi.pdf"',
        },
      })
    }

    // === FORMAT XLSX (default) ===
    const rows = data.map((u, idx) => ({
      No: idx + 1,
      'Kode Uji': u.kode,
      'Skema Sertifikasi': u.skemaSertifikasi,
      'Pelatihan': u.angkatan?.pelatihan?.nama || '-',
      'Angkatan': u.angkatan?.namaAngkatan || '-',
      'Tanggal Uji': fmtTanggal(u.tanggalUji),
      'Tempat': u.tempat || '-',
      'Jumlah Peserta': u.jumlahPeserta || 0,
      'Jumlah Nilai': u._count?.nilai || 0,
      'Asesor': u.asesor.map((a) => a.asesor.nama).join(', ') || '-',
      'Status': STATUS_LABEL[u.status] || u.status,
      'Tanggal Diarsipkan': u.deletedAt ? fmtTanggal(u.deletedAt) : '-',
    }))

    const ringkasanRows = [
      { Keterangan: 'Total Arsip Uji Kompetensi', Jumlah: totalArsip },
      { Keterangan: 'Total Peserta', Jumlah: totalPeserta },
      { Keterangan: 'Total Nilai Tercatat', Jumlah: totalNilai },
    ]

    const wb = XLSX.utils.book_new()

    const wsData = XLSX.utils.json_to_sheet(rows)
    wsData['!cols'] = [
      { wch: 5 }, { wch: 15 }, { wch: 40 }, { wch: 30 }, { wch: 25 },
      { wch: 14 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 30 },
      { wch: 14 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, wsData, 'Arsip Uji Kompetensi')

    const wsRingkasan = XLSX.utils.json_to_sheet(ringkasanRows)
    wsRingkasan['!cols'] = [{ wch: 30 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    await auditLog(session, 'EXPORT', 'ARSIP_UJI_KOMPETENSI', `Export arsip uji kompetensi (${totalArsip} data) ke XLSX`, req)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="arsip-uji-kompetensi.xlsx"',
      },
    })
  } catch (e) {
    console.error('arsip uji-kompetensi export error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor arsip uji kompetensi' }, { status: 500 })
  }
}
