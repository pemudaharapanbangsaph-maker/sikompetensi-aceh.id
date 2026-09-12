import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

const USER_SELECT = {
  id: true,
  username: true,
  nama: true,
  email: true,
  role: true,
  status: true,
  noTelp: true,
  tempatLahir: true,
  tanggalLahir: true,
  lastLogin: true,
  createdAt: true,
}

export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await db.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: USER_SELECT,
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (e) {
    console.error('auth me error:', e)

    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
