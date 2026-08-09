import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await requireAuth()

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({
      enabled: user.twoFactorEnabled,
    })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('2FA status error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
