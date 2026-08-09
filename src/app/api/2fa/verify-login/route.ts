import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, auditLog, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth'
import { authenticator } from 'otplib'
import crypto from 'crypto'

// In-memory store for pending 2FA verifications (userId -> { tempToken, expires })
const pending2FA = new Map<string, { tempToken: string; expires: number }>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of pending2FA.entries()) {
    if (val.expires < now) pending2FA.delete(key)
  }
}, 5 * 60 * 1000)

export function generate2FAPendingToken(userId: string): string {
  const tempToken = crypto.randomBytes(32).toString('hex')
  pending2FA.set(userId, { tempToken, expires: Date.now() + 3 * 60 * 1000 }) // 3 minutes
  return tempToken
}

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
    let userId: string | null = null
    for (const [uid, data] of pending2FA.entries()) {
      if (data.tempToken === tempToken) {
        if (data.expires < Date.now()) {
          pending2FA.delete(uid)
          return NextResponse.json({ error: 'Kode sudah kadaluarsa. Silakan login kembali.' }, { status: 400 })
        }
        userId = uid
        break
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Sesi login tidak ditemukan. Silakan login kembali.' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      pending2FA.delete(userId)
      return NextResponse.json({ error: '2FA tidak aktif untuk user ini' }, { status: 400 })
    }

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret })
    if (!isValid) {
      return NextResponse.json({ error: 'Kode tidak valid. Coba lagi.' }, { status: 400 })
    }

    // Clean up pending entry
    pending2FA.delete(userId)

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
