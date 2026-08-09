import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, auditLog } from '@/lib/auth'
import { authenticator } from 'otplib'

export async function POST(req: Request) {
  try {
    const session = await requireAuth()

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Hanya SUPER_ADMIN yang dapat mengaktifkan 2FA' }, { status: 403 })
    }

    const { code } = await req.json()
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Kode 6 digit wajib diisi' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user || !user.twoFactorSecret) {
      return NextResponse.json({ error: 'Secret 2FA belum dibuat. Silakan mulai setup terlebih dahulu.' }, { status: 400 })
    }

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret })
    if (!isValid) {
      return NextResponse.json({ error: 'Kode tidak valid. Pastikan waktu di HP sudah tepat.' }, { status: 400 })
    }

    // Enable 2FA
    await db.user.update({
      where: { id: session.user.id },
      data: { twoFactorEnabled: true },
    })

    await auditLog(session, '2FA_ENABLED', 'AUTH', `User ${user.username} berhasil mengaktifkan 2FA`, req)

    return NextResponse.json({ message: '2FA berhasil diaktifkan' })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Hanya SUPER_ADMIN yang dapat mengaktifkan 2FA' }, { status: 403 })
    }
    console.error('2FA verify setup error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
