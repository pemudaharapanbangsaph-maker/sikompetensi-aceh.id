import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
  const match = dbUrl.match(/file:(.+)/)
  let dbPath = match ? match[1] : './db/custom.db'
  if (dbPath.startsWith('./')) {
    dbPath = path.join(process.cwd(), dbPath.substring(2))
  }
  return dbPath
}

export async function GET() {
  const dbPath = getDbPath()
  const flagPath = path.join(path.dirname(dbPath), '.seed-done')

  if (fs.existsSync(flagPath)) {
    return NextResponse.json({ status: 'already_seeded' })
  }

  try {
    const Database = (await import('better-sqlite3')).default
    const db = new Database(dbPath)

    const hashedPassword = await bcrypt.hash('admin123', 10)

    // Insert users
    const insertUser = db.prepare(`INSERT OR IGNORE INTO User (id, username, password, nama, email, role, status, noTelp, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)

    const users = [
      { username: 'superadmin', nama: 'Super Administrator', email: 'superadmin@bpsdm.acehprov.go.id', role: 'SUPER_ADMIN' },
      { username: 'admin', nama: 'Admin Bidang Kompetensi', email: 'admin@bpsdm.acehprov.go.id', role: 'ADMIN_BIDANG' },
      { username: 'operator', nama: 'Operator Diklat', email: 'operator@bpsdm.acehprov.go.id', role: 'OPERATOR' },
    ]
    for (const u of users) {
      insertUser.run(u.username + '_' + Date.now(), u.username, hashedPassword, u.nama, u.email, u.role, 'AKTIF', '0651-12345')
    }

    // Insert pengaturan
    const insertPengaturan = db.prepare(`INSERT OR IGNORE INTO Pengaturan (id, key, value, kategori, updatedAt)
      VALUES (?, ?, ?, ?, datetime('now'))`)
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
      insertPengaturan.run(p.key + '_' + Date.now(), p.key, p.value, p.kategori)
    }

    db.close()
    fs.writeFileSync(flagPath, new Date().toISOString())

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
