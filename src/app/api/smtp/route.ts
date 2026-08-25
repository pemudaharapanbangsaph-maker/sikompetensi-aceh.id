import { NextResponse } from 'next/server'
import { getSession, auditLog } from '@/lib/auth'
import { testSmtpConnection, getSmtpConfigForDisplay, saveSmtpConfig } from '@/lib/email'

// GET: Get current SMTP config (password masked)
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const config = await getSmtpConfigForDisplay()
    return NextResponse.json(config)
  } catch (e) {
    console.error('smtp get error:', e)
    return NextResponse.json({ error: 'Gagal memuat konfigurasi SMTP' }, { status: 500 })
  }
}

// PUT: Save SMTP config
export async function PUT(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    await saveSmtpConfig(body)
    await auditLog(session, 'UPDATE', 'PENGATURAN', 'Update konfigurasi SMTP', req)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('smtp save error:', e)
    return NextResponse.json({ error: 'Gagal menyimpan konfigurasi SMTP' }, { status: 500 })
  }
}

// POST: Test SMTP connection
export async function POST() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await testSmtpConnection()
    await auditLog(session, 'UPDATE', 'PENGATURAN', `Test koneksi SMTP: ${result.message}`, null as unknown as Request)
    return NextResponse.json(result)
  } catch (e) {
    const msg = (e as Error).message || 'Gagal terhubung ke SMTP'
    return NextResponse.json({ success: false, message: msg }, { status: 400 })
  }
}
