import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'

const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups')

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
    if (existsSync(filePath + '-wal')) unlinkSync(filePath + '-wal')
    if (existsSync(filePath + '-shm')) unlinkSync(filePath + '-shm')
    await db.backupHistory.delete({ where: { id } })
    await auditLog(session, 'DELETE', 'BACKUP', `Hapus backup: ${item.namaFile}`, req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('backup delete error:', e)
    return NextResponse.json({ error: 'Gagal menghapus backup' }, { status: 500 })
  }
}
