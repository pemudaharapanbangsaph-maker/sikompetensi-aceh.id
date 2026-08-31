import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Token sekali pakai untuk seed — harus diset di env
const SEED_TOKEN = process.env.SEED_TOKEN

export async function GET(req: Request) {
  // Cek token seed untuk mencegah akses sembarangan
  if (SEED_TOKEN) {
    const authHeader = req.headers.get('authorization')
    const queryToken = new URL(req.url).searchParams.get('token')
    const token = authHeader?.replace('Bearer ', '') || queryToken
    if (token !== SEED_TOKEN) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }
  }

  try {
    const hashedPassword = await bcrypt.hash('admin123', 10)

    // Cek apakah sudah ada user
    const existingUsers = await db.user.count()
    if (existingUsers > 0) {
      return NextResponse.json({ status: 'already_seeded', message: 'Database sudah memiliki data user' })
    }

    // Insert users pakai Prisma Client
    const users = [
      { username: 'superadmin', nama: 'Super Administrator', email: 'superadmin@bpsdm.acehprov.go.id', role: 'SUPER_ADMIN' },
      { username: 'admin', nama: 'Admin Bidang Kompetensi', email: 'admin@bpsdm.acehprov.go.id', role: 'ADMIN_BIDANG' },
      { username: 'operator', nama: 'Operator Diklat', email: 'operator@bpsdm.acehprov.go.id', role: 'OPERATOR' },
    ]
    for (const u of users) {
      await db.user.create({
        data: {
          username: u.username,
          password: hashedPassword,
          nama: u.nama,
          email: u.email,
          role: u.role,
          status: 'AKTIF',
          noTelp: '0651-12345',
        },
      })
    }

    // Insert pengaturan
    const existingPengaturan = await db.pengaturan.count()
    if (existingPengaturan === 0) {
      const pengaturan = [
        { key: 'nama_instansi', value: 'Badan Pengembangan Sumber Daya Manusia Aceh', kategori: 'PROFIL' },
        { key: 'nama_bidang', value: 'Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti', kategori: 'PROFIL' },
        { key: 'nama_sistem', value: 'Sistem Informasi Kompetensi Teknis', kategori: 'PROFIL' },
        { key: 'alamat', value: 'Jl. T. Iskandar No. 1, Banda Aceh 23123', kategori: 'PROFIL' },
        { key: 'telepon', value: '0651-22000', kategori: 'PROFIL' },
        { key: 'email', value: 'bpsdm@acehprov.go.id', kategori: 'PROFIL' },
        { key: 'website', value: 'https://bpsdm.acehprov.go.id', kategori: 'PROFIL' },
        { key: 'session_timeout', value: '30', kategori: 'KEAMANAN' },
        { key: 'max_login_attempts', value: '5', kategori: 'KEAMANAN' },
      ]
      for (const p of pengaturan) {
        await db.pengaturan.create({ data: p })
      }
    }

    // JANGAN kembalikan password di response!
    return NextResponse.json({
      status: 'seeded',
      message: 'Data awal berhasil dimuat. Silakan ganti password default setelah login pertama.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ status: 'error', message }, { status: 500 })
  }
}
