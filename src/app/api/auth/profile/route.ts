import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog } from '@/lib/auth'

// GET: ambil profil lengkap user yang login
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true, username: true, nama: true, email: true, role: true, status: true,
        noTelp: true, tempatLahir: true, tanggalLahir: true, fotoUrl: true,
        lastLogin: true, createdAt: true,
      },
    })

    if (!user) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })

    return NextResponse.json({ user })
  } catch (e) {
    console.error('profile get error:', e)
    return NextResponse.json({ error: 'Gagal memuat profil' }, { status: 500 })
  }
}

// PUT: update profil user yang login
export async function PUT(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { nama, email, noTelp, tempatLahir, tanggalLahir } = body

    if (!nama || nama.trim().length < 2) {
      return NextResponse.json({ error: 'Nama minimal 2 karakter' }, { status: 400 })
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email tidak valid' }, { status: 400 })
    }

    // Cek email unik (kecuali diri sendiri)
    const existing = await db.user.findFirst({ where: { email, id: { not: session.user.id } } })
    if (existing) {
      return NextResponse.json({ error: 'Email sudah digunakan user lain' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { nama: nama.trim(), email: email.trim() }
    if (noTelp !== undefined) updateData.noTelp = noTelp || null
    if (tempatLahir !== undefined) updateData.tempatLahir = tempatLahir || null
    if (tanggalLahir !== undefined) updateData.tanggalLahir = tanggalLahir ? new Date(tanggalLahir) : null

    const updated = await db.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true, username: true, nama: true, email: true, role: true, status: true,
        noTelp: true, tempatLahir: true, tanggalLahir: true, fotoUrl: true,
        lastLogin: true, createdAt: true,
      },
    })

    await auditLog(session, 'UPDATE', 'AUTH', `Memperbarui profil: ${updated.nama}`)

    return NextResponse.json({ user: updated })
  } catch (e) {
    console.error('profile update error:', e)
    return NextResponse.json({ error: 'Gagal memperbarui profil' }, { status: 500 })
  }
}
