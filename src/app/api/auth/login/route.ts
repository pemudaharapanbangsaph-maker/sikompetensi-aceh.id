import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, auditLog, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth'
import { cookies } from 'next/headers'

const MAX_ATTEMPTS = 5
const LOCK_DURATION = 15 * 60 * 1000

export async function POST(req: Request) {
  try {
    const { username, password, remember } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { username } })
    if (!user) {
      await auditLog(null, 'LOGIN_GAGAL', 'AUTH', `Percobaan login dengan username: ${username}`, req)
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    if (user.status !== 'AKTIF') {
      return NextResponse.json({ error: 'Akun Anda dinonaktifkan. Hubungi administrator.' }, { status: 403 })
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const minsLeft = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000)
      return NextResponse.json({ error: `Akun terkunci. Coba lagi dalam ${minsLeft} menit.` }, { status: 403 })
    }

    const valid = await verifyPassword(password, user.password)
    if (!valid) {
      const attempts = user.loginAttempts + 1
      const lockUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION) : null
      await db.user.update({
        where: { id: user.id },
        data: { loginAttempts: attempts, lockedUntil: lockUntil },
      })
      await auditLog(null, 'LOGIN_GAGAL', 'AUTH', `Login gagal untuk username: ${username} (percobaan ${attempts})`, req)
      if (lockUntil) {
        return NextResponse.json({ error: 'Akun terkunci setelah 5 percobaan gagal. Coba lagi dalam 15 menit.' }, { status: 403 })
      }
      return NextResponse.json({ error: `Username atau password salah. Percobaan ${attempts}/${MAX_ATTEMPTS}` }, { status: 401 })
    }

    const token = await createSession(user.id)

    const cookieStore = await cookies()
    const maxAge = remember ? SESSION_MAX_AGE * 24 * 7 : SESSION_MAX_AGE
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    })

    await auditLog({ user: { id: user.id, username: user.username, nama: user.nama, email: user.email, role: user.role as any, status: user.status } } as any, 'LOGIN', 'AUTH', `User ${user.username} berhasil login`, req)

    return NextResponse.json({
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
    })
  } catch (e) {
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
