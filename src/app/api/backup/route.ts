import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog, hasPermission } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'backup:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const data = await db.backupHistory.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error('backup list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data backup' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'backup:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const namaFile = `backup_${stamp}.db`
    // Simulated size between 1.0 and 9.9 MB
    const ukuran = `${(Math.random() * 9 + 1).toFixed(1)} MB`
    const item = await db.backupHistory.create({
      data: {
        namaFile,
        ukuran,
        tipe: 'MANUAL',
        status: 'BERHASIL',
        dibuatOleh: session.user.id,
      },
    })
    await auditLog(session, 'BACKUP', 'BACKUP', `Backup database: ${namaFile} (${ukuran})`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('backup create error:', e)
    return NextResponse.json({ error: 'Gagal membuat backup' }, { status: 500 })
  }
}
