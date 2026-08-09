import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, verifyPassword, hashPassword, auditLog } from '@/lib/auth'

// PUT: ganti password user yang login
export async function PUT(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Password lama dan baru wajib diisi' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password baru minimal 6 karakter' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

    const valid = await verifyPassword(currentPassword, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Password lama salah' }, { status: 400 })
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { password: await hashPassword(newPassword) },
    })

    await auditLog(session, 'UPDATE', 'AUTH', `Mengubah password user: ${user.username}`)

    return NextResponse.json({ message: 'Password berhasil diubah' })
  } catch (e) {
    console.error('password change error:', e)
    return NextResponse.json({ error: 'Gagal mengubah password' }, { status: 500 })
  }
}
