import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hashPassword, hasPermission } from '@/lib/auth'

const USER_SELECT = {
  id: true, username: true, nama: true, email: true, role: true,
  status: true, noTelp: true, lastLogin: true, createdAt: true,
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'users:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const user = await db.user.findUnique({ where: { id }, select: USER_SELECT })
    if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    return NextResponse.json(user)
  } catch (e) {
    console.error('users get error:', e)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'users:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const { password, ...rest } = body

    const data: Record<string, unknown> = { ...rest }

    // If password provided and non-empty, hash & update; otherwise omit
    if (password && password.trim() !== '') {
      data.password = await hashPassword(password)
    }

    const user = await db.user.update({
      where: { id },
      data: data as any,
      select: USER_SELECT,
    })
    await auditLog(session, 'UPDATE', 'USER', `Ubah user: ${user.username}`, req)
    return NextResponse.json(user)
  } catch (e) {
    console.error('users update error:', e)
    return NextResponse.json({ error: 'Gagal mengubah user' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'users:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params

    // Prevent self-delete
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun sendiri' }, { status: 400 })
    }

    // Prevent deleting last SUPER_ADMIN
    const target = await db.user.findUnique({ where: { id } })
    if (!target) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    if (target.role === 'SUPER_ADMIN') {
      const superAdminCount = await db.user.count({ where: { role: 'SUPER_ADMIN' } })
      if (superAdminCount <= 1) {
        return NextResponse.json({ error: 'Tidak dapat menghapus SUPER_ADMIN terakhir' }, { status: 400 })
      }
    }

    await db.user.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'USER', `Hapus user: ${target.username}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('users delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus user' }, { status: 500 })
  }
}
