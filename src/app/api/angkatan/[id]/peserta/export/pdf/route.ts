import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'

const STATUS_LABEL: Record<string, string> = {
  TERDAFTAR: 'Terdaftar',
  LULUS: 'Lulus',
  TIDAK_LULUS: 'Tidak Lulus',
  DROP_OUT: 'Drop Out',
}

const METODE_LABEL: Record<string, string> = {
  TATAP_MUKA: 'Tatap Muka',
  DARING: 'Daring',
  BLENDED: 'Blended',
}

const STATUS_ANGKATAN_LABEL: Record<string, string> = {
  PERENCANAAN: 'Perencanaan',
  BERJALAN: 'Berjalan',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

function fmtTanggal(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const angkatan = await db.angkatan.findUnique({
      where: { id },
      include: {
        pelatihan: true,
        peserta: {
          include: { peserta: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!angkatan) {
      return NextResponse.json({ error: 'Angkatan tidak ditemukan' }, { status: 404 })
    }

    // Dynamic import jspdf for server-side PDF generation
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 14
    const usableWidth = pageWidth - margin * 2

    // === HEADER ===
    let y = 12
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('DAFTAR PESERTA KEGIATAN PELATIHAN', pageWidth / 2, y, { align: 'center' })

    y += 7
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('SIKOMPETENSI ACEH - BPSDM Provinsi Aceh', pageWidth / 2, y, { align: 'center' })

    y += 6
    doc.setDrawColor(15, 76, 129) // #0F4C81
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)

    y += 8

    // === INFO KEGIATAN ===
    const infoData = [
      ['Nama Pelatihan', angkatan.pelatihan?.nama || '-'],
      ['Kode Pelatihan', angkatan.pelatihan?.kode || '-'],
      ['Nama Angkatan', angkatan.namaAngkatan],
      ['Periode', `${fmtTanggal(angkatan.tanggalMulai)} s/d ${fmtTanggal(angkatan.tanggalSelesai)}`],
      ['Lokasi', angkatan.lokasi || '-'],
      ['Metode', METODE_LABEL[angkatan.metode] || angkatan.metode],
      ['Status', STATUS_ANGKATAN_LABEL[angkatan.status] || angkatan.status],
    ]

    doc.setFontSize(8)
    infoData.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold')
      doc.text(`${label}`, margin + 2, y)
      doc.setFont('helvetica', 'normal')
      doc.text(`: ${value}`, margin + 50, y)
      y += 5
    })

    y += 4

    // === STATISTIK ===
    const totalL = angkatan.peserta.filter((pa) => pa.peserta.jenisKelamin === 'L').length
    const totalP = angkatan.peserta.filter((pa) => pa.peserta.jenisKelamin === 'P').length
    const totalLulus = angkatan.peserta.filter((pa) => pa.status === 'LULUS').length

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(`Total Peserta: ${angkatan.peserta.length}  |  L: ${totalL}  |  P: ${totalP}  |  Lulus: ${totalLulus}`, margin + 2, y)
    y += 8

    // === TABLE PESERTA ===
    const tableHeaders = [
      'No', 'NIP', 'Nama Peserta', 'L/P', 'Jabatan',
      'Pangkat/Gol.', 'Unit Kerja', 'Instansi', 'Pendidikan', 'Nilai', 'Status',
    ]

    const tableRows = angkatan.peserta.map((pa, idx) => [
      String(idx + 1),
      pa.peserta.nip,
      pa.peserta.nama,
      pa.peserta.jenisKelamin === 'L' ? 'L' : 'P',
      pa.peserta.jabatan || '-',
      pa.peserta.pangkatGolongan || '-',
      pa.peserta.unitKerja || '-',
      pa.peserta.instansi || '-',
      pa.peserta.pendidikan || '-',
      pa.nilaiAkhir != null ? String(pa.nilaiAkhir) : '-',
      STATUS_LABEL[pa.status] || pa.status,
    ])

    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: y,
      margin: { left: margin, right: margin, bottom: 20 },
      styles: {
        fontSize: 7,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [15, 76, 129], // #0F4C81
        textColor: 255,
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },   // No
        1: { cellWidth: 30 },                      // NIP
        2: { cellWidth: 45 },                      // Nama
        3: { halign: 'center', cellWidth: 10 },    // L/P
        4: { cellWidth: 40 },                      // Jabatan
        5: { cellWidth: 30 },                      // Pangkat
        6: { cellWidth: 40 },                      // Unit Kerja
        7: { cellWidth: 40 },                      // Instansi
        8: { halign: 'center', cellWidth: 18 },    // Pendidikan
        9: { halign: 'center', cellWidth: 12 },    // Nilai
        10: { halign: 'center', cellWidth: 20 },   // Status
      },
      didDrawPage: (data) => {
        // Footer di setiap halaman
        const pageNum = doc.getNumberOfPages()
        const pageHeight = doc.internal.pageSize.getHeight()
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(150)
        doc.text(
          `Halaman ${data.pageNumber} / ${pageNum}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        )
        doc.text(
          `Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} | SIKOMPETENSI ACEH`,
          pageWidth - margin,
          pageHeight - 10,
          { align: 'right' }
        )
      },
    })

    const safeName = `${angkatan.namaAngkatan}_${angkatan.pelatihan?.kode || 'peserta'}`.replace(/[^a-zA-Z0-9_\-]/g, '_')

    await auditLog(session, 'EXPORT', 'PESERTA_KEGIATAN', `Export peserta kegiatan "${angkatan.namaAngkatan}" ke PDF (${angkatan.peserta.length} peserta)`, req)

    const pdfBuf = Buffer.from(doc.output('arraybuffer'))

    return new NextResponse(pdfBuf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="peserta_${safeName}.pdf"`,
      },
    })
  } catch (e) {
    console.error('peserta per kegiatan export pdf error:', e)
    return NextResponse.json({ error: 'Gagal mengekspor PDF peserta' }, { status: 500 })
  }
}
