import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, auditLog } from '@/lib/auth'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'

export async function POST(req: Request) {
  try {
    const session = await requireAuth()

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Hanya SUPER_ADMIN yang dapat mengaktifkan 2FA' }, { status: 403 })
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    const secret = authenticator.generateSecret()

    await db.user.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: secret },
    })

    const totpUri = authenticator.keyuri(user.email, 'SIKOMTEK BPSDM Aceh', secret)

    const qrDataUrl = await QRCode.toDataURL(totpUri, {
      width: 280,
      margin: 2,
      color: { dark: '#195737', light: '#FFFFFF' },
    })

    await auditLog(session, '2FA_SETUP_INIT', 'AUTH', `User ${user.username} memulai setup 2FA`, req)

    return NextResponse.json({
      secret,
      qrCode: qrDataUrl,
      email: user.email,
    })
  } catch (e: any) {
    if (e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (e.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Hanya SUPER_ADMIN yang dapat mengaktifkan 2FA' }, { status: 403 })
    }
    console.error('2FA setup error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
