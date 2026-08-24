import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as fs from 'fs/promises'
import * as path from 'path'

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const item = await db.sertifikat.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Sertifikat tidak ditemukan' }, { status: 404 })
    if (!item.file) return NextResponse.json({ error: 'File tidak tersedia' }, { status: 404 })

    const filePath = path.join(process.cwd(), item.file)
    const fileBuffer = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mimeType = MIME_MAP[ext] || 'application/octet-stream'

    const fileName = item.nomorSertifikat
      ? `Sertifikat_${item.nomorSertifikat.replace(/\s+/g, '_')}${ext}`
      : `Sertifikat_${item.id}${ext}`

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (e) {
    console.error('sertifikat file download error:', e)
    return NextResponse.json({ error: 'Gagal mengunduh file sertifikat' }, { status: 500 })
  }
}
