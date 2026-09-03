import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import * as fs from 'fs/promises'
import * as path from 'path'
import { resolveStoredFileDurable } from '@/lib/storage'

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

/** Sanitasi nama file supaya aman untuk header Content-Disposition. */
function sanitizeFileName(name: string): string {
  return (name || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150) || 'file'
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const item = await db.sertifikat.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Sertifikat tidak ditemukan' }, { status: 404 })
    if (!item.file) return NextResponse.json({ error: 'File tidak tersedia' }, { status: 404 })

    // Cari file di semua lokasi kandidat (UPLOAD_DIR, direktori server.mjs, process.cwd(),
    // dan folder versi deploy LAMA milik Hostinger) — file yang ditemukan di lokasi lama
    // otomatis disalin ke UPLOAD_DIR agar selamat dari redeploy berikutnya.
    const { path: filePath, tried } = await resolveStoredFileDurable(item.file, 'sertifikat')

    if (!filePath) {
      console.error('sertifikat file tidak ditemukan. Lokasi yang dicoba:', tried)
      return NextResponse.json(
        {
          error:
            'File sertifikat tidak ditemukan di server. ' +
            'File mungkin berpindah lokasi setelah redeploy. Lokasi yang sudah dicoba: ' +
            tried.join(' | '),
          code: 'FILE_NOT_FOUND',
          tried,
        },
        { status: 404 }
      )
    }

    let fileBuffer: Buffer
    try {
      fileBuffer = await fs.readFile(filePath)
    } catch (readErr) {
      const err = readErr as NodeJS.ErrnoException
      console.error('sertifikat file gagal dibaca:', err)
      return NextResponse.json(
        {
          error:
            `File ditemukan tetapi gagal dibaca (${err?.code || 'UNKNOWN'} — kemungkinan masalah permission). ` +
            `Periksa akses/ownership file: ${filePath}`,
          code: err?.code || 'READ_ERROR',
          path: filePath,
        },
        { status: 500 }
      )
    }

    const ext = path.extname(filePath).toLowerCase()
    const mimeType = MIME_MAP[ext] || 'application/octet-stream'

    const fileName = item.nomorSertifikat
      ? `Sertifikat_${sanitizeFileName(item.nomorSertifikat)}${ext}`
      : `Sertifikat_${sanitizeFileName(item.id)}${ext}`

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': String(fileBuffer.length),
      },
    })
  } catch (e) {
    console.error('sertifikat file download error:', e)
    return NextResponse.json({ error: 'Gagal mengunduh file sertifikat' }, { status: 500 })
  }
}
