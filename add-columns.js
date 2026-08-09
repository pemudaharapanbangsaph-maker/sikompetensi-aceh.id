const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
async function main() {
  await db.$executeRawUnsafe('ALTER TABLE User ADD COLUMN tempatLahir TEXT')
  await db.$executeRawUnsafe('ALTER TABLE User ADD COLUMN tanggalLahir DATETIME')
  console.log('Kolom baru berhasil ditambahkan!')
}
main().catch(e => { console.error(e.message) }).finally(() => db.$disconnect())
