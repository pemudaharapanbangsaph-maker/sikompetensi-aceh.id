export interface User {
  id: string
  username: string
  nama: string
  email: string
  role: 'SUPER_ADMIN' | 'ADMIN_BIDANG' | 'OPERATOR'
  status: string
  noTelp?: string | null
  lastLogin?: string | null
  createdAt: string
}

export interface Peserta {
  id: string
  nip: string
  nama: string
  jenisKelamin: string
  tempatLahir?: string | null
  tanggalLahir?: string | null
  jabatan?: string | null
  pangkatGolongan?: string | null
  unitKerja?: string | null
  instansi?: string | null
  pendidikan?: string | null
  noTelp?: string | null
  email?: string | null
  alamat?: string | null
  status: string
  createdAt: string
}

export interface Pelatihan {
  id: string
  kode: string
  nama: string
  kategori: string
  deskripsi?: string | null
  durasiHari: number
  jp: number
  status: string
  createdAt: string
}

export interface Angkatan {
  id: string
  pelatihanId: string
  pelatihan?: Pelatihan | null
  namaAngkatan: string
  tanggalMulai: string
  tanggalSelesai: string
  lokasi?: string | null
  metode: string
  kuota: number
  status: string
  catatan?: string | null
  _count?: { peserta: number }
  peserta?: PesertaAngkatan[]
}

export interface PesertaAngkatan {
  id: string
  angkatanId: string
  pesertaId: string
  peserta?: Peserta
  status: string
  nilaiAkhir?: number | null
}

export interface AnalisisKebutuhan {
  id: string
  judul: string
  tahun: number
  unitKerja: string
  jenisKompetensi: string
  jumlahPegawai: number
  tingkatKebutuhan: string
  prioritas: string
  pelatihanId?: string | null
  pelatihan?: Pelatihan | null
  status: string
  catatan?: string | null
  createdAt: string
}

export interface UjiKompetensi {
  id: string
  kode: string
  angkatanId?: string | null
  angkatan?: Angkatan | null
  tanggalUji: string
  tempat: string
  skemaSertifikasi: string
  jumlahPeserta: number
  status: string
  catatan?: string | null
  asesor?: Asesor[]
  _count?: { nilai: number }
}

export interface Asesor {
  id: string
  nip: string
  nama: string
  bidangKeahlian: string
  noSertifikat?: string | null
  instansi?: string | null
  email?: string | null
  noTelp?: string | null
  status: string
}

export interface Nilai {
  id: string
  ujiKompetensiId: string
  pesertaId: string
  peserta?: Peserta
  nilaiPreTest?: number | null
  nilaiPostTest?: number | null
  nilaiPraktik?: number | null
  nilaiTeori?: number | null
  nilaiAkhir?: number | null
  statusKelulusan: string
  catatan?: string | null
}

export interface Kehadiran {
  id: string
  angkatanId: string
  pesertaId: string
  peserta?: Peserta
  tanggal: string
  statusKehadiran: string
  keterangan?: string | null
}

export interface Evaluasi {
  id: string
  angkatanId?: string | null
  angkatan?: Angkatan | null
  pesertaId?: string | null
  peserta?: Peserta | null
  jenisEvaluasi: string
  aspek?: string | null
  nilai: number
  catatan?: string | null
  createdAt: string
}

export interface AuditLog {
  id: string
  username: string
  aksi: string
  modul: string
  deskripsi: string
  ip?: string | null
  createdAt: string
}

export interface BackupHistory {
  id: string
  namaFile: string
  ukuran: string
  tipe: string
  status: string
  dibuatOleh?: string | null
  user?: { nama: string; username: string } | null
  catatan?: string | null
  createdAt: string
}

export interface DashboardStats {
  totalPelatihan: number
  totalAngkatan: number
  totalPeserta: number
  totalUjiKompetensi: number
  totalAsesor: number
  totalAnalisis: number
  pelatihanBerjalan: number
  pesertaLulus: number
  pesertaTidakLulus: number
  ujiSelesai: number
  grafikPelatihanPerBulan: { bulan: string; jumlah: number }[]
  grafikKelulusan: { lulus: number; tidakLulus: number }[]
  grafikKategoriPelatihan: { kategori: string; jumlah: number }[]
  jadwalTerdekat: (Angkatan | UjiKompetensi)[]
  aktivitasTerbaru: AuditLog[]
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
