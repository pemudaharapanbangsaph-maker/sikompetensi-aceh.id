import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as fs from 'fs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; tipe: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, tipe } = await params

    const doc = await db.dokumenPendaftaran.findUnique({
      where: { pendaftaranId_tipe: { pendaftaranId: id, tipe } },
    })
    if (!doc) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })

    if (!fs.existsSync(doc.filePath)) {
      return NextResponse.json({ error: 'File tidak ditemukan di server' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(doc.filePath)
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${doc.namaFile}"`,
      },
    })
  } catch (e) {
    console.error('dokumen download error:', e)
    return NextResponse.json({ error: 'Gagal mengunduh dokumen' }, { status: 500 })
  }
}
