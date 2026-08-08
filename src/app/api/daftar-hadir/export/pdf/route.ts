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

    // A4 Portrait
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = 210
    const pageH = 297
    const marginL = 20
    const marginR = 20
    const contentW = pageW - marginL - marginR

    // ===== HEADER =====
    let y = 15
    doc.setFont('times', 'italic')
    doc.setFontSize(14)
    doc.text('DAFTAR HADIR PESERTA', pageW / 2, y, { align: 'center' })
    y += 7

    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    const pelatihanText = `${angkatan.pelatihan.nama.toUpperCase()}`
    doc.text(pelatihanText, pageW / 2, y, { align: 'center' })
    y += 6

    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    doc.text(`TAHUN ${tahun}`, pageW / 2, y, { align: 'center' })
    y += 6

    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    doc.text(`${lokasi}, ${tglMulai} s.d ${tglSelesai} ${bulanNama} ${tahun}`, pageW / 2, y, { align: 'center' })
    y += 10

    // ===== INFO FIELDS =====
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    const fields = [
      'Hari/Tanggal',
      'Waktu',
      'Fasilitator',
      'Materi',
    ]
    for (const label of fields) {
      doc.text(`${label}`, marginL, y)
      const labelW = doc.getTextWidth(`${label} `)
      // Dotted line fill
      const dots = '……………………………….'
      doc.text(dots, marginL + labelW, y)
      y += 6
    }
    y += 2

    // ===== TABLE =====
    const headerRow = [['No.', 'NAMA', 'NIP', 'INSTANSI', 'TANDA TANGAN']]
    const bodyRows = pesertaList.map((p, i) => [
      String(i + 1),
      p.nama,
      p.nip,
      p.instansi || p.unitKerja || '-',
      `${i + 1} ……….......`,
    ])

    autoTable(doc, {
      startY: y,
      head: headerRow,
      body: bodyRows,
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontSize: 9,
        fontStyle: 'bold',
        font: 'times',
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
        halign: 'center',
        valign: 'middle',
      },
      bodyStyles: {
        fontSize: 8,
        font: 'times',
        cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', valign: 'middle' },
        1: { cellWidth: 50 },
        2: { cellWidth: 38 },
        3: { cellWidth: 60 },
        4: { cellWidth: contentW - 10 - 50 - 38 - 60, halign: 'center' },
      },
      margin: { left: marginL, right: marginR },
      theme: 'grid',
    })

    // ===== FOOTER =====
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y
    let fy = finalY + 8

    // Left: Petugas Piket Kelas
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    doc.text('Petugas Piket Kelas:', marginL, fy)
    fy += 7
    doc.text('1. ', marginL + 8, fy)
    doc.text('(..................................)', marginL + 14, fy)
    fy += 7
    doc.text('2. ', marginL + 8, fy)
    doc.text('(..................................)', marginL + 14, fy)

    // Right: Tanda Tangan Penyelenggara
    const signX = pageW - marginR
    fy = finalY + 8
    doc.text('TANDA TANGAN', signX, fy, { align: 'right' })
    fy += 7
    doc.text('Penyelenggara', signX, fy, { align: 'right' })
    fy += 5
    doc.text(`${lokasi},     ${bulanNama} ${tahun}`, signX, fy, { align: 'right' })
    fy += 20
    doc.text('dto', signX, fy, { align: 'right' })

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
