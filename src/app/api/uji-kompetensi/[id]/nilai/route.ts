import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

// POST: set/update nilai for a peserta in a uji kompetensi
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'uji_kompetensi:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const {
      pesertaId,
      nilaiPreTest,
      nilaiPostTest,
      nilaiPraktik,
      nilaiTeori,
      nilaiAkhir,
      statusKelulusan,
      catatan,
    } = body

    if (!pesertaId) {
      return NextResponse.json({ error: 'pesertaId wajib diisi' }, { status: 400 })
    }

    // Compute nilaiAkhir if not provided — average of available values
    let computedAkhir = nilaiAkhir
    if (computedAkhir === undefined || computedAkhir === null) {
      const vals: number[] = []
      if (nilaiPreTest != null && nilaiPreTest !== '') vals.push(Number(nilaiPreTest))
      if (nilaiPostTest != null && nilaiPostTest !== '') vals.push(Number(nilaiPostTest))
      if (nilaiPraktik != null && nilaiPraktik !== '') vals.push(Number(nilaiPraktik))
      if (nilaiTeori != null && nilaiTeori !== '') vals.push(Number(nilaiTeori))
      if (vals.length > 0) {
        computedAkhir = vals.reduce((a, b) => a + b, 0) / vals.length
      }
    }

    // Compute statusKelulusan if not provided
    let computedStatus = statusKelulusan
    if (!computedStatus && computedAkhir != null) {
      computedStatus = Number(computedAkhir) >= 70 ? 'LULUS' : 'TIDAK_LULUS'
    }

    const data: Record<string, unknown> = {
      ujiKompetensiId: id,
      pesertaId,
      nilaiPreTest: nilaiPreTest != null && nilaiPreTest !== '' ? Number(nilaiPreTest) : null,
      nilaiPostTest: nilaiPostTest != null && nilaiPostTest !== '' ? Number(nilaiPostTest) : null,
      nilaiPraktik: nilaiPraktik != null && nilaiPraktik !== '' ? Number(nilaiPraktik) : null,
      nilaiTeori: nilaiTeori != null && nilaiTeori !== '' ? Number(nilaiTeori) : null,
      nilaiAkhir: computedAkhir != null ? Number(computedAkhir) : null,
      statusKelulusan: computedStatus || 'BELUM',
      catatan: catatan || null,
    }

    // Find existing
    const existing = await db.nilai.findFirst({
      where: { ujiKompetensiId: id, pesertaId },
    })

    let item
    if (existing) {
      item = await db.nilai.update({ where: { id: existing.id }, data: data as any, include: { peserta: true } })
    } else {
      item = await db.nilai.create({ data: data as any, include: { peserta: true } })
    }

    await auditLog(session, 'UPDATE', 'NILAI', `Set nilai peserta ${pesertaId} pada uji ${id}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('uji-kompetensi set nilai error:', e)
    return NextResponse.json({ error: 'Gagal menyimpan nilai' }, { status: 500 })
  }
}
