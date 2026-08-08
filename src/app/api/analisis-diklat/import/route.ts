import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

const METODE_MAP: Record<string, string> = {
  'tatap muka': 'TATAP_MUKA',
  'daring': 'DARING',
  'blended': 'BLENDED',
}

const PRIORITAS_MAP: Record<string, string> = {
  'tinggi': 'TINGGI',
  'sedang': 'SEDANG',
  'rendah': 'RENDAH',
}

const KATEGORI_MAP: Record<string, string> = {
  'teknis': 'TEKNIS',
  'manajerial': 'MANAJERIAL',
  'fungsional': 'FUNGSIONAL',
  'sosial kultural': 'SOSIAL_KULTURAL',
}

const STATUS_MAP: Record<string, string> = {
  'aktif': 'AKTIF',
  'tampilkan di portal': 'AKTIF',
  'nonaktif': 'NONAKTIF',
  'sembunyikan': 'NONAKTIF',
}

const REQUIRED_COLUMNS = ['Outcome', 'Nama Pelatihan']

// --- Helper: generate kode pelatihan otomatis dari counter ---
async function generateKodePelatihan(): Promise<string> {
  const all = await db.pelatihan.findMany({
    select: { kode: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  let maxNum = 0
  for (const p of all) {
    const m = p.kode.match(/PL-(\d+)/)
    if (m) maxNum = Math.max(maxNum, Number(m[1]))
  }
  return `PL-${String(maxNum + 1).padStart(3, '0')}`
}

// --- Helper: sinkronisasi satu item AnalisisDiklat → Pelatihan + Angkatan default ---
async function syncOneToPelatihan(analisisId: string, data: {
  namaPelatihan: string
  kategori: string
  metodePembelajaran: string
  durasiJP: number
  durasiHari: number
  tahunPelaksanaan: number
  prioritas: string
  targetOutput: string
  status: string
  outcome: string
}, userId?: string) {
  if (data.status !== 'AKTIF') return

  const durasiHari = data.durasiHari > 0 ? data.durasiHari : Math.max(1, Math.ceil(data.durasiJP / 8))
  const deskripsi = [
    data.outcome ? `Outcome: ${data.outcome}` : '',
    `Metode: ${data.metodePembelajaran === 'TATAP_MUKA' ? 'Tatap Muka' : data.metodePembelajaran === 'DARING' ? 'Daring' : 'Blended'}`,
    `Prioritas: ${data.prioritas}`,
    data.targetOutput ? `Target: ${data.targetOutput}` : '',
    `Tahun: ${data.tahunPelaksanaan}`,
  ].filter(Boolean).join(' | ')

  const kode = await generateKodePelatihan()
  const newPelatihan = await db.pelatihan.create({
    data: {
      kode,
      nama: data.namaPelatihan,
      kategori: data.kategori,
      deskripsi,
      jp: data.durasiJP || 8,
      durasiHari,
      status: 'AKTIF',
      createdBy: userId,
    },
  })
  // Simpan ID Pelatihan ke AnalisisDiklatItem
  await db.analisisDiklatItem.update({
    where: { id: analisisId },
    data: { pelatihanId: newPelatihan.id },
  })

  // Otomatis buat Angkatan default
  const tahun = data.tahunPelaksanaan || new Date().getFullYear()
  await db.angkatan.create({
    data: {
      pelatihanId: newPelatihan.id,
      namaAngkatan: `Angkatan 1 - ${data.namaPelatihan}`,
      tanggalMulai: new Date(tahun, 0, 1),
      tanggalSelesai: new Date(tahun, 11, 31),
      metode: data.metodePembelajaran || 'TATAP_MUKA',
      kuota: 30,
      status: 'PERENCANAAN',
      createdBy: userId,
    },
  })
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'analisis:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File kosong atau tidak valid' }, { status: 400 })
    }

    const headers = Object.keys(rows[0])
    for (const col of REQUIRED_COLUMNS) {
      if (!headers.some((h) => h.toLowerCase().trim() === col.toLowerCase())) {
        return NextResponse.json({ error: `Kolom wajib "${col}" tidak ditemukan` }, { status: 400 })
      }
    }

    const findCol = (names: string[]) => headers.find((h) => names.some((n) => h.toLowerCase().trim() === n.toLowerCase()))

    const items = rows.map((row) => {
      const metodeRaw = String(row[findCol(['Metode Pembelajaran'])] || 'Tatap Muka')
      const prioritasRaw = String(row[findCol(['Prioritas'])] || 'Sedang')
      const tahunRaw = row[findCol(['Tahun Pelaksanaan'])]
      const kategoriRaw = String(row[findCol(['Kategori'])] || 'Teknis')
      const statusRaw = String(row[findCol(['Status Publikasi'])] || 'Aktif')
      const durasiJPRaw = Number(row[findCol(['Durasi (JP)', 'Jumlah Hari', 'Durasi JP', 'Jumlah Hari (JP)'])] || 0)
      const durasiHariRaw = Number(row[findCol(['Durasi Hari', 'Lama Hari', 'Durasi (Hari)'])] || 0)

      return {
        outcome: String(row[findCol(['Outcome'])] || ''),
        programPrioritasRPJMA: String(row[findCol(['Program Prioritas RPJMA'])] || ''),
        sasaranRPJMA: String(row[findCol(['Sasaran RPJMA'])] || ''),
        skpaSasaran: String(row[findCol(['SKPA Sasaran'])] || ''),
        namaPelatihan: String(row[findCol(['Nama Pelatihan'])] || ''),
        kategori: KATEGORI_MAP[kategoriRaw.toLowerCase()] || 'TEKNIS',
        metodePembelajaran: METODE_MAP[metodeRaw.toLowerCase()] || 'TATAP_MUKA',
        durasiJP: durasiJPRaw,
        durasiHari: durasiHariRaw,
        targetOutput: String(row[findCol(['Target Output'])] || ''),
        prioritas: PRIORITAS_MAP[prioritasRaw.toLowerCase()] || 'SEDANG',
        tahunPelaksanaan: tahunRaw ? Number(tahunRaw) : new Date().getFullYear(),
        status: STATUS_MAP[statusRaw.toLowerCase()] || 'AKTIF',
        dibuatOleh: session.user.id,
      }
    })

    const result = await db.analisisDiklatItem.createMany({ data: items })

    // Sinkronisasi ke Pelatihan + Angkatan untuk setiap item yang baru dibuat
    const createdItems = await db.analisisDiklatItem.findMany({
      where: {
        namaPelatihan: { in: items.map(i => i.namaPelatihan) },
      },
      orderBy: { createdAt: 'desc' },
      take: items.length,
    })

    for (const createdItem of createdItems) {
      const matchItem = items.find(i =>
        i.namaPelatihan === createdItem.namaPelatihan &&
        i.tahunPelaksanaan === createdItem.tahunPelaksanaan
      )
      if (matchItem) {
        await syncOneToPelatihan(createdItem.id, {
          namaPelatihan: createdItem.namaPelatihan,
          kategori: createdItem.kategori,
          metodePembelajaran: createdItem.metodePembelajaran,
          durasiJP: createdItem.durasiJP,
          durasiHari: createdItem.durasiHari,
          tahunPelaksanaan: createdItem.tahunPelaksanaan,
          prioritas: createdItem.prioritas,
          targetOutput: createdItem.targetOutput,
          status: createdItem.status,
          outcome: createdItem.outcome,
        }, session.user.id)
      }
    }

    await auditLog(session, 'IMPORT', 'ANALISIS_DIKLAT', `Import ${result.count} item analisis diklat dari XLS`, req)

    return NextResponse.json({ success: true, imported: result.count })
  } catch (e) {
    console.error('analisis-diklat import error:', e)
    return NextResponse.json({ error: 'Gagal mengimpor data' }, { status: 500 })
  }
}
