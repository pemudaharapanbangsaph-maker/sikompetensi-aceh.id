-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "noTelp" TEXT,
    "fotoUrl" TEXT,
    "lastLogin" DATETIME,
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "aksi" TEXT NOT NULL,
    "modul" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Peserta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nip" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenisKelamin" TEXT NOT NULL,
    "tempatLahir" TEXT,
    "tanggalLahir" DATETIME,
    "jabatan" TEXT,
    "pangkatGolongan" TEXT,
    "unitKerja" TEXT,
    "instansi" TEXT,
    "pendidikan" TEXT,
    "noTelp" TEXT,
    "email" TEXT,
    "alamat" TEXT,
    "fotoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Pelatihan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kategori" TEXT NOT NULL,
    "deskripsi" TEXT,
    "durasiHari" INTEGER NOT NULL DEFAULT 1,
    "jp" INTEGER NOT NULL DEFAULT 8,
    "createdBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pelatihan_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Angkatan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pelatihanId" TEXT NOT NULL,
    "namaAngkatan" TEXT NOT NULL,
    "tanggalMulai" DATETIME NOT NULL,
    "tanggalSelesai" DATETIME NOT NULL,
    "lokasi" TEXT,
    "metode" TEXT NOT NULL DEFAULT 'TATAP_MUKA',
    "kuota" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'PERENCANAAN',
    "catatan" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Angkatan_pelatihanId_fkey" FOREIGN KEY ("pelatihanId") REFERENCES "Pelatihan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PesertaAngkatan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "angkatanId" TEXT NOT NULL,
    "pesertaId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TERDAFTAR',
    "nilaiAkhir" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PesertaAngkatan_angkatanId_fkey" FOREIGN KEY ("angkatanId") REFERENCES "Angkatan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PesertaAngkatan_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "Peserta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dokumentasi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "angkatanId" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "deskripsi" TEXT,
    "fileUrl" TEXT NOT NULL,
    "tipeFile" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dokumentasi_angkatanId_fkey" FOREIGN KEY ("angkatanId") REFERENCES "Angkatan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalisisKebutuhan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "judul" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "unitKerja" TEXT NOT NULL,
    "jenisKompetensi" TEXT NOT NULL,
    "jumlahPegawai" INTEGER NOT NULL DEFAULT 0,
    "tingkatKebutuhan" TEXT NOT NULL DEFAULT 'SEDANG',
    "prioritas" TEXT NOT NULL DEFAULT 'NORMAL',
    "pelatihanId" TEXT,
    "catatan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dibuatOleh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnalisisKebutuhan_pelatihanId_fkey" FOREIGN KEY ("pelatihanId") REFERENCES "Pelatihan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AnalisisKebutuhan_dibuatOleh_fkey" FOREIGN KEY ("dibuatOleh") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asesor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nip" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "bidangKeahlian" TEXT NOT NULL,
    "noSertifikat" TEXT,
    "tanggalSertifikat" DATETIME,
    "instansi" TEXT,
    "email" TEXT,
    "noTelp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AKTIF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UjiKompetensi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kode" TEXT NOT NULL,
    "angkatanId" TEXT,
    "tanggalUji" DATETIME NOT NULL,
    "tempat" TEXT NOT NULL,
    "skemaSertifikasi" TEXT NOT NULL,
    "jumlahPeserta" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DIJADWALKAN',
    "catatan" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UjiKompetensi_angkatanId_fkey" FOREIGN KEY ("angkatanId") REFERENCES "Angkatan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UjiKompetensiAsesor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ujiKompetensiId" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "peran" TEXT NOT NULL DEFAULT 'ASESOR',
    CONSTRAINT "UjiKompetensiAsesor_ujiKompetensiId_fkey" FOREIGN KEY ("ujiKompetensiId") REFERENCES "UjiKompetensi" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UjiKompetensiAsesor_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "Asesor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Nilai" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ujiKompetensiId" TEXT NOT NULL,
    "pesertaId" TEXT NOT NULL,
    "nilaiPreTest" REAL,
    "nilaiPostTest" REAL,
    "nilaiPraktik" REAL,
    "nilaiTeori" REAL,
    "nilaiAkhir" REAL,
    "statusKelulusan" TEXT NOT NULL DEFAULT 'BELUM',
    "catatan" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Nilai_ujiKompetensiId_fkey" FOREIGN KEY ("ujiKompetensiId") REFERENCES "UjiKompetensi" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Nilai_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "Peserta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Kehadiran" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "angkatanId" TEXT NOT NULL,
    "pesertaId" TEXT NOT NULL,
    "tanggal" DATETIME NOT NULL,
    "statusKehadiran" TEXT NOT NULL DEFAULT 'HADIR',
    "keterangan" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Kehadiran_angkatanId_fkey" FOREIGN KEY ("angkatanId") REFERENCES "Angkatan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Kehadiran_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "Peserta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evaluasi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "angkatanId" TEXT,
    "pesertaId" TEXT,
    "jenisEvaluasi" TEXT NOT NULL,
    "aspek" TEXT,
    "nilai" REAL NOT NULL,
    "catatan" TEXT,
    "diinputOleh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evaluasi_angkatanId_fkey" FOREIGN KEY ("angkatanId") REFERENCES "Angkatan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evaluasi_pesertaId_fkey" FOREIGN KEY ("pesertaId") REFERENCES "Peserta" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Evaluasi_diinputOleh_fkey" FOREIGN KEY ("diinputOleh") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BackupHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "namaFile" TEXT NOT NULL,
    "ukuran" TEXT NOT NULL,
    "tipe" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'BERHASIL',
    "dibuatOleh" TEXT,
    "catatan" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupHistory_dibuatOleh_fkey" FOREIGN KEY ("dibuatOleh") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pengaturan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "kategori" TEXT NOT NULL DEFAULT 'UMUM',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Peserta_nip_key" ON "Peserta"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "Pelatihan_kode_key" ON "Pelatihan"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "PesertaAngkatan_angkatanId_pesertaId_key" ON "PesertaAngkatan"("angkatanId", "pesertaId");

-- CreateIndex
CREATE UNIQUE INDEX "Asesor_nip_key" ON "Asesor"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "UjiKompetensi_kode_key" ON "UjiKompetensi"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "UjiKompetensiAsesor_ujiKompetensiId_asesorId_key" ON "UjiKompetensiAsesor"("ujiKompetensiId", "asesorId");

-- CreateIndex
CREATE UNIQUE INDEX "Kehadiran_angkatanId_pesertaId_tanggal_key" ON "Kehadiran"("angkatanId", "pesertaId", "tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "Pengaturan_key_key" ON "Pengaturan"("key");

