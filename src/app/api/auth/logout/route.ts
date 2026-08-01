import { NextResponse } from 'next/server'
import { destroySession, getSession, auditLog } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (session) {
      await auditLog(session, 'LOGOUT', 'AUTH', `User ${session.user.username} logout`, req)
    }
    await destroySession()
    const cookieStore = await cookies()
    cookieStore.delete('bpsdm_session')
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Gagal logout' }, { status: 500 })
  }
}
