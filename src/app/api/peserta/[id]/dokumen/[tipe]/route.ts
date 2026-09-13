import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import { resolveStoredFile, safeUnlinkStored } from '@/lib/storage'
import { readFile } from 'fs/promises'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIPE_DOKUMEN: Record<string, string> = {
  KTP: 'KTP',
  NPWP: 'NPWP',
  REK_BANK: 'Rekening Bank',
  SURAT_TUGAS: 'Surat Tugas',
  LAINNYA: 'Dokumen Lainnya',
}

// GET — download file dokumen
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; tipe: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, tipe } = await params
    const dokumen = await db.dokumenPeserta.findUnique({
      where: { pesertaId_tipe: { pesertaId: id, tipe } },
    })

    if (!dokumen) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })

    const resolved = resolveStoredFile(dokumen.filePath, 'peserta')
    if (!resolved.path) return NextResponse.json({ error: 'File tidak ditemukan di server' }, { status: 404 })

    const buffer = await readFile(resolved.path)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${dokumen.namaFile}"`,
      },
    })
  } catch (e) {
    console.error('dokumen peserta download error:', e)
    return NextResponse.json({ error: 'Gagal download dokumen' }, { status: 500 })
  }
}

// DELETE — hapus dokumen
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; tipe: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'peserta:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id, tipe } = await params
    const dokumen = await db.dokumenPeserta.findUnique({
      where: { pesertaId_tipe: { pesertaId: id, tipe } },
    })

    if (!dokumen) return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })

    // Hapus file fisik
    await safeUnlinkStored(dokumen.filePath, 'peserta')
    await db.dokumenPeserta.delete({ where: { id: dokumen.id } })

    const peserta = await db.peserta.findUnique({ where: { id }, select: { nama: true, nip: true } })
    await auditLog(session, 'DELETE', 'DOKUMEN_PESERTA', `Hapus dokumen ${TIPE_DOKUMEN[tipe] || tipe} peserta: ${peserta?.nama || id} (${peserta?.nip || ''})`, req)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('dokumen peserta delete error:', e)
    return NextResponse.json({ error: 'Gagal hapus dokumen' }, { status: 500 })
  }
}
