import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  try {
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

    return NextResponse.json({ success: true, message: 'Tabel AnalisisDiklatItem berhasil dibuat' })
  } catch (e) {
    console.error('setup analisis-diklat error:', e)
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 })
  }
}
