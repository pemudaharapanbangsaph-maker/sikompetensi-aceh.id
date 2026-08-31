import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: string[] = []

  try {
    // Gunakan prisma db push untuk membuat semua tabel berdasarkan schema
    // --accept-data-loss karena ini setup awal
    try {
      execSync('./node_modules/.bin/prisma db push --accept-data-loss 2>&1', {
        stdio: 'pipe',
        timeout: 60000,
      })
      results.push('Semua tabel berhasil dibuat/sinkronisasi via prisma db push')
    } catch (e: any) {
      const output = e.stdout?.toString() || e.message || ''
      // prisma db push exit code 0 tapi bisa ada warning
      if (output.includes('Your database is now in sync')) {
        results.push('Database sudah sinkron dengan schema Prisma')
      } else {
        results.push('prisma db push output: ' + output)
      }
    }

    // Regenerate Prisma Client untuk memastikan types up to date
    try {
      execSync('./node_modules/.bin/prisma generate 2>&1', {
        stdio: 'pipe',
        timeout: 30000,
      })
      results.push('Prisma Client berhasil di-generate')
    } catch (e: any) {
      results.push('prisma generate warning: ' + (e.stdout?.toString() || e.message || ''))
    }

    return NextResponse.json({
      status: 'ok',
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('DB setup error:', message)
    return NextResponse.json({ status: 'error', message, results }, { status: 500 })
  }
}
