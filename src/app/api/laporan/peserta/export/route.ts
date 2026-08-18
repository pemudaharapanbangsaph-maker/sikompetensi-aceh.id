import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

const JENIS_KELAMIN_LABEL: Record<string, string> = {
  L: 'Laki-laki',
  P: 'Perempuan',
}

const STATUS_LABEL: Record<string, string> = {
  AKTIF: 'Aktif',
  NONAKTIF: 'Nonaktif',
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'xlsx'

    // Ambil semua peserta
    const peserta = await db.peserta.findMany({
      where: { deleted: false },
      orderBy: { nama: 'asc' },
      include: {
        angkatan: {
          include: {
            angkatan: {
              include: {
                pelatihan: true,
                ujiKompetensi: true,
              },
            },
          },
        },
      },
    })

    const buildKegiatanStr = (p: typeof peserta[0]): string => {
      const items: string[] = []
      for (const pa of p.angkatan) {
        const ang = pa.angkatan
        if (ang.ujiKompetensi && ang.ujiKompetensi.length > 0) {
          for (const uk of ang.ujiKompetensi) {
            items.push(`UK: ${uk.skemaSertifikasi}`)
          }
        } else if (ang.pelatihan) {
          items.push(`P: ${ang.pelatihan.nama}`)
        }
      }
      return items.length > 0 ? items.join('; ') : '-'
    }

    // === FORMAT PDF ===
    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [330, 215] })
      const pageW = 330
      const pageH = 215
      const marginL = 12
      const marginR = 12

      // HEADER
      let y = 12
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('LAPORAN DATA PESERTA', pageW / 2, y, { align: 'center' })
      y += 6
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Sistem Informasi Kompetensi Teknis Inti BPSDM Aceh', pageW / 2, y, { align: 'center' })
      y += 10

      // SUMMARY BOX
      const aktif = peserta.filter(p => p.status === 'AKTIF').length
      const nonaktif = peserta.filter(p => p.status === 'NONAKTIF').length
      const instansiSet = new Set(peserta.map(p => p.instansi).filter(Boolean))
      const summaryItems = [
        ['Total Peserta', String(peserta.length)],
        ['Aktif', String(aktif)],
        ['Nonaktif', String(nonaktif)],
        ['Instansi', String(instansiSet.size)],
      ]
      doc.setFillColor(241, 245, 249)
      const boxW = pageW - marginL - marginR
      doc.roundedRect(marginL, y, boxW, 16, 2, 2, 'F')
      let sx = marginL + 12
      const sy = y + 7
      doc.setFontSize(9)
      summaryItems.forEach(([label, value]) => {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 116, 139)
        doc.text(`${label}:`, sx, sy)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text(value, sx + doc.getTextWidth(`${label}: `), sy)
        sx += 55
      })
      doc.setTextColor(0, 0, 0)
      y += 24

      // TABLE
      const headerRow = [[
        'No.', 'NAMA', 'NIP', 'JENIS KELAMIN', 'TEMPAT/ TGL LAHIR', 'JABATAN',
        'PANGKAT/ GOLONGAN', 'UNIT KERJA', 'INSTANSI', 'PELATIHAN/ UJI KOMPETENSI', 'NO. TELP', 'STATUS'
      ]]
      const bodyRows = peserta.map((p, i) => [
        String(i + 1),
        p.nama,
        p.nip,
        JENIS_KELAMIN_LABEL[p.jenisKelamin] || p.jenisKelamin || '-',
        p.tempatLahir ? `${p.tempatLahir}, ${p.tanggalLahir ? new Date(p.tanggalLahir).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}` : '-',
        p.jabatan || '-',
        p.pangkatGolongan || '-',
        p.unitKerja || '-',
        p.instansi || '-',
        buildKegiatanStr(p),
        p.noTelp || '-',
        STATUS_LABEL[p.status] || p.status,
      ])

      autoTable(doc, {
        startY: y,
        head: headerRow,
        body: bodyRows,
        headStyles: {
          fillColor: [15, 76, 129],
          textColor: [255, 255, 255],
          fontSize: 7.5,
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
          0: { cellWidth: 10, halign: 'center', valign: 'middle' },
          1: { cellWidth: 35 },
          2: { cellWidth: 22 },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 32 },
          5: { cellWidth: 28 },
          6: { cellWidth: 22 },
          7: { cellWidth: 30 },
          8: { cellWidth: 30 },
          9: { cellWidth: 24, halign: 'center' },
          10: { cellWidth: 18 },
          11: { cellWidth: 16, halign: 'center' },
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
        doc.text(`Halaman ${i} dari ${pageCount}`, pageW / 2, pageH - 8, { align: 'center' })
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
    }

    // === FORMAT XLSX (default) ===
    // === Sheet 1: Data Peserta ===
    const dataRows = peserta.map((p, idx) => ({
      No: idx + 1,
      'Nama': p.nama,
      'NIP': p.nip,
      'Jenis Kelamin': JENIS_KELAMIN_LABEL[p.jenisKelamin] || p.jenisKelamin || '-',
      'Tempat Lahir': p.tempatLahir || '-',
      'Tanggal Lahir': p.tanggalLahir
        ? new Date(p.tanggalLahir).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '-',
      'Jabatan': p.jabatan || '-',
      'Pangkat/Golongan': p.pangkatGolongan || '-',
      'Unit Kerja': p.unitKerja || '-',
      'Instansi': p.instansi || '-',
      'Pelatihan/Uji Kompetensi': buildKegiatanStr(p),
      'No. Telp': p.noTelp || '-',
      'Email': p.email || '-',
      'Status': STATUS_LABEL[p.status] || p.status,
    }))

    // === Sheet 2: Rekap per Instansi ===
    const instansiMap = new Map<string, number>()
    peserta.forEach((p) => {
      const instansi = p.instansi || 'Lainnya'
      instansiMap.set(instansi, (instansiMap.get(instansi) || 0) + 1)
    })
    const rekapInstansi = Array.from(instansiMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([instansi, jumlah], idx) => ({
        No: idx + 1,
        Instansi: instansi,
        'Jumlah Peserta': jumlah,
      }))
    rekapInstansi.push({ No: '', Instansi: 'TOTAL', 'Jumlah Peserta': peserta.length })

    // === Sheet 3: Rekap per Unit Kerja ===
    const unitKerjaMap = new Map<string, number>()
    peserta.forEach((p) => {
      const uk = p.unitKerja || 'Lainnya'
      unitKerjaMap.set(uk, (unitKerjaMap.get(uk) || 0) + 1)
    })
    const rekapUnitKerja = Array.from(unitKerjaMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([unitKerja, jumlah], idx) => ({
        No: idx + 1,
        'Unit Kerja': unitKerja,
        'Jumlah Peserta': jumlah,
      }))
    rekapUnitKerja.push({ No: '', 'Unit Kerja': 'TOTAL', 'Jumlah Peserta': peserta.length })

    // Buat workbook
    const wb = XLSX.utils.book_new()

    const wsData = XLSX.utils.json_to_sheet(dataRows)
    wsData['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 14 }, { wch: 16 },
      { wch: 25 }, { wch: 10 },
    ]
    XLSX.utils.book_append_sheet(wb, wsData, 'Data Peserta')

    const wsInstansi = XLSX.utils.json_to_sheet(rekapInstansi)
    wsInstansi['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsInstansi, 'Rekap Instansi')

    const wsUnitKerja = XLSX.utils.json_to_sheet(rekapUnitKerja)
    wsUnitKerja['!cols'] = [{ wch: 5 }, { wch: 35 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsUnitKerja, 'Rekap Unit Kerja')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    await auditLog(session, 'EXPORT', 'LAPORAN_PESERTA', `Export laporan peserta (${peserta.length} peserta) ke XLS`, req)

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="laporan-peserta.xlsx"',
      },
    })
  } catch (e) {
    console.error('laporan peserta export xlsx error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor laporan peserta' }, { status: 500 })
  }
}
