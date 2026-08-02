import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Buat tabel kalau belum ada
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AnalisisDiklatItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "outcome" TEXT NOT NULL DEFAULT '',
        "programPrioritasRPJMA" TEXT NOT NULL DEFAULT '',
        "sasaranRPJMA" TEXT NOT NULL DEFAULT '',
        "skpaSasaran" TEXT NOT NULL DEFAULT '',
        "namaPelatihan" TEXT NOT NULL DEFAULT '',
        "metodePembelajaran" TEXT NOT NULL DEFAULT 'TATAP_MUKA',
        "durasiJP" INTEGER NOT NULL DEFAULT 0,
        "targetOutput" TEXT NOT NULL DEFAULT '',
        "prioritas" TEXT NOT NULL DEFAULT 'SEDANG',
        "tahunPelaksanaan" INTEGER NOT NULL DEFAULT 2025,
        "dibuatOleh" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    return NextResponse.json({ success: true, message: 'Tabel AnalisisDiklatItem berhasil dibuat/diperbarui' })
  } catch (e) {
    console.error('setup analisis-diklat error:', e)
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 })
  }
}
