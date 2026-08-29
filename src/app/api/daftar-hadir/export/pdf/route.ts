import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { readFile } from 'fs/promises'
import path from 'path'

function generateDates(start: Date, end: Date): string[] {
  const out: string[] = []
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return out
  const cur = new Date(s)
  while (cur <= e) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

const STATUS_SHORT: Record<string, string> = {
  HADIR: 'H',
  SAKIT: 'S',
  IZIN: 'I',
  ALPA: 'A',
}

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const angkatanId = searchParams.get('angkatanId')
    if (!angkatanId) return NextResponse.json({ error: 'angkatanId wajib diisi' }, { status: 400 })

    // Fetch angkatan + peserta + kehadiran
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

    // Fetch all kehadiran records for this angkatan
    const kehadiranRecords = await db.kehadiran.findMany({
      where: { angkatanId },
      orderBy: [{ tanggal: 'asc' }, { pesertaId: 'asc' }],
    })

    // Build kehadiran map: pesertaId_tanggalIso -> { statusKehadiran, keterangan }
    const kehadiranMap: Record<string, { status: string; keterangan: string | null }> = {}
    for (const rec of kehadiranRecords) {
      const key = `${rec.pesertaId}_${rec.tanggal.toISOString().slice(0, 10)}`
      kehadiranMap[key] = { status: rec.statusKehadiran, keterangan: rec.keterangan }
    }

    // Generate date range
    const dates = generateDates(angkatan.tanggalMulai, angkatan.tanggalSelesai)

    // Fetch pengaturan for kop surat
    const settingsRows = await db.pengaturan.findMany()
    const settings: Record<string, string> = {}
    for (const r of settingsRows) settings[r.key] = r.value

    const instansiNama = settings.instansi_nama || 'Badan Pengembangan Sumber Daya Manusia Aceh'
    const instansiSingkat = settings.instansi_singkat || 'BPSDM Aceh'
    const instansiAlamat = settings.instansi_alamat || 'Jl. T.Panglima Nyak Makam No 8 Lampineng, Kota Banda Aceh, 24415'

    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    // Use landscape A3 for wide matrix
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
    const pageW = 420
    const pageH = 297
    const marginL = 12
    const marginR = 12
    const contentW = pageW - marginL - marginR

    // ========== KOP SURAT ==========
    // Header bar
    doc.setFillColor(15, 76, 129) // #0F4C81
    doc.rect(0, 0, pageW, 8, 'F')

    let y = 12

    // Logo
    const logoPath = path.join(process.cwd(), 'public', 'logo-pancacita.png')
    let logoAdded = false
    try {
      const logoBuf = await readFile(logoPath)
      const logoBase64 = 'data:image/png;base64,' + logoBuf.toString('base64')
      doc.addImage(logoBase64, 'PNG', marginL, y, 16, 16)
      logoAdded = true
    } catch { /* fallback */ }
    if (!logoAdded) {
      doc.setFillColor(15, 76, 129)
      doc.circle(marginL + 8, y + 8, 8, 'F')
      doc.setFontSize(7)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text('BPSDM', marginL + 8, y + 7, { align: 'center' })
      doc.setFontSize(5)
      doc.text('ACEH', marginL + 8, y + 11, { align: 'center' })
    }

    // Institution name
    doc.setTextColor(15, 76, 129)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('PEMERINTAH ACEH', pageW / 2, y + 2, { align: 'center' })
    doc.setFontSize(11)
    doc.text(instansiNama.toUpperCase(), pageW / 2, y + 8, { align: 'center' })
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('BIDANG PENGEMBANGAN DAN SERTIFIKASI KOMPETENSI TEKNIS INTI', pageW / 2, y + 13, { align: 'center' })
    doc.setFontSize(7)
    doc.text(instansiAlamat, pageW / 2, y + 17, { align: 'center' })

    y += 22
    // Double line
    doc.setDrawColor(15, 76, 129)
    doc.setLineWidth(0.8)
    doc.line(marginL, y, pageW - marginR, y)
    doc.setLineWidth(0.3)
    doc.line(marginL, y + 1, pageW - marginR, y + 1)

    y += 8

    // ========== TITLE ==========
    doc.setFillColor(15, 76, 129)
    doc.roundedRect(marginL, y, contentW, 10, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('REKAP KEHADIRAN PESERTA', pageW / 2, y + 6.5, { align: 'center' })
    y += 15

    // ========== INFO PELATIHAN ==========
    const lokasi = angkatan.lokasi || 'Banda Aceh'
    const tglMulaiStr = angkatan.tanggalMulai.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const tglSelesaiStr = angkatan.tanggalSelesai.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    doc.setFontSize(9)
    doc.setTextColor(30, 41, 59)
    doc.setFont('helvetica', 'bold')
    doc.text('Nama Pelatihan', marginL, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${angkatan.pelatihan.nama}`, marginL + 35, y)
    y += 5.5

    doc.setFont('helvetica', 'bold')
    doc.text('Angkatan', marginL, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${angkatan.namaAngkatan}`, marginL + 35, y)
    y += 5.5

    doc.setFont('helvetica', 'bold')
    doc.text('Periode', marginL, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${tglMulaiStr} s.d ${tglSelesaiStr}`, marginL + 35, y)
    y += 5.5

    doc.setFont('helvetica', 'bold')
    doc.text('Lokasi', marginL, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${lokasi}`, marginL + 35, y)
    y += 5.5

    doc.setFont('helvetica', 'bold')
    doc.text('Metode', marginL, y)
    doc.setFont('helvetica', 'normal')
    const metodeLabel: Record<string, string> = { TATAP_MUKA: 'Tatap Muka', DARING: 'Daring', BLENDED: 'Blended' }
    doc.text(`: ${metodeLabel[angkatan.metode] || angkatan.metode}`, marginL + 35, y)
    y += 8

    // ========== MATRIX TABLE ==========
    // Build header: No | Nama | NIP | date headers... | Keterangan
    const dateHeaders = dates.map((d) => {
      const dt = new Date(d + 'T00:00:00')
      const dayName = dt.toLocaleDateString('id-ID', { weekday: 'short' })
      const dayNum = dt.getDate()
      return `${dayName}\n${dayNum}`
    })

    const headerRow = ['No.', 'Nama Peserta', 'NIP', ...dateHeaders, 'Keterangan']

    // Build body rows
    const bodyRows = angkatan.peserta.map((pa, i) => {
      const row: string[] = [
        String(i + 1),
        pa.peserta.nama,
        pa.peserta.nip,
      ]
      // Matrix cells
      for (const d of dates) {
        const key = `${pa.pesertaId}_${d}`
        const rec = kehadiranMap[key]
        row.push(rec ? STATUS_SHORT[rec.status] || rec.status : '-')
      }
      // Keterangan: combine all keterangan from this peserta
      const keters: string[] = []
      for (const d of dates) {
        const key = `${pa.pesertaId}_${d}`
        const rec = kehadiranMap[key]
        if (rec?.keterangan) {
          const dt = new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
          keters.push(`${dt}: ${rec.keterangan}`)
        }
      }
      row.push(keters.length > 0 ? keters.join('; ') : '')
      return row
    })

    // Column styles
    const colStyles: Record<number, object> = {
      0: { cellWidth: 8, halign: 'center', valign: 'middle', fontStyle: 'bold' },
      1: { cellWidth: 40 },
      2: { cellWidth: 32 },
    }
    // Date columns
    const dateColW = dates.length > 0 ? Math.min(16, (contentW - 8 - 40 - 32 - 40) / dates.length) : 16
    for (let i = 0; i < dates.length; i++) {
      colStyles[3 + i] = { cellWidth: dateColW, halign: 'center', valign: 'middle' }
    }
    // Keterangan column takes remaining space
    const keteranganW = contentW - 8 - 40 - 32 - (dates.length * dateColW)
    colStyles[3 + dates.length] = { cellWidth: Math.max(keteranganW, 30) }

    autoTable(doc, {
      startY: y,
      head: [headerRow],
      body: bodyRows,
      headStyles: {
        fillColor: [15, 76, 129],
        textColor: [255, 255, 255],
        fontSize: 6.5,
        fontStyle: 'bold',
        cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
        halign: 'center',
        valign: 'middle',
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: { top: 3, bottom: 3, left: 1.5, right: 1.5 },
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: colStyles,
      margin: { left: marginL, right: marginR },
      rowPageBreak: 'avoid',
      theme: 'grid',
    })

    // ========== LEGENDA ==========
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y
    let ly = finalY + 6

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text('Keterangan:', marginL, ly)
    ly += 4

    const legends = [
      { code: 'H', label: 'Hadir', color: [25, 87, 55] },
      { code: 'S', label: 'Sakit', color: [180, 83, 9] },
      { code: 'I', label: 'Izin', color: [37, 99, 235] },
      { code: 'A', label: 'Alpa', color: [220, 38, 38] },
      { code: '-', label: 'Belum diisi', color: [148, 163, 184] },
    ]

    let lx = marginL
    for (const leg of legends) {
      doc.setFillColor(...(leg.color as [number, number, number]))
      doc.roundedRect(lx, ly - 2.5, 3.5, 3.5, 0.5, 0.5, 'F')
      doc.setTextColor(30, 41, 59)
      doc.text(`${leg.code} = ${leg.label}`, lx + 5, ly)
      lx += doc.getTextWidth(`${leg.code} = ${leg.label}`) + 12
    }

    // ========== SIGNATURE BLOCK ==========
    let sy = finalY + 22
    if (sy > pageH - 50) {
      doc.addPage()
      sy = 20
    }

    const signColW = contentW / 3
    const signX1 = marginL + signColW / 2
    const signX2 = marginL + signColW + signColW / 2
    const signX3 = marginL + signColW * 2 + signColW / 2

    const now = new Date()
    const tglCetak = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    doc.setFontSize(8)
    doc.setTextColor(30, 41, 59)
    doc.setFont('helvetica', 'normal')
    doc.text(`Banda Aceh, ${tglCetak}`, signX3, sy, { align: 'right' })
    sy += 4

    doc.setFont('helvetica', 'bold')
    doc.text('Peserta', signX1, sy, { align: 'center' })
    doc.text('Widyaiswara / DTO', signX2, sy, { align: 'center' })
    doc.text('Penyelenggara', signX3, sy, { align: 'center' })
    sy += 22

    doc.setFont('helvetica', 'normal')
    doc.text('(........................................)', signX1, sy, { align: 'center' })
    doc.text('(........................................)', signX2, sy, { align: 'center' })
    doc.text('(........................................)', signX3, sy, { align: 'center' })

    // ========== PAGE FOOTER ==========
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setDrawColor(15, 76, 129)
      doc.setLineWidth(0.3)
      doc.line(marginL, pageH - 10, pageW - marginR, pageH - 10)
      doc.setFontSize(6.5)
      doc.setTextColor(148, 163, 184)
      doc.text(`SIKOMPETENSI — ${instansiSingkat}`, marginL, pageH - 6)
      doc.text(`Halaman ${i} dari ${pageCount}`, pageW - marginR, pageH - 6, { align: 'right' })
    }

    const pdfBuf = Buffer.from(doc.output('arraybuffer'))
    const safeName = angkatan.pelatihan.nama.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').slice(0, 60)
    return new NextResponse(pdfBuf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rekap-kehadiran-${safeName}.pdf"`,
      },
    })
  } catch (e) {
    console.error('daftar-hadir export pdf error:', e)
    return NextResponse.json({ error: 'Gagal export PDF' }, { status: 500 })
  }
}
