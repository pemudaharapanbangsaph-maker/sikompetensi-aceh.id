import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { db } from '@/lib/db'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const LOGO_FILENAME = 'logo-pancacita.png'

// Auto-migrate: perbesar kolom value dari TEXT (65KB) ke MEDIUMTEXT (16MB)
// Hanya perlu sekali, setelah itu MySQL mengabaikan ALTER yang sama
let _migrated = false
async function ensureColumnSize() {
  if (_migrated) return
  try {
    await db.$executeRawUnsafe(
     
    )
    console.log('[Logo] Kolom Pengaturan.value di-upgrade ke MEDIUMTEXT')
  } catch {
    // Sudah MEDIUMTEXT atau error lainnya, aman diabaikan
  }
  _migrated = true
}

export async function GET() {
  try {
    // 1. Coba ambil dari database (PERSISTEN, aman saat deploy ulang)
    try {
      const logoData = await db.pengaturan.findUnique({
        where: { key: 'logo_base64' },
      })
      if (logoData?.value) {
        const ct = await db.pengaturan.findUnique({
          where: { key: 'logo_content_type' },
        })
        const mime = ct?.value || 'image/png'
        const buffer = Buffer.from(logoData.value, 'base64')
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        })
      }
    } catch {
      // DB error, fall through ke fallback
    }

    // 2. Fallback: file lama di db/ folder (kompatibilitas transisi)
    try {
      const oldPath = join(process.cwd(), 'db', LOGO_FILENAME)
      const fileBuffer = await readFile(oldPath)
      let mime = 'image/png'
      if (oldPath.endsWith('.svg')) mime = 'image/svg+xml'
      else if (oldPath.endsWith('.jpg') || oldPath.endsWith('.jpeg'))
        mime = 'image/jpeg'
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
    }catch (error) {
  console.error('Gagal mengambil logo:', error)

  return new Response('Logo tidak dapat dimuat', {
    status: 500,
  })
}

    // 3. Fallback: default logo di public/
    try {
      const defaultPath = join(process.cwd(), 'public', LOGO_FILENAME)
      const fileBuffer = await readFile(defaultPath)
      return new NextResponse(fileBuffer, {
        headers: {
  'Content-Type': mimeType,
  'Cache-Control':
    'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
},
      })
    } catch {
      // 4. Fallback terakhir: transparent pixel 1x1
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'base64',
      )
      return new NextResponse(transparentPng, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      })
    }
  } catch (e) {
    console.error('Logo serve error:', e)
    return NextResponse.json(
      { error: 'Gagal memuat logo' },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'settings:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('logo') as File | null
    if (!file) {
      return NextResponse.json(
        { error: 'File logo tidak ditemukan' },
        { status: 400 },
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format file harus PNG, JPG, atau SVG' },
        { status: 400 },
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file maksimal 2MB' },
        { status: 400 },
      )
    }

    // Pastikan kolom cukup besar sebelum simpan
    await ensureColumnSize()

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')

    // Simpan logo sebagai base64 di database (PERSISTEN!)
    await db.pengaturan.upsert({
      where: { key: 'logo_base64' },
      update: { value: base64 },
      create: { key: 'logo_base64', value: base64, kategori: 'LOGO' },
    })

    // Simpan content type
    await db.pengaturan.upsert({
      where: { key: 'logo_content_type' },
      update: { value: file.type },
      create: {
        key: 'logo_content_type',
        value: file.type,
        kategori: 'LOGO',
      },
    })

    // Update URL untuk cache busting
    const version = String(Date.now())
    await db.pengaturan.upsert({
      where: { key: 'logo_url' },
      update: { value: `/api/settings/logo?v=${version}` },
      create: {
        key: 'logo_url',
        value: `/api/settings/logo?v=${version}`,
      },
    })
    await db.pengaturan.upsert({
      where: { key: 'logo_updated_at' },
      update: { value: new Date().toISOString() },
      create: { key: 'logo_updated_at', value: new Date().toISOString() },
    })

    await auditLog(
      session,
      'UPDATE',
      'PENGATURAN',
      'Upload logo baru (disimpan di database)',
      req,
    )

    return NextResponse.json({
      success: true,
      logoUrl: `/api/settings/logo?v=${version}`,
    })
  } catch (e) {
    console.error('logo upload error:', e)
    return NextResponse.json(
      { error: 'Gagal mengupload logo' },
      { status: 500 },
    )
  }
}
