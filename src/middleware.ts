import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Route publik yang tidak perlu autentikasi
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/2fa/verify-login',           // Verifikasi 2FA saat login (belum punya session)
  '/api/2fa/verify-setup',           // Verifikasi setup 2FA
  '/api/portal/pendaftaran',       // GET daftar pelatihan & POST pendaftaran baru
  '/api/portal/pelatihan-list',
  '/api/portal/pendaftaran/',      // Sub-routes pendaftaran portal
  '/api/programs/public',
  '/api/settings/logo',             // GET logo harus publik (dipakai di halaman login)
]

// Route yang dikecualikan dari proteksi (setup, seed, dll — hanya bisa via env token)
const SETUP_ROUTES = [
  '/api/setup-db',
  '/api/seed',
]

// Route upload portal — perlu proteksi khusus (token-based)
// Ini tetap lewat middleware, tapi dicek di route handler sendiri

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Hanya proteksi route API
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Cek apakah route publik
  const isPublic = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
  if (isPublic) {
    return NextResponse.next()
  }

  // Cek apakah route setup/seed — hanya boleh diakses jika punya token
  const isSetup = SETUP_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
  if (isSetup) {
    // Seed & setup hanya boleh via token Bearer atau query param
    const authHeader = request.headers.get('authorization')
    const queryToken = request.nextUrl.searchParams.get('token')
    const seedToken = process.env.SEED_TOKEN

    // Jika SEED_TOKEN tidak diset, blokir akses sepenuhnya
    if (!seedToken) {
      return NextResponse.json({ error: 'Endpoint tidak tersedia' }, { status: 404 })
    }

    const token = authHeader?.replace('Bearer ', '') || queryToken
    if (token !== seedToken) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }
    return NextResponse.next()
  }

  // Semua route API lainnya wajib punya session cookie
  const sessionCookie = request.cookies.get('bpsdm_session')
  if (!sessionCookie?.value) {
    // Untuk API request, kembalikan 401 JSON
    // Untuk page request, redirect ke home (akan menampilkan login)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Cocokkan semua route API
    '/api/:path*',
  ],
}
