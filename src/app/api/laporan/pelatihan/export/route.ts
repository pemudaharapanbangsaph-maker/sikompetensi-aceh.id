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

const METODE_LABEL: Record<string, string> = {
  TATAP_MUKA: 'Tatap Muka',
  DARING: 'Daring',
  BLENDED: 'Blended',
}

const STATUS_LABEL: Record<string, string> = {
  PERENCANAAN: 'Perencanaan',
  BERJALAN: 'Berjalan',
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
    if (!hasPermission(session.user.role, 'pelatihan:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'xlsx'
    const angkatanId = searchParams.get('angkatanId') || undefined

    const angkatan = await db.angkatan.findMany({
      where: angkatanId ? { id: angkatanId } : undefined,
      include: {
        pelatihan: true,
        _count: { select: { peserta: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const selesai = angkatan.filter((a) => a.status === 'SELESAI')
    const berjalan = angkatan.filter((a) => a.status === 'BERJALAN')
    const perencanaan = angkatan.filter((a) => a.status === 'PERENCANAAN')
    const dibatalkan = angkatan.filter((a) => a.status === 'DIBATALKAN')
    const totalPeserta = angkatan.reduce((s, a) => s + (a._count?.peserta || 0), 0)

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
      const selectedAngkatan = angkatan.length === 1 ? angkatan[0] : null
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(selectedAngkatan ? `LAPORAN PELATIHAN - ${selectedAngkatan.namaAngkatan}` : 'LAPORAN PELATIHAN', pageW / 2, y, { align: 'center' })
      y += 6
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(selectedAngkatan ? `${selectedAngkatan.pelatihan?.nama || ''} — Sistem Informasi Kompetensi Teknis BPSDM Aceh` : 'Sistem Informasi Kompetensi Teknis BPSDM Aceh', pageW / 2, y, { align: 'center' })
      y += 10

      // SUMMARY BOX
      const summaryItems = [
        ['Total Pelatihan', String(new Set(angkatan.map(a => a.pelatihanId)).size)],
        ['Total Angkatan', String(angkatan.length)],
        ['Selesai', String(selesai.length)],
        ['Berjalan', String(berjalan.length)],
        ['Perencanaan', String(perencanaan.length)],
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
        'No.', 'NAMA PELATIHAN', 'KODE', 'KATEGORI', 'NAMA ANKATAN',
        'PERIODE', 'LOKASI', 'METODE', 'PESERTA', 'STATUS'
      ]]
      const bodyRows = angkatan.map((a, i) => [
        String(i + 1),
        a.pelatihan?.nama || '-',
        a.pelatihan?.kode || '-',
        KATEGORI_LABEL[a.pelatihan?.kategori || ''] || a.pelatihan?.kategori || '-',
        a.namaAngkatan,
        `${fmtTanggalShort(a.tanggalMulai)} - ${fmtTanggalShort(a.tanggalSelesai)}`,
        a.lokasi || '-',
        METODE_LABEL[a.metode] || a.metode,
        String(a._count?.peserta || 0),
        STATUS_LABEL[a.status] || a.status,
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
          0: { cellWidth: 8, halign: 'center', valign: 'middle' },
          1: { cellWidth: 60 },
          2: { cellWidth: 22 },
          3: { cellWidth: 24, halign: 'center' },
          4: { cellWidth: 40 },
          5: { cellWidth: 42 },
          6: { cellWidth: 28 },
          7: { cellWidth: 22, halign: 'center' },
          8: { cellWidth: 16, halign: 'center' },
          9: { cellWidth: 22, halign: 'center' },
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

      await auditLog(session, 'EXPORT', 'LAPORAN_PELATIHAN', `Export laporan pelatihan (${angkatan.length} angkatan) ke PDF`, req)

      const pdfBuf = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(pdfBuf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="laporan-pelatihan.pdf"',
        },
      })
    }

    // === FORMAT XLSX (default) ===
    const pelatihanMap = new Map<string, { nama: string; kode: string; kategori: string; angkatanList: typeof angkatan }>()
    angkatan.forEach((a) => {
      const pid = a.pelatihanId
      if (!pelatihanMap.has(pid)) {
        pelatihanMap.set(pid, {
          nama: a.pelatihan?.nama || '-',
          kode: a.pelatihan?.kode || '-',
          kategori: a.pelatihan?.kategori || '-',
          angkatanList: [],
        })
      }
      pelatihanMap.get(pid)!.angkatanList.push(a)
    })

    const rekapRows = Array.from(pelatihanMap.values()).map((p) => {
      const angkatanList = p.angkatanList
      const jmlSelesai = angkatanList.filter((a) => a.status === 'SELESAI').length
      const jmlBerjalan = angkatanList.filter((a) => a.status === 'BERJALAN').length
      const jmlPerencanaan = angkatanList.filter((a) => a.status === 'PERENCANAAN').length
      const jmlDibatalkan = angkatanList.filter((a) => a.status === 'DIBATALKAN').length
      const jmlPeserta = angkatanList.reduce((s, a) => s + (a._count?.peserta || 0), 0)
      return {
        'Nama Pelatihan': p.nama,
        'Kode': p.kode,
        'Kategori': KATEGORI_LABEL[p.kategori] || p.kategori,
        'Jumlah Angkatan': angkatanList.length,
        'Selesai': jmlSelesai,
        'Berjalan': jmlBerjalan,
        'Perencanaan': jmlPerencanaan,
        'Dibatalkan': jmlDibatalkan,
        'Total Peserta': jmlPeserta,
      }
    })

    rekapRows.push({
      'Nama Pelatihan': 'TOTAL',
      'Kode': '',
      'Kategori': '',
      'Jumlah Angkatan': angkatan.length,
      'Selesai': selesai.length,
      'Berjalan': berjalan.length,
      'Perencanaan': perencanaan.length,
      'Dibatalkan': dibatalkan.length,
      'Total Peserta': totalPeserta,
    })

    const detailRows = angkatan.map((a, idx) => ({
      No: idx + 1,
      'Nama Pelatihan': a.pelatihan?.nama || '-',
      'Kode Pelatihan': a.pelatihan?.kode || '-',
      'Kategori': KATEGORI_LABEL[a.pelatihan?.kategori || ''] || a.pelatihan?.kategori || '-',
      'Nama Angkatan': a.namaAngkatan,
      'Tanggal Mulai': fmtTanggal(a.tanggalMulai),
      'Tanggal Selesai': fmtTanggal(a.tanggalSelesai),
      'Lokasi': a.lokasi || '-',
      'Metode': METODE_LABEL[a.metode] || a.metode,
      'Kuota': a.kuota,
      'Jumlah Peserta': a._count?.peserta || 0,
      'Status': STATUS_LABEL[a.status] || a.status,
    }))

    const ringkasanRows = [
      { Keterangan: 'Total Pelatihan', Jumlah: pelatihanMap.size },
      { Keterangan: 'Total Angkatan', Jumlah: angkatan.length },
      { Keterangan: 'Angkatan Selesai', Jumlah: selesai.length },
      { Keterangan: 'Angkatan Berjalan', Jumlah: berjalan.length },
      { Keterangan: 'Angkatan Perencanaan', Jumlah: perencanaan.length },
      { Keterangan: 'Angkatan Dibatalkan', Jumlah: dibatalkan.length },
      { Keterangan: 'Total Peserta Terdaftar', Jumlah: totalPeserta },
    ]

    const wb = XLSX.utils.book_new()

    const wsRekap = XLSX.utils.json_to_sheet(rekapRows)
    wsRekap['!cols'] = [
      { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 16 },
      { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 15 },
    ]
    XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekapitulasi')

    const wsDetail = XLSX.utils.json_to_sheet(detailRows)
    wsDetail['!cols'] = [
      { wch: 5 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
      { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 8 },
      { wch: 15 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Angkatan')

    const wsRingkasan = XLSX.utils.json_to_sheet(ringkasanRows)
    wsRingkasan['!cols'] = [{ wch: 30 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    await auditLog(session, 'EXPORT', 'LAPORAN_PELATIHAN', `Export laporan pelatihan (${angkatan.length} angkatan) ke XLS`, req)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="laporan-pelatihan.xlsx"',
      },
    })
  } catch (e) {
    console.error('laporan pelatihan export error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor laporan pelatihan' }, { status: 500 })
  }
}
