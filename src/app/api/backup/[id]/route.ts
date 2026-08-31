import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { existsSync, createReadStream, statSync, unlinkSync } from 'fs'
import path from 'path'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')

// GET = Download file backup (.sql)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'backup:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.backupHistory.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Backup tidak ditemukan' }, { status: 404 })
    const filePath = path.join(BACKUP_DIR, item.namaFile)
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File backup tidak ditemukan di server' }, { status: 404 })
    }
    const stats = statSync(filePath)
    const stream = createReadStream(filePath)
    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/sql',
        'Content-Disposition': `attachment; filename="${item.namaFile}"`,
        'Content-Length': String(stats.size),
      },
    })
  } catch (e) {
    console.error('backup download error:', e)
    return NextResponse.json({ error: 'Gagal mengunduh backup' }, { status: 500 })
  }
}

// DELETE = Hapus backup
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'backup:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const item = await db.backupHistory.findUnique({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Backup tidak ditemukan' }, { status: 404 })
    const filePath = path.join(BACKUP_DIR, item.namaFile)
    if (existsSync(filePath)) unlinkSync(filePath)
    await db.backupHistory.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'BACKUP', `Hapus backup: ${item.namaFile}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('backup delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus backup' }, { status: 500 })
  }
}
