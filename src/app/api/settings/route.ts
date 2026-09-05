import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: mengambil semua pengaturan kecuali data logo
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    if (!hasPermission(session.user.role, 'settings:view')) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 },
      )
    }

    const rows = await db.pengaturan.findMany({
      where: {
        key: {
          notIn: [
            'logo',
            'logo_base64',
            'logo_data',
            'logo_content_type',
          ],
        },
      },
      select: {
        key: true,
        value: true,
      },
    })

    const result: Record<string, string> = {}

    for (const row of rows) {
      result[row.key] = row.value
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('settings get error:', error)

    return NextResponse.json(
      { error: 'Gagal memuat pengaturan' },
      { status: 500 },
    )
  }
}

// PUT: menyimpan pengaturan biasa
export async function PUT(req: Request) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    if (!hasPermission(session.user.role, 'settings:update')) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 },
      )
    }

    const body = await req.json()

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: 'Body harus berupa objek key-value' },
        { status: 400 },
      )
    }

    const keys = Object.keys(body)

    await Promise.all(
      keys.map((key) =>
        db.pengaturan.upsert({
          where: { key },
          update: {
            value: String(body[key]),
          },
          create: {
            key,
            value: String(body[key]),
          },
        }),
      ),
    )

    await auditLog(
      session,
      'UPDATE',
      'PENGATURAN',
      `Ubah pengaturan: ${keys.join(', ')}`,
      req,
    )

    return NextResponse.json({
      success: true,
      updated: keys.length,
    })
  } catch (error) {
    console.error('settings update error:', error)

    return NextResponse.json(
      { error: 'Gagal menyimpan pengaturan' },
      { status: 500 },
    )
  }
}
