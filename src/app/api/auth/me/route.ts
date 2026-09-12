import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

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
      select: {
        id: true,
        username: true,
        nama: true,
        email: true,
        role: true,
        status: true,
        noTelp: true,
        tempatLahir: true,
        tanggalLahir: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
