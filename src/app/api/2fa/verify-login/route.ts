import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, auditLog, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth'
import { validate2FAPendingToken, consume2FAPending } from '@/lib/two-factor'
import { authenticator } from 'otplib'

export async function POST(req: Request) {
  try {
    const { tempToken, code, remember } = await req.json()

    if (!tempToken || !code) {
      return NextResponse.json({ error: 'Token dan kode wajib diisi' }, { status: 400 })
    }

    if (code.length !== 6) {
      return NextResponse.json({ error: 'Kode harus 6 digit' }, { status: 400 })
    }

    // Find user by temp token
    const userId = validate2FAPendingToken(tempToken)
    if (!userId) {
      return NextResponse.json({ error: 'Sesi login tidak ditemukan atau sudah kadaluarsa. Silakan login kembali.' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      consume2FAPending(userId)
      return NextResponse.json({ error: '2FA tidak aktif untuk user ini' }, { status: 400 })
    }

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret })
    if (!isValid) {
      return NextResponse.json({ error: 'Kode tidak valid. Coba lagi.' }, { status: 400 })
    }

    // Clean up pending entry
    consume2FAPending(userId)

    // Create session
    const token = await createSession(user.id)
    const maxAge = remember ? SESSION_MAX_AGE * 24 * 7 : SESSION_MAX_AGE

    await auditLog({ user: { id: user.id, username: user.username, nama: user.nama, email: user.email, role: user.role as any, status: user.status } } as any, 'LOGIN_2FA', 'AUTH', `User ${user.username} berhasil login dengan 2FA`, req)

    const res = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        nama: user.nama,
        email: user.email,
        role: user.role,
        status: user.status,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
      token,
    })

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    })

    return res
  } catch (e) {
    console.error('2FA verify login error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
