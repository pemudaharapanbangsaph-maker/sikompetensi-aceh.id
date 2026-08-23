import { NextResponse } from 'next/server'

// Endpoint debug di-nonaktifkan untuk keamanan.
// Tidak ekspos struktur database ke publik.
export async function GET() {
  return NextResponse.json({ error: 'Endpoint tidak tersedia' }, { status: 404 })
}
