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

function fmtTanggalShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
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

    // Ambil semua uji kompetensi dengan relasi
    const ujiList = await db.ujiKompetensi.findMany({
      include: {
        angkatan: { include: { pelatihan: true } },
        asesor: { include: { asesor: true } },
        _count: { select: { nilai: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const selesai = ujiList.filter((u) => u.status === 'SELESAI')
    const berlangsung = ujiList.filter((u) => u.status === 'BERLANGSUNG')
    const dijadwalkan = ujiList.filter((u) => u.status === 'DIJADWALKAN')
    const dibatalkan = ujiList.filter((u) => u.status === 'DIBATALKAN')
    const totalPeserta = ujiList.reduce((s, u) => s + (u.jumlahPeserta || 0), 0)
    const totalSkema = new Set(ujiList.map((u) => u.skemaSertifikasi)).size

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
      doc.text('LAPORAN UJI KOMPETENSI', pageW / 2, y, { align: 'center' })
      y += 6
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Sistem Informasi Kompetensi Teknis BPSDM Aceh', pageW / 2, y, { align: 'center' })
      y += 10

      // SUMMARY BOX
      const summaryItems = [
        ['Total Skema', String(totalSkema)],
        ['Total Uji', String(ujiList.length)],
        ['Selesai', String(selesai.length)],
        ['Berlangsung', String(berlangsung.length)],
        ['Dijadwalkan', String(dijadwalkan.length)],
        ['Total Peserta', String(totalPeserta)],
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
        sx += 43
      })
      doc.setTextColor(0, 0, 0)
      y += 26

      // TABLE
      const headerRow = [[
        'No.', 'KODE UJI', 'SKEMA SERTIFIKASI', 'PELATIHAN', 'ANGKATAN',
        'TANGGAL UJI', 'TEMPAT', 'PESERTA', 'NILAI', 'ASESOR', 'STATUS'
      ]]
      const bodyRows = ujiList.map((u, i) => [
        String(i + 1),
        u.kode,
        u.skemaSertifikasi.length > 35 ? u.skemaSertifikasi.slice(0, 34) + '…' : u.skemaSertifikasi,
        u.angkatan?.pelatihan?.nama || '-',
        u.angkatan?.namaAngkatan || '-',
        fmtTanggalShort(u.tanggalUji),
        u.tempat || '-',
        String(u.jumlahPeserta || 0),
        String(u._count?.nilai || 0),
        u.asesor.map((a) => a.asesor.nama).join(', ') || '-',
        STATUS_LABEL[u.status] || u.status,
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
          0: { cellWidth: 7, halign: 'center', valign: 'middle' },
          1: { cellWidth: 18 },
          2: { cellWidth: 40 },
          3: { cellWidth: 35 },
          4: { cellWidth: 24 },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 22 },
          7: { cellWidth: 14, halign: 'center' },
          8: { cellWidth: 12, halign: 'center' },
          9: { cellWidth: 38 },
          10: { cellWidth: 20, halign: 'center' },
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
        doc.text(`Halaman ${i} dari ${pageCount}`, pageW / 2, pageH - 10, { align: 'center' })
        doc.setTextColor(0, 0, 0)
      }

      await auditLog(session, 'EXPORT', 'LAPORAN_UJI_KOMPETENSI', `Export laporan uji kompetensi (${ujiList.length} uji) ke PDF`, req)

      const pdfBuf = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(pdfBuf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="laporan-uji-kompetensi.pdf"',
        },
      })
    }

    // === FORMAT XLSX (default) ===
    // Kelompokkan berdasarkan skema sertifikasi
    const skemaMap = new Map<string, { skema: string; items: typeof ujiList }>()
    ujiList.forEach((u) => {
      if (!skemaMap.has(u.skemaSertifikasi)) {
        skemaMap.set(u.skemaSertifikasi, { skema: u.skemaSertifikasi, items: [] })
      }
      skemaMap.get(u.skemaSertifikasi)!.items.push(u)
    })

    const rekapRows = Array.from(skemaMap.values()).map((s) => {
      const items = s.items
      const jmlSelesai = items.filter((u) => u.status === 'SELESAI').length
      const jmlBerlangsung = items.filter((u) => u.status === 'BERLANGSUNG').length
      const jmlDijadwalkan = items.filter((u) => u.status === 'DIJADWALKAN').length
      const jmlPeserta = items.reduce((s2, u) => s2 + (u.jumlahPeserta || 0), 0)
      return {
        'Skema Sertifikasi': s.skema,
        'Jumlah Uji': items.length,
        'Selesai': jmlSelesai,
        'Berlangsung': jmlBerlangsung,
        'Dijadwalkan': jmlDijadwalkan,
        'Total Peserta Uji': jmlPeserta,
      }
    })

    // Tambah baris total
    rekapRows.push({
      'Skema Sertifikasi': 'TOTAL',
      'Jumlah Uji': ujiList.length,
      'Selesai': selesai.length,
      'Berlangsung': berlangsung.length,
      'Dijadwalkan': dijadwalkan.length,
      'Total Peserta Uji': totalPeserta,
    })

    // === Sheet 2: Detail Uji Kompetensi ===
    const detailRows = ujiList.map((u, idx) => ({
      No: idx + 1,
      'Kode Uji': u.kode,
      'Skema Sertifikasi': u.skemaSertifikasi,
      'Pelatihan': u.angkatan?.pelatihan?.nama || '-',
      'Angkatan': u.angkatan?.namaAngkatan || '-',
      'Tanggal Uji': fmtTanggal(u.tanggalUji),
      'Tempat': u.tempat || '-',
      'Jumlah Peserta': u.jumlahPeserta,
      'Jumlah Nilai Terisi': u._count?.nilai || 0,
      'Asesor': u.asesor.map((a) => a.asesor.nama).join(', ') || '-',
      'Status': STATUS_LABEL[u.status] || u.status,
    }))

    // === Sheet 3: Ringkasan ===
    const ringkasanRows = [
      { Keterangan: 'Total Skema Sertifikasi', Jumlah: skemaMap.size },
      { Keterangan: 'Total Uji Kompetensi', Jumlah: ujiList.length },
      { Keterangan: 'Uji Selesai', Jumlah: selesai.length },
      { Keterangan: 'Uji Berlangsung', Jumlah: berlangsung.length },
      { Keterangan: 'Uji Dijadwalkan', Jumlah: dijadwalkan.length },
      { Keterangan: 'Uji Dibatalkan', Jumlah: dibatalkan.length },
      { Keterangan: 'Total Peserta Uji', Jumlah: totalPeserta },
    ]

    // Buat workbook
    const wb = XLSX.utils.book_new()

    const wsRekap = XLSX.utils.json_to_sheet(rekapRows)
    wsRekap['!cols'] = [
      { wch: 40 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
    ]
    XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekapitulasi')

    const wsDetail = XLSX.utils.json_to_sheet(detailRows)
    wsDetail['!cols'] = [
      { wch: 5 }, { wch: 15 }, { wch: 40 }, { wch: 30 }, { wch: 25 },
      { wch: 14 }, { wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 30 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Uji Kompetensi')

    const wsRingkasan = XLSX.utils.json_to_sheet(ringkasanRows)
    wsRingkasan['!cols'] = [{ wch: 30 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    await auditLog(session, 'EXPORT', 'LAPORAN_UJI_KOMPETENSI', `Export laporan uji kompetensi (${ujiList.length} uji) ke XLS`, req)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="laporan-uji-kompetensi.xlsx"',
      },
    })
  } catch (e) {
    console.error('laporan uji kompetensi export error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor laporan uji kompetensi' }, { status: 500 })
  }
}
