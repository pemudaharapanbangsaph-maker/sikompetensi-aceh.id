import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const results: Record<string, any> = {}

    // Cek tiap tabel penting: ambil info kolom
    const tables = ['User', 'Peserta', 'PendaftaranPortal', 'AnalisisDiklatItem', 'Angkatan', 'Pelatihan']

    for (const table of tables) {
      try {
        const rows = await db.$queryRawUnsafe(`PRAGMA table_info("${table}")`)
        results[table] = {
          columns: (rows as any[]).map((r: any) => r.name),
          ok: true,
        }
      } catch (e: any) {
        results[table] = { error: e.message, ok: false }
      }
    }

    // Cek juga apakah ada foreign key yang merujuk ke tabel yang sudah dihapus relasinya
    try {
      const fks = await db.$queryRawUnsafe(`PRAGMA foreign_key_list("AnalisisDiklatItem")`)
      results['AnalisisDiklatItem_foreignKeys'] = fks
    } catch (e: any) {
      results['AnalisisDiklatItem_foreignKeys'] = { error: e.message }
    }

    // Cek apakah sync-pendaftar bisa jalan: coba query sederhana
    try {
      const testPendaftar = await db.pendaftaranPortal.findMany({
        where: { status: 'DITERIMA' },
        take: 1,
      })
      results['test_pendaftar_query'] = { ok: true, count: testPendaftar.length }
    } catch (e: any) {
      results['test_pendaftar_query'] = { ok: false, error: e.message }
    }

    // Cek relasi analisisDiklatItem
    try {
      const testRelation = await db.pendaftaranPortal.findMany({
        where: {
          status: 'DITERIMA',
          analisisDiklatItem: { status: 'AKTIF' },
        },
        take: 1,
        include: { analisisDiklatItem: { select: { id: true, namaPelatihan: true } } },
      })
      results['test_relation_query'] = { ok: true, count: testRelation.length }
    } catch (e: any) {
      results['test_relation_query'] = { ok: false, error: e.message }
    }

    // Cek create peserta
    try {
      const testCreate = await db.peserta.create({
        data: {
          nip: '__TEST_NIP_CHECK__',
          nama: '__TEST__',
          jenisKelamin: 'L',
        },
      })
      await db.peserta.delete({ where: { id: testCreate.id } })
      results['test_peserta_create'] = { ok: true }
    } catch (e: any) {
      results['test_peserta_create'] = { ok: false, error: e.message }
    }

    return NextResponse.json({ timestamp: new Date().toISOString(), results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}
