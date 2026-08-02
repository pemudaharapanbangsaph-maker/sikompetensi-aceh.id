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

    rekapRows.push({
      'Skema Sertifikasi': 'TOTAL',
      'Jumlah Uji': ujiList.length,
      'Selesai': selesai.length,
      'Berlangsung': berlangsung.length,
      'Dijadwalkan': dijadwalkan.length,
      'Total Peserta Uji': totalPeserta,
    })

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

    const ringkasanRows = [
      { Keterangan: 'Total Skema Sertifikasi', Jumlah: skemaMap.size },
      { Keterangan: 'Total Uji Kompetensi', Jumlah: ujiList.length },
      { Keterangan: 'Uji Selesai', Jumlah: selesai.length },
      { Keterangan: 'Uji Berlangsung', Jumlah: berlangsung.length },
      { Keterangan: 'Uji Dijadwalkan', Jumlah: dijadwalkan.length },
      { Keterangan: 'Uji Dibatalkan', Jumlah: dibatalkan.length },
      { Keterangan: 'Total Peserta Uji', Jumlah: totalPeserta },
    ]

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
