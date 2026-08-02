export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { db } = await import('@/lib/db')
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
      console.log('✅ AnalisisDiklatItem table ready')
    } catch (e) {
      console.error('❌ Failed to create AnalisisDiklatItem table:', e)
    }
  }
}
