import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ====================== USERS ======================
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const superAdmin = await prisma.user.upsert({
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

  const adminBidang = await prisma.user.upsert({
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

  const operator = await prisma.user.upsert({
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

  // ====================== PENGATURAN ======================
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
    await prisma.pengaturan.upsert({
      where: { key: p.key },
      update: {},
      create: p,
    })
  }

  // ====================== PELATIHAN ======================
  const pelatihanData = [
    { kode: 'PL-001', nama: 'Pelatihan Jaringan Komputer Dasar', kategori: 'TEKNIS', durasiHari: 5, jp: 40 },
    { kode: 'PL-002', nama: 'Pelatihan Manajemen Proyek TI', kategori: 'TEKNIS', durasiHari: 4, jp: 32 },
    { kode: 'PL-003', nama: 'Pelatihan Database Administrasi', kategori: 'TEKNIS', durasiHari: 6, jp: 48 },
    { kode: 'PL-004', nama: 'Pelatihan Kepemimpinan Strategis', kategori: 'MANAJERIAL', durasiHari: 3, jp: 24 },
    { kode: 'PL-005', nama: 'Pelatihan Pelayanan Publik Prima', kategori: 'FUNGSIONAL', durasiHari: 3, jp: 24 },
    { kode: 'PL-006', nama: 'Pelatihan Cyber Security', kategori: 'TEKNIS', durasiHari: 5, jp: 40 },
    { kode: 'PL-007', nama: 'Pelatihan Data Analytics', kategori: 'TEKNIS', durasiHari: 4, jp: 32 },
    { kode: 'PL-008', nama: 'Pelatihan Microsoft Office Advanced', kategori: 'TEKNIS', durasiHari: 3, jp: 24 },
    { kode: 'PL-009', nama: 'Pelatihan Public Speaking', kategori: 'SOSIAL_KULTURAL', durasiHari: 2, jp: 16 },
    { kode: 'PL-010', nama: 'Pelatihan Pengelolaan Keuangan Daerah', kategori: 'FUNGSIONAL', durasiHari: 5, jp: 40 },
  ]
  const pelatihan = []
  for (const p of pelatihanData) {
    const item = await prisma.pelatihan.create({
      data: { ...p, createdBy: adminBidang.id, deskripsi: `${p.nama} untuk meningkatkan kompetensi ASN Aceh` },
    })
    pelatihan.push(item)
  }

  // ====================== PESERTA ======================
  const namaDepan = ['Teuku', 'Cut', 'Muhammad', 'Zainal', 'Rina', 'Siti', 'Ahmad', 'Nurul', 'Fauzi', 'Dewi', 'Rizal', 'Yusuf', 'Maimunah', 'Hendra', 'Putri', 'Surya', 'Laila', 'Akmal', 'Farhan', 'Indah']
  const namaBelakang = ['Saputra', 'Maulana', 'Rahman', 'Hassan', 'Sari', 'Wijaya', 'Pratama', 'Ningsih', 'Hidayat', 'Lestari', 'Ardiansyah', 'Fadillah', 'Safitri', 'Gunawan', 'Oktavia', 'Halim', 'Marlina', 'Rizki', 'Anggraini', 'Nasution']
  const unitKerja = ['Dinas Komunikasi dan Informatika', 'Dinas Pendidikan', 'Badan Kepegawaian Daerah', 'Sekretariat Daerah', 'Dinas Kesehatan', 'Dinas PUPR', 'Bappeda', 'Inspektorat', 'Dinas Sosial', 'Dinas Pertanian']
  const instansiList = ['Pemerintah Aceh', 'Kota Banda Aceh', 'Kabupaten Aceh Besar', 'Kabupaten Pidie', 'Kota Lhokseumawe', 'Kabupaten Aceh Utara', 'Kabupaten Aceh Selatan', 'Kabupaten Bireuen', 'Kabupaten Aceh Tamiang', 'Kota Sabang']
  const peserta = []
  for (let i = 0; i < 60; i++) {
    const nama = `${namaDepan[i % namaDepan.length]} ${namaBelakang[(i * 3) % namaBelakang.length]}`
    const p = await prisma.peserta.create({
      data: {
        nip: `1985${String(i + 1).padStart(6, '0')}12345`,
        nama,
        jenisKelamin: i % 2 === 0 ? 'L' : 'P',
        jabatan: ['Staf', 'Penyelia', 'Analis', 'Pranata Komputer', 'Penata'][i % 5],
        pangkatGolongan: ['III/a', 'III/b', 'III/c', 'III/d', 'IV/a'][i % 5],
        unitKerja: unitKerja[i % unitKerja.length],
        instansi: instansiList[i % instansiList.length],
        pendidikan: ['S1', 'S2', 'D3', 'S1', 'S1'][i % 5],
        noTelp: `0812${String(34567890 + i).slice(0, 8)}`,
        email: `peserta${i + 1}@acehprov.go.id`,
        status: 'AKTIF',
      },
    })
    peserta.push(p)
  }

  // ====================== ANGKATAN ======================
  const angkatanStatus = ['SELESAI', 'SELESAI', 'SELESAI', 'BERJALAN', 'PERENCANAAN']
  const angkatan = []
  const now = new Date()
  for (let i = 0; i < 15; i++) {
    const pelatihanItem = pelatihan[i % pelatihan.length]
    const mulai = new Date(now)
    mulai.setDate(mulai.getDate() - (i * 20 - 60))
    const selesai = new Date(mulai)
    selesai.setDate(selesai.getDate() + pelatihanItem.durasiHari)
    const a = await prisma.angkatan.create({
      data: {
        pelatihanId: pelatihanItem.id,
        namaAngkatan: `Angkatan ${i + 1} - ${new Date().getFullYear()}`,
        tanggalMulai: mulai,
        tanggalSelesai: selesai,
        lokasi: ['Hotel Hermes Palace Banda Aceh', 'Aula BPSDM Aceh', 'Pusat Diklat Aceh', 'Hotel Kyriad Muraya'][i % 4],
        metode: ['TATAP_MUKA', 'DARING', 'BLENDED'][i % 3],
        kuota: 30,
        status: angkatanStatus[i % angkatanStatus.length],
        createdBy: operator.id,
      },
    })
    angkatan.push(a)

    // Register peserta to angkatan
    const pesertaCount = 20 + (i % 11)
    for (let j = 0; j < pesertaCount; j++) {
      const pesertaItem = peserta[(i * 4 + j) % peserta.length]
      const lulus = angkatanStatus[i % angkatanStatus.length] === 'SELESAI' ? (j % 10 !== 0) : null
      await prisma.pesertaAngkatan.create({
        data: {
          angkatanId: a.id,
          pesertaId: pesertaItem.id,
          status: lulus === null ? 'TERDAFTAR' : (lulus ? 'LULUS' : 'TIDAK_LULUS'),
          nilaiAkhir: lulus === null ? null : (lulus ? 75 + (j % 20) : 55 + (j % 15)),
        },
      }).catch(() => {})
    }
  }

  // ====================== ASESOR ======================
  const asesorData = [
    { nip: '197501012005011001', nama: 'Dr. Ir. H. Tarmizi Abbas, M.Kom', bidangKeahlian: 'Jaringan & Infrastruktur TI', noSertifikat: 'BNSP/ASR/2018/001' },
    { nip: '197803152006042002', nama: 'Dr. Cut Syahria, M.Sc', bidangKeahlian: 'Database & Data Analytics', noSertifikat: 'BNSP/ASR/2018/002' },
    { nip: '198002202008011003', nama: 'Ir. Muhammad Iqbal, MT', bidangKeahlian: 'Cyber Security', noSertifikat: 'BNSP/ASR/2019/003' },
    { nip: '198105252009012004', nama: 'Dr. Siti Aminah, M.M', bidangKeahlian: 'Manajemen Proyek', noSertifikat: 'BNSP/ASR/2019/004' },
    { nip: '198209102010011005', nama: 'Hendra Gunawan, S.Kom, M.TI', bidangKeahlian: 'Software Development', noSertifikat: 'BNSP/ASR/2020/005' },
    { nip: '198507152011012006', nama: 'Dewi Oktavia, S.T, M.Sc', bidangKeahlian: 'Pelayanan Publik Digital', noSertifikat: 'BNSP/ASR/2020/006' },
  ]
  const asesor = []
  for (const a of asesorData) {
    const item = await prisma.asesor.create({ data: { ...a, status: 'AKTIF', instansi: 'Universitas Syiah Kuala', email: a.nama.split(' ').slice(-1)[0].toLowerCase() + '@unsyiah.ac.id', noTelp: '0812' + String(Math.floor(10000000 + Math.random() * 89999999)) } })
    asesor.push(item)
  }

  // ====================== UJI KOMPETENSI ======================
  const skemaSertifikasi = ['MKG Jaringan Komputer', 'MKG Administrasi Database', 'MKG Keamanan Siber', 'MKG Analisis Data', 'MKG Manajemen Proyek TI', 'MKG Pelayanan Publik']
  for (let i = 0; i < 10; i++) {
    const angkatanItem = i < 6 ? angkatan[i] : null
    const tanggalUji = new Date(now)
    tanggalUji.setDate(tanggalUji.getDate() - (i * 15) + 30)
    const status = tanggalUji > now ? 'DIJADWALKAN' : 'SELESAI'
    const uji = await prisma.ujiKompetensi.create({
      data: {
        kode: `UK-${String(i + 1).padStart(3, '0')}`,
        angkatanId: angkatanItem?.id,
        tanggalUji,
        tempat: ['Hotel Hermes Palace', 'Aula BPSDM', 'Pusat Diklat'][i % 3],
        skemaSertifikasi: skemaSertifikasi[i % skemaSertifikasi.length],
        jumlahPeserta: 20 + (i % 11),
        status,
      },
    })
    // Assign 2 asesor per uji
    for (let j = 0; j < 2; j++) {
      await prisma.ujiKompetensiAsesor.create({
        data: { ujiKompetensiId: uji.id, asesorId: asesor[(i + j) % asesor.length].id, peran: j === 0 ? 'ASESOR' : 'PENGUJI' },
      }).catch(() => {})
    }
    // Create nilai for completed uji
    if (status === 'SELESAI' && angkatanItem) {
      const pesertaAngkatan = await prisma.pesertaAngkatan.findMany({ where: { angkatanId: angkatanItem.id }, take: 20 })
      for (const pa of pesertaAngkatan) {
        const nilaiAkhir = 60 + Math.floor(Math.random() * 35)
        await prisma.nilai.create({
          data: {
            ujiKompetensiId: uji.id,
            pesertaId: pa.pesertaId,
            nilaiPreTest: 40 + Math.floor(Math.random() * 30),
            nilaiPostTest: 60 + Math.floor(Math.random() * 35),
            nilaiPraktik: 55 + Math.floor(Math.random() * 40),
            nilaiTeori: 55 + Math.floor(Math.random() * 40),
            nilaiAkhir,
            statusKelulusan: nilaiAkhir >= 70 ? 'LULUS' : 'TIDAK_LULUS',
          },
        })
      }
    }
  }

  // ====================== ANALISIS KEBUTUHAN ======================
  const analisisData = [
    { judul: 'Analisis Kebutuhan Diklat ASN Dinas Komunikasi dan Informatika 2024', tahun: 2024, unitKerja: 'Dinas Komunikasi dan Informatika', jenisKompetensi: 'TEKNIS', jumlahPegawai: 45, tingkatKebutuhan: 'TINGGI', prioritas: 'TINGGI' },
    { judul: 'Analisis Kebutuhan Diklat Cyber Security Pemerintah Aceh 2024', tahun: 2024, unitKerja: 'Bidang TIK Setda Aceh', jenisKompetensi: 'TEKNIS', jumlahPegawai: 60, tingkatKebutuhan: 'SANGAT_TINGGI', prioritas: 'URGENT' },
    { judul: 'Analisis Kebutuhan Diklat Manajemen Proyek 2024', tahun: 2024, unitKerja: 'Dinas PUPR', jenisKompetensi: 'MANAJERIAL', jumlahPegawai: 35, tingkatKebutuhan: 'SEDANG', prioritas: 'NORMAL' },
    { judul: 'Analisis Kebutuhan Pelayanan Publik Digital 2024', tahun: 2024, unitKerja: 'DPMPTSP Aceh', jenisKompetensi: 'FUNGSIONAL', jumlahPegawai: 50, tingkatKebutuhan: 'TINGGI', prioritas: 'TINGGI' },
    { judul: 'Analisis Kebutuhan Data Analytics Bappeda 2024', tahun: 2024, unitKerja: 'Bappeda Aceh', jenisKompetensi: 'TEKNIS', jumlahPegawai: 28, tingkatKebutuhan: 'SEDANG', prioritas: 'NORMAL' },
    { judul: 'Analisis Kebutuhan Diklat Pengelolaan Keuangan Daerah 2025', tahun: 2025, unitKerja: 'BPKAD Aceh', jenisKompetensi: 'FUNGSIONAL', jumlahPegawai: 70, tingkatKebutuhan: 'TINGGI', prioritas: 'TINGGI' },
    { judul: 'Analisis Kebutuhan Public Speaking ASN Aceh 2025', tahun: 2025, unitKerja: 'Setda Aceh', jenisKompetensi: 'SOSIAL_KULTURAL', jumlahPegawai: 120, tingkatKebutuhan: 'SEDANG', prioritas: 'NORMAL' },
    { judul: 'Analisis Kebutuhan Microsoft Office Advanced 2025', tahun: 2025, unitKerja: 'Seluruh OPD', jenisKompetensi: 'TEKNIS', jumlahPegawai: 200, tingkatKebutuhan: 'TINGGI', prioritas: 'TINGGI' },
  ]
  for (let i = 0; i < analisisData.length; i++) {
    await prisma.analisisKebutuhan.create({
      data: {
        ...analisisData[i],
        pelatihanId: i < pelatihan.length ? pelatihan[i].id : null,
        status: i < 4 ? 'SELESAI' : (i < 6 ? 'DISETUJUI' : 'DRAFT'),
        dibuatOleh: adminBidang.id,
        catatan: 'Hasil analisis berdasarkan kuesioner dan TNA tahunan',
      },
    })
  }

  // ====================== EVALUASI ======================
  for (let i = 0; i < 4; i++) {
    const a = angkatan[i]
    const pesertaAngkatan = await prisma.pesertaAngkatan.findMany({ where: { angkatanId: a.id }, take: 15 })
    for (const pa of pesertaAngkatan) {
      await prisma.evaluasi.create({
        data: { angkatanId: a.id, pesertaId: pa.pesertaId, jenisEvaluasi: 'PRE_TEST', nilai: 30 + Math.floor(Math.random() * 30), diinputOleh: operator.id },
      })
      await prisma.evaluasi.create({
        data: { angkatanId: a.id, pesertaId: pa.pesertaId, jenisEvaluasi: 'POST_TEST', nilai: 65 + Math.floor(Math.random() * 30), diinputOleh: operator.id },
      })
      await prisma.evaluasi.create({
        data: { angkatanId: a.id, pesertaId: pa.pesertaId, jenisEvaluasi: 'KUESIONER', aspek: 'Penyelenggaraan', nilai: 70 + Math.floor(Math.random() * 25), diinputOleh: operator.id },
      })
    }
  }

  // ====================== AUDIT LOG ======================
  await prisma.auditLog.create({
    data: { userId: superAdmin.id, username: 'superadmin', aksi: 'SYSTEM', modul: 'SYSTEM', deskripsi: 'Inisialisasi sistem dan seeding data awal', ip: '127.0.0.1' },
  })

  console.log('✅ Seed complete!')
  console.log('   Users: superadmin/admin123, admin/admin123, operator/admin123')
  console.log('   Pelatihan: 10, Peserta: 60, Angkatan: 15, Asesor: 6')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
