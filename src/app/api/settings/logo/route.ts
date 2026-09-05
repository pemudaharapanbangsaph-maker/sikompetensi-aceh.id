import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

// Sesuaikan jika nama file logo default Anda berbeda
const LOGO_FILENAME = 'logo-pancacita.png'

export async function GET() {
  // Ambil logo dari database
  try {
    const logoData = await db.pengaturan.findUnique({
      where: {
        key: 'logo_base64',
      },
    })

    if (logoData?.value) {
      const contentTypeData =
        await db.pengaturan.findUnique({
          where: {
            key: 'logo_content_type',
          },
        })

      const mimeType =
        contentTypeData?.value || 'image/png'

      const base64Value = logoData.value.includes(',')
        ? logoData.value.split(',')[1]
        : logoData.value

      const imageBuffer = Buffer.from(
        base64Value,
        'base64',
      )

      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control':
            'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
  } catch (error) {
    console.error(
      'Gagal mengambil logo dari database:',
      error,
    )
  }

  // Fallback ke logo default di folder public
  try {
    const defaultLogoPath = join(
      process.cwd(),
      'public',
      LOGO_FILENAME,
    )

    const fileBuffer = await readFile(defaultLogoPath)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control':
          'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error(
      'Gagal mengambil logo default:',
      error,
    )

    return NextResponse.json(
      { error: 'Logo tidak ditemukan' },
      { status: 404 },
    )
  }
}
