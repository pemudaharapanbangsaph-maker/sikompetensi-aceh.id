import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

const SEED_FLAG_PATH = '/tmp/.seed-done'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    // Check if already seeded using the DB path
    const fs = await import('fs')
    const path = await import('path')
    const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
    const match = dbUrl.match(/file:(.+)/)
    let dbPath = match ? match[1] : './db/custom.db'
    if (dbPath.startsWith('./')) {
      dbPath = path.join(process.cwd(), dbPath.substring(2))
    }
    const flagPath = path.join(path.dirname(dbPath), '.seed-done')
    if (fs.existsSync(flagPath)) {
      return NextResponse.json({ status: 'already_seeded' })
    }
  }

  try {
    const { db } = await import('@/lib/db')

    const hashedPassword = await bcrypt.hash('admin123', 10)

    // Create SUPER_ADMIN
    await db.user.upsert({
      where: { username: 'superadmin' },
      update: {},
      create: {
        username: 'superadmin',
        password: hashedPassword,
        nama: 'Super Administrator',
        email: 'superadmin@bpsdm.acehprov.go.id',
        role: 'SUPER_ADMIN',
        status: 'AKTIF',
        noTelp: '0651-12345',
      },
    })

    // Create ADMIN_BIDANG
    await db.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        password: hashedPassword,
        nama: 'Admin Bidang Kompetensi',
        email: 'admin@bpsdm.acehprov.go.id',
        role: 'ADMIN_BIDANG',
        status: 'AKTIF',
        noTelp: '0651-12346',
      },
    })

    // Create OPERATOR
    await db.user.upsert({
      where: { username: 'operator' },
      update: {},
      create: {
        username: 'operator',
        password: hashedPassword,
        nama: 'Operator Diklat',
        email: 'operator@bpsdm.acehprov.go.id',
        role: 'OPERATOR',
        status: 'AKTIF',
        noTelp: '0651-12347',
      },
    })

    // Default pengaturan
    const pengaturanDefaults = [
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
    for (const p of pengaturanDefaults) {
      await db.pengaturan.upsert({
        where: { key: p.key },
        update: {},
        create: p,
      })
    }

    // Mark as seeded
    if (process.env.NODE_ENV === 'production') {
      const fs = await import('fs')
      const path = await import('path')
      const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
      const match = dbUrl.match(/file:(.+)/)
      let dbPath = match ? match[1] : './db/custom.db'
      if (dbPath.startsWith('./')) {
        dbPath = path.join(process.cwd(), dbPath.substring(2))
      }
      fs.writeFileSync(path.join(path.dirname(dbPath), '.seed-done'), new Date().toISOString())
    }

    return NextResponse.json({
      status: 'seeded',
      users: ['superadmin', 'admin', 'operator'],
      password: 'admin123',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ status: 'error', message }, { status: 500 })
  }
}
