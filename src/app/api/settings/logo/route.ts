import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const TARGET_FILENAME = 'pemda-logo.png'

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'settings:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('logo') as File | null
    if (!file) {
      return NextResponse.json({ error: 'File logo tidak ditemukan' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format file harus PNG, JPG, atau SVG' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 2MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Determine extension based on file type
    let ext = 'png'
    if (file.type === 'image/jpeg') ext = 'png'
    if (file.type === 'image/svg+xml') ext = 'svg'

    const filename = ext === 'svg' ? 'pemda-logo.svg' : TARGET_FILENAME
    const filepath = join(process.cwd(), 'public', filename)

    await writeFile(filepath, buffer)

    // Update pengaturan table
    const { db } = await import('@/lib/db')
    const version = String(Date.now())
    await db.pengaturan.upsert({
      where: { key: 'logo_url' },
      update: { value: `/${filename}?v=${version}` },
      create: { key: 'logo_url', value: `/${filename}?v=${version}` },
    })
    await db.pengaturan.upsert({
      where: { key: 'logo_updated_at' },
      update: { value: new Date().toISOString() },
      create: { key: 'logo_updated_at', value: new Date().toISOString() },
    })

    await auditLog(session, 'UPDATE', 'PENGATURAN', 'Upload logo baru', req)

    return NextResponse.json({ success: true, logoUrl: `/${filename}?v=${version}` })
  } catch (e) {
    console.error('logo upload error:', e)
    return NextResponse.json({ error: 'Gagal mengupload logo' }, { status: 500 })
  }
}
