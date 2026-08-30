import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

// PUT: batch upsert kehadiran — save entire matrix at once
export async function PUT(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { angkatanId, items } = body
    if (!angkatanId || !Array.isArray(items)) {
      return NextResponse.json({ error: 'angkatanId dan items wajib' }, { status: 400 })
    }

    // items: [{ pesertaId, tanggal, statusKehadiran, keterangan? }]
    const results = []
    for (const item of items) {
      if (!item.pesertaId || !item.tanggal) continue
      const tanggalDate = new Date(item.tanggal)
      const upserted = await db.kehadiran.upsert({
        where: {
          angkatanId_pesertaId_tanggal: {
            angkatanId,
            pesertaId: item.pesertaId,
            tanggal: tanggalDate,
          },
        },
        update: {
          statusKehadiran: item.statusKehadiran || 'HADIR',
          keterangan: item.keterangan || null,
        },
        create: {
          angkatanId,
          pesertaId: item.pesertaId,
          tanggal: tanggalDate,
          statusKehadiran: item.statusKehadiran || 'HADIR',
          keterangan: item.keterangan || null,
        },
      })
      results.push(upserted.id)
    }

    await auditLog(session, 'UPDATE', 'KEHADIRAN', `Batch update kehadiran angkatan ${angkatanId} (${results.length} records)`, req)
    return NextResponse.json({ success: true, count: results.length })
  } catch (e) {
    console.error('kehadiran batch error:', e)
    return NextResponse.json({ error: 'Gagal menyimpan kehadiran' }, { status: 500 })
  }
}
