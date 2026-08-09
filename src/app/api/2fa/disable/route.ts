import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, auditLog } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const session = await requireAuth()

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Hanya SUPER_ADMIN yang dapat mengubah 2FA' }, { status: 403 })
    }

    const { currentCode } = await req.json()

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user || !user.twoFactorSecret) {
      return NextResponse.json({ error: '2FA tidak aktif' }, { status: 400 })
    }

    // Require current 2FA code to disable
    if (currentCode) {
      const { authenticator } = await import('otplib')
      const isValid = authenticator.verify({ token: currentCode, secret: user.twoFactorSecret })
      if (!isValid) {
        return NextResponse.json({ error: 'Kode tidak valid' }, { status: 400 })
      }
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    })

    await auditLog(session, '2FA_DISABLED', 'AUTH', `User ${user.username} menonaktifkan 2FA`, req)

    return NextResponse.json({ message: '2FA berhasil dinonaktifkan' })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Hanya SUPER_ADMIN yang dapat mengubah 2FA' }, { status: 403 })
    }
    console.error('2FA disable error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
