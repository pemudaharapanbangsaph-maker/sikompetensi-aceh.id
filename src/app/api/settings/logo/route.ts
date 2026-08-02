import { NextResponse } from 'next/server'
import { writeFile, readFile, access, mkdirSync, existsSync } from 'fs/promises'
import { join, dirname } from 'path'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { existsSync as fsExistsSync } from 'fs'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const LOGO_FILENAME = 'pemda-logo.png'

/**
 * Get the data directory (same location as database).
 * On Railway with volume: /data
 * Locally: ./db
 */
function getDataDir(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  const match = dbUrl.match(/file:(.+)/)
  let dbPath = match ? match[1] : './db/custom.db'
  if (dbPath.startsWith('./')) {
    dbPath = join(process.cwd(), dbPath.substring(2))
  }
  return dirname(dbPath)
}

/**
 * Resolve the MIME type from extension
 */
function getMimeType(filename: string): string {
  if (filename.endsWith('.svg')) return 'image/svg+xml'
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg'
  return 'image/png'
}

/**
 * GET /api/settings/logo
 * Serves the custom logo from the volume (persistent storage).
 * Falls back to the default logo in public/ if no custom logo exists.
 */
export async function GET() {
  try {
    const dataDir = getDataDir()
    const logoPath = join(dataDir, LOGO_FILENAME)

    // Try to read from volume first
    try {
      const fileBuffer = await readFile(logoPath)
      const mimeType = getMimeType(logoPath)
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })
    } catch {
      // File not found in volume, fall through to default
    }

    // Fallback to default logo in public/
    const defaultPath = join(process.cwd(), 'public', LOGO_FILENAME)
    try {
      const fileBuffer = await readFile(defaultPath)
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    } catch {
      // No default logo either, return 1x1 transparent PNG
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64'
      )
      return new NextResponse(transparentPng, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      })
    }
  } catch (e) {
    console.error('Logo serve error:', e)
    return NextResponse.json({ error: 'Gagal memuat logo' }, { status: 500 })
  }
}

/**
 * POST /api/settings/logo
 * Uploads a custom logo and saves it to the volume (persistent storage).
 */
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

    // Save to volume (data directory)
    const dataDir = getDataDir()
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }
    const logoPath = join(dataDir, LOGO_FILENAME)
    await writeFile(logoPath, buffer)

    // Update pengaturan table
    const { db } = await import('@/lib/db')
    const version = String(Date.now())
    await db.pengaturan.upsert({
      where: { key: 'logo_url' },
      update: { value: `/api/settings/logo?v=${version}` },
      create: { key: 'logo_url', value: `/api/settings/logo?v=${version}` },
    })
    await db.pengaturan.upsert({
      where: { key: 'logo_updated_at' },
      update: { value: new Date().toISOString() },
      create: { key: 'logo_updated_at', value: new Date().toISOString() },
    })

    await auditLog(session, 'UPDATE', 'PENGATURAN', 'Upload logo baru', req)

    return NextResponse.json({ success: true, logoUrl: `/api/settings/logo?v=${version}` })
  } catch (e) {
    console.error('logo upload error:', e)
    return NextResponse.json({ error: 'Gagal mengupload logo' }, { status: 500 })
  }
}
