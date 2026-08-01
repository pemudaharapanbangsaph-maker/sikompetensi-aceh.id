import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

// GET: return all Pengaturan records as { [key]: value }
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'settings:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const rows = await db.pengaturan.findMany()
    const result: Record<string, string> = {}
    for (const r of rows) {
      result[r.key] = r.value
    }
    return NextResponse.json(result)
  } catch (e) {
    console.error('settings get error:', e)
    return NextResponse.json({ error: 'Gagal memuat pengaturan' }, { status: 500 })
  }
}

// PUT: body is { key: value } object; upsert each. Add audit log.
export async function PUT(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'settings:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Body harus berupa objek key-value' }, { status: 400 })
    }
    const keys = Object.keys(body)
    await Promise.all(
      keys.map((key) =>
        db.pengaturan.upsert({
          where: { key },
          update: { value: String(body[key]) },
          create: { key, value: String(body[key]) },
        })
      )
    )
    await auditLog(session, 'UPDATE', 'PENGATURAN', `Ubah pengaturan: ${keys.join(', ')}`, req)
    return NextResponse.json({ success: true, updated: keys.length })
  } catch (e) {
    console.error('settings update error:', e)
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan' }, { status: 500 })
  }
}
