import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as fs from 'fs'
import * as path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads', 'pendaftaran')

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

    // Bangun ulang path dari cwd sekarang (bukan dari path yang tersimpan di DB)
    // Karena di Railway, cwd beda dengan saat upload di local
    let resolvedPath = doc.filePath
    if (!fs.existsSync(resolvedPath)) {
      // Coba cari berdasarkan nama file yang sudah dikenal: {pendaftaranId}_{tipe}.pdf
      const expectedName = `${id}_${tipe}.pdf`
      resolvedPath = path.join(UPLOAD_DIR, expectedName)
      if (!fs.existsSync(resolvedPath)) {
        // Coba cari semua file yang cocok di folder upload
        if (fs.existsSync(UPLOAD_DIR)) {
          const files = fs.readdirSync(UPLOAD_DIR)
          const match = files.find(f => f.startsWith(`${id}_${tipe}`))
          if (match) resolvedPath = path.join(UPLOAD_DIR, match)
        }
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'File tidak ditemukan di server' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(resolvedPath)
    const ext = path.extname(resolvedPath).toLowerCase()
    const contentType = ext === '.pdf' ? 'application/pdf' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : 'application/octet-stream'
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${doc.namaFile}"`,
      },
    })
  } catch (e) {
    console.error('dokumen download error:', e)
    return NextResponse.json({ error: 'Gagal mengunduh dokumen' }, { status: 500 })
  }
}
