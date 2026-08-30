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

    // Parse optional days filter (comma-separated JS day numbers, e.g. "4" = Kamis)
    const daysParam = searchParams.get('days')
    const allowedDays: Set<number> | null = daysParam
      ? new Set(daysParam.split(',').map(Number))
      : null

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

    const kehadiranRecords = await db.kehadiran.findMany({
      where: { angkatanId },
      orderBy: [{ tanggal: 'asc' }, { pesertaId: 'asc' }],
    })

    const kehadiranMap: Record<string, { status: string; keterangan: string | null }> = {}
    for (const rec of kehadiranRecords) {
      const key = `${rec.pesertaId}_${rec.tanggal.toISOString().slice(0, 10)}`
      kehadiranMap[key] = { status: rec.statusKehadiran, keterangan: rec.keterangan }
    }

    // Generate all dates, then filter by day if specified
    let dates = generateDates(angkatan.tanggalMulai, angkatan.tanggalSelesai)
    if (allowedDays && allowedDays.size > 0) {
      dates = dates.filter((d) => {
        const dt = new Date(d + 'T00:00:00')
        return allowedDays.has(dt.getDay())
      })
    }

    const settingsRows = await db.pengaturan.findMany()
    const settings: Record<string, string> = {}
    for (const r of settingsRows) settings[r.key] = r.value

    const instansiNama = settings.instansi_nama || 'Badan Pengembangan Sumber Daya Manusia Aceh'
    const instansiSingkat = settings.instansi_singkat || 'BPSDM Aceh'
    const instansiAlamat = settings.instansi_alamat || 'Jl. T.Panglima Nyak Makam No 8 Lampineng, Kota Banda Aceh, 24415'

    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    // ===== F4 PORTRAIT =====
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [215.9, 330.2],
    })
    const pageW = 215.9
    const pageH = 330.2
    const marginL = 10
    const marginR = 10
    const contentW = pageW - marginL - marginR

    // ========== KOP SURAT ==========
    doc.setFillColor(15, 76, 129)
    doc.rect(0, 0, pageW, 6, 'F')

    let y = 9

    const logoPath = path.join(process.cwd(), 'public', 'logo-pancacita.png')
    let logoAdded = false
    try {
      const logoBuf = await readFile(logoPath)
      const logoBase64 = 'data:image/png;base64,' + logoBuf.toString('base64')
      doc.addImage(logoBase64, 'PNG', marginL, y, 14, 14)
      logoAdded = true
    } catch { /* fallback */ }
    if (!logoAdded) {
      doc.setFillColor(15, 76, 129)
      doc.circle(marginL + 7, y + 7, 7, 'F')
      doc.setFontSize(6)
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.text('BPSDM', marginL + 7, y + 6, { align: 'center' })
      doc.setFontSize(4.5)
      doc.text('ACEH', marginL + 7, y + 9, { align: 'center' })
    }

    doc.setTextColor(15, 76, 129)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('PEMERINTAH ACEH', pageW / 2, y + 2, { align: 'center' })
    doc.setFontSize(9)
    doc.text(instansiNama.toUpperCase(), pageW / 2, y + 7, { align: 'center' })
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.text('BIDANG PENGEMBANGAN DAN SERTIFIKASI KOMPETENSI TEKNIS INTI', pageW / 2, y + 11, { align: 'center' })
    doc.setFontSize(6)
    doc.text(instansiAlamat, pageW / 2, y + 14.5, { align: 'center' })

    y += 19
    doc.setDrawColor(15, 76, 129)
    doc.setLineWidth(0.6)
    doc.line(marginL, y, pageW - marginR, y)
    doc.setLineWidth(0.2)
    doc.line(marginL, y + 0.8, pageW - marginR, y + 0.8)

    y += 6

    // ========== TITLE ==========
    doc.setFillColor(15, 76, 129)
    doc.roundedRect(marginL, y, contentW, 8, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('REKAP KEHADIRAN PESERTA', pageW / 2, y + 5.5, { align: 'center' })
    y += 12

    // ========== INFO PELATIHAN ==========
    const lokasi = angkatan.lokasi || 'Banda Aceh'
    const tglMulaiStr = angkatan.tanggalMulai.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const tglSelesaiStr = angkatan.tanggalSelesai.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    doc.setFontSize(8)
    doc.setTextColor(30, 41, 59)
    doc.setFont('helvetica', 'bold')
    doc.text('Nama Pelatihan', marginL, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${angkatan.pelatihan.nama}`, marginL + 28, y)
    y += 4.5

    doc.setFont('helvetica', 'bold')
    doc.text('Angkatan', marginL, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${angkatan.namaAngkatan}`, marginL + 28, y)
    y += 4.5

    doc.setFont('helvetica', 'bold')
    doc.text('Periode', marginL, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${tglMulaiStr} s.d ${tglSelesaiStr}`, marginL + 28, y)
    y += 4.5

    doc.setFont('helvetica', 'bold')
    doc.text('Lokasi', marginL, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`: ${lokasi}`, marginL + 28, y)
    y += 4.5

    doc.setFont('helvetica', 'bold')
    doc.text('Metode', marginL, y)
    doc.setFont('helvetica', 'normal')
    const metodeLabel: Record<string, string> = { TATAP_MUKA: 'Tatap Muka', DARING: 'Daring', BLENDED: 'Blended' }
    doc.text(`: ${metodeLabel[angkatan.metode] || angkatan.metode}`, marginL + 28, y)
    y += 6

    // ========== MATRIX TABLE ==========
    const dateHeaders = dates.map((d) => {
      const dt = new Date(d + 'T00:00:00')
      const dayName = dt.toLocaleDateString('id-ID', { weekday: 'short' })
      const dayNum = dt.getDate()
      return `${dayName}\n${dayNum}`
    })

    const headerRow = ['No.', 'Nama Peserta', 'NIP', 'Instansi', ...dateHeaders, 'Keterangan']

    const bodyRows = angkatan.peserta.map((pa, i) => {
      const row: string[] = [
        String(i + 1),
        pa.peserta.nama,
        pa.peserta.nip,
        pa.peserta.instansi || pa.peserta.unitKerja || '-',
      ]
      for (const d of dates) {
        const key = `${pa.pesertaId}_${d}`
        const rec = kehadiranMap[key]
        row.push(rec ? STATUS_SHORT[rec.status] || rec.status : '-')
      }
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

    const colStyles: Record<number, object> = {
      0: { cellWidth: 7, halign: 'center', valign: 'middle', fontStyle: 'bold' },
      1: { cellWidth: 32 },
      2: { cellWidth: 24 },
      3: { cellWidth: 28 },
    }
    const fixedW = 7 + 32 + 24 + 28 + 22
    const availForDates = contentW - fixedW
    const dateColW = dates.length > 0 ? Math.min(14, availForDates / dates.length) : 14
    for (let i = 0; i < dates.length; i++) {
      colStyles[4 + i] = { cellWidth: dateColW, halign: 'center', valign: 'middle' }
    }
    const keteranganW = contentW - 7 - 32 - 24 - 28 - (dates.length * dateColW)
    colStyles[4 + dates.length] = { cellWidth: Math.max(keteranganW, 22) }

    autoTable(doc, {
      startY: y,
      head: [headerRow],
      body: bodyRows,
      headStyles: {
        fillColor: [15, 76, 129],
        textColor: [255, 255, 255],
        fontSize: 5.5,
        fontStyle: 'bold',
        cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
        halign: 'center',
        valign: 'middle',
      },
      bodyStyles: {
        fontSize: 6,
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        valign: 'middle',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: colStyles,
      margin: { left: marginL, right: marginR },
      rowPageBreak: 'avoid',
      theme: 'grid',
    })

    // ========== LEGENDA ==========
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y
    let ly = finalY + 5
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text('Keterangan: H = Hadir, S = Sakit, I = Izin, A = Alpa, - = Belum diisi', marginL, ly)

    // ========== SIGNATURE — HANYA PENYELENGGARA ==========
    let sy = finalY + 16
    if (sy > pageH - 40) { doc.addPage(); sy = 20 }

    const now = new Date()
    const tglCetak = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    doc.setFontSize(8)
    doc.setTextColor(30, 41, 59)
    doc.setFont('helvetica', 'normal')
    doc.text(`Banda Aceh, ${tglCetak}`, pageW - marginR, sy, { align: 'right' })
    sy += 4
    doc.setFont('helvetica', 'bold')
    doc.text('Penyelenggara,', pageW - marginR, sy, { align: 'right' })
    sy += 22
    doc.setFont('helvetica', 'normal')
    doc.text('(........................................)', pageW - marginR, sy, { align: 'right' })

    // ========== PAGE FOOTER ==========
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setDrawColor(15, 76, 129)
      doc.setLineWidth(0.2)
      doc.line(marginL, pageH - 8, pageW - marginR, pageH - 8)
      doc.setFontSize(6)
      doc.setTextColor(148, 163, 184)
      doc.text(`SIKOMPETENSI — ${instansiSingkat}`, marginL, pageH - 5)
      doc.text(`Halaman ${i} dari ${pageCount}`, pageW - marginR, pageH - 5, { align: 'right' })
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
