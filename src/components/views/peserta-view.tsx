'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { Peserta, Angkatan, Nilai, UjiKompetensi, Pelatihan } from '@/lib/types'
import { useNavStore } from '@/store/auth-store'
import { DataTable, StatCard, PageHeader, type Column, type FilterOption } from '@/components/shared/data-table'
import { StatusBadge, formatTanggal, formatTanggalSingkat } from '@/components/shared/ui-helpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Pencil, Trash2, Plus, Save, X, Users, User, UserCircle, UserCheck, GraduationCap, Award, History, ArrowRight, Search } from 'lucide-react'
import { motion } from 'framer-motion'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const JENIS_KELAMIN = [
  { value: 'L', label: 'Laki-laki' },
  { value: 'P', label: 'Perempuan' },
]

const PENDIDIKAN = [
  { value: 'D1', label: 'Diploma I (D1)' },
  { value: 'D2', label: 'Diploma II (D2)' },
  { value: 'D3', label: 'Diploma III (D3)' },
  { value: 'S1', label: 'Sarjana (S1)' },
  { value: 'S2', label: 'Magister (S2)' },
  { value: 'S3', label: 'Doktor (S3)' },
]

const STATUS_PESERTA = [
  { value: 'AKTIF', label: 'Aktif' },
  { value: 'NONAKTIF', label: 'Nonaktif' },
]

const PENDIDIKAN_ORDER: Record<string, number> = { D1: 1, D2: 2, D3: 3, S1: 4, S2: 5, S3: 6 }

const EMPTY_FORM: Partial<Peserta> = {
  nip: '',
  nama: '',
  jenisKelamin: 'L',
  tempatLahir: '',
  tanggalLahir: '',
  jabatan: '',
  pangkatGolongan: '',
  unitKerja: '',
  instansi: '',
  pendidikan: 'S1',
  noTelp: '',
  email: '',
  alamat: '',
  status: 'AKTIF',
}

function toDateInput(d?: string | null): string {
  if (!d) return ''
  try {
    return new Date(d).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

// ===========================================================================
// ROOT COMPONENT
// ===========================================================================

export function PesertaView() {
  const { activeView } = useNavStore()
  if (activeView === 'peserta-riwayat') return <PesertaRiwayatView />
  return <PesertaDataTable />
}

// ===========================================================================
// SUBTAB 1: PESERTA DATA TABLE (CRUD)
// ===========================================================================

function PesertaDataTable() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()

  const [data, setData] = useState<Peserta[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [allPeserta, setAllPeserta] = useState<Peserta[]>([])

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Peserta | null>(null)
  const [form, setForm] = useState<Partial<Peserta>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<Peserta | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        status: filters.status || undefined,
        jenisKelamin: filters.jenisKelamin || undefined,
      }
      const res = await api.peserta.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filters, toast])

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.peserta.listAll()
      setAllPeserta(res)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchAll() }, [fetchAll])

  const refresh = useCallback(() => {
    fetchData()
    fetchAll()
  }, [fetchData, fetchAll])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }))
    setPage(1)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const openEdit = (item: Peserta) => {
    setEditing(item)
    setForm({
      nip: item.nip,
      nama: item.nama,
      jenisKelamin: item.jenisKelamin,
      tempatLahir: '',
      tanggalLahir: item.tanggalLahir || '',
      jabatan: item.jabatan || '',
      pangkatGolongan: item.pangkatGolongan || '',
      unitKerja: item.unitKerja || '',
      instansi: item.instansi || '',
      pendidikan: item.pendidikan || 'S1',
      noTelp: item.noTelp || '',
      email: item.email || '',
      alamat: '',
      status: item.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.nip || !form.nama) {
      toast({ title: 'Validasi', description: 'NIP dan Nama peserta wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Partial<Peserta> = {
        ...form,
        tanggalLahir: form.tanggalLahir ? new Date(form.tanggalLahir).toISOString() : null,
      }
      if (editing) {
        await api.peserta.update(editing.id, payload)
        toast({ title: 'Berhasil', description: 'Data peserta diperbarui' })
      } else {
        await api.peserta.create(payload)
        toast({ title: 'Berhasil', description: 'Peserta baru ditambahkan' })
      }
      setDialogOpen(false)
      refresh()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.peserta.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Peserta dihapus' })
      setDeleteTarget(null)
      refresh()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const filterOptions: FilterOption[] = [
    { key: 'status', label: 'Status', options: STATUS_PESERTA },
    { key: 'jenisKelamin', label: 'Jenis Kelamin', options: JENIS_KELAMIN },
  ]

  const columns: Column<Peserta>[] = [
    {
      key: 'nama', header: 'Nama Peserta', render: (r) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.nama}</p>
          <p className="text-xs text-slate-400 font-mono">NIP: {r.nip}</p>
        </div>
      ),
    },
    { key: 'jenisKelamin', header: 'L/P', render: (r) => <span className="text-slate-600 text-xs">{r.jenisKelamin === 'L' ? 'L' : 'P'}</span> },
    {
      key: 'jabatan', header: 'Jabatan / Pangkat', render: (r) => (
        <div className="min-w-[160px]">
          <p className="text-sm text-slate-700 line-clamp-1">{r.jabatan || '-'}</p>
          <p className="text-xs text-slate-400 line-clamp-1">{r.pangkatGolongan || '-'}</p>
        </div>
      ),
    },
    {
      key: 'unitKerja', header: 'Unit Kerja / Instansi', render: (r) => (
        <div className="min-w-[180px]">
          <p className="text-sm text-slate-700 line-clamp-1">{r.unitKerja || '-'}</p>
          <p className="text-xs text-slate-400 line-clamp-1">{r.instansi || '-'}</p>
        </div>
      ),
    },
    { key: 'pendidikan', header: 'Pendidikan', render: (r) => <span className="text-slate-600 text-sm">{r.pendidikan || '-'}</span> },
    {
      key: 'kontak', header: 'Kontak', render: (r) => (
        <div className="text-xs text-slate-600 min-w-[160px]">
          {r.noTelp && <p>{r.noTelp}</p>}
          {r.email && <p className="text-slate-400 line-clamp-1">{r.email}</p>}
          {!r.noTelp && !r.email && <span className="text-slate-300">-</span>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  // Stats from allPeserta
  const totalL = useMemo(() => allPeserta.filter((p) => p.jenisKelamin === 'L').length, [allPeserta])
  const totalP = useMemo(() => allPeserta.filter((p) => p.jenisKelamin === 'P').length, [allPeserta])
  const pendidikanTertinggi = useMemo(() => {
    let max: string | null = null
    let maxOrder = 0
    allPeserta.forEach((p) => {
      const ord = PENDIDIKAN_ORDER[p.pendidikan || ''] || 0
      if (ord > maxOrder) {
        maxOrder = ord
        max = p.pendidikan ?? null
      }
    })
    return max || '-'
  }, [allPeserta])

  return (
    <div className="space-y-4">
      <PageHeader title="Data Peserta" description="Kelola data peserta pelatihan dan uji kompetensi">
        <Button variant="outline" size="sm" onClick={() => setActiveView('peserta-riwayat')} className="h-9">
          <History className="w-4 h-4" /> Riwayat Peserta
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Total Peserta" value={allPeserta.length} icon={Users} color="blue" />
        <StatCard title="Peserta L" value={totalL} icon={User} color="green" subtitle="Laki-laki" />
        <StatCard title="Peserta P" value={totalP} icon={UserCircle} color="amber" subtitle="Perempuan" />
        <StatCard title="Pendidikan Tertinggi" value={pendidikanTertinggi} icon={GraduationCap} color="purple" subtitle="Dari semua peserta" />
      </div>

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari nama / NIP / unit kerja / instansi..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        filters={filterOptions}
        filterValues={filters}
        onFilterChange={handleFilter}
        onAdd={openCreate}
        addLabel="Tambah Peserta"
        onRefresh={refresh}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data peserta"
        actions={(row) => (
          <>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-[#0F4C81]" onClick={() => openEdit(row)} title="Edit">
              <Pencil className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-red-600" onClick={() => setDeleteTarget(row)} title="Hapus">
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Data Peserta' : 'Tambah Peserta Baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>NIP <span className="text-red-500">*</span></Label>
              <Input value={form.nip || ''} onChange={(e) => setForm({ ...form, nip: e.target.value })} placeholder="Nomor Induk Pegawai" />
            </div>
            <div className="space-y-1.5">
              <Label>Nama Lengkap <span className="text-red-500">*</span></Label>
              <Input value={form.nama || ''} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama lengkap peserta" />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis Kelamin</Label>
              <Select value={form.jenisKelamin || 'L'} onValueChange={(v) => setForm({ ...form, jenisKelamin: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JENIS_KELAMIN.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pendidikan</Label>
              <Select value={form.pendidikan || 'S1'} onValueChange={(v) => setForm({ ...form, pendidikan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PENDIDIKAN.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tempat Lahir</Label>
              <Input value={form.tempatLahir || ''} onChange={(e) => setForm({ ...form, tempatLahir: e.target.value })} placeholder="Contoh: Banda Aceh" />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Lahir</Label>
              <Input type="date" value={toDateInput(form.tanggalLahir as string)} onChange={(e) => setForm({ ...form, tanggalLahir: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Jabatan</Label>
              <Input value={form.jabatan || ''} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} placeholder="Contoh: Staff, Kepala Seksi" />
            </div>
            <div className="space-y-1.5">
              <Label>Pangkat / Golongan</Label>
              <Input value={form.pangkatGolongan || ''} onChange={(e) => setForm({ ...form, pangkatGolongan: e.target.value })} placeholder="Contoh: Penata Muda / III-a" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit Kerja</Label>
              <Input value={form.unitKerja || ''} onChange={(e) => setForm({ ...form, unitKerja: e.target.value })} placeholder="Contoh: Subbagian Umum" />
            </div>
            <div className="space-y-1.5">
              <Label>Instansi</Label>
              <Input value={form.instansi || ''} onChange={(e) => setForm({ ...form, instansi: e.target.value })} placeholder="Contoh: Dinas Pendidikan Aceh" />
            </div>
            <div className="space-y-1.5">
              <Label>No. Telepon</Label>
              <Input value={form.noTelp || ''} onChange={(e) => setForm({ ...form, noTelp: e.target.value })} placeholder="08xx-xxxx-xxxx" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="peserta@example.go.id" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || 'AKTIF'} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_PESERTA.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Alamat</Label>
              <Textarea rows={2} value={form.alamat || ''} onChange={(e) => setForm({ ...form, alamat: e.target.value })} placeholder="Alamat domisili peserta..." />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}><X className="w-4 h-4" /> Batal</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63]">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus peserta <span className="font-semibold">{deleteTarget?.nama}</span>? Seluruh riwayat pelatihan, kehadiran, dan nilai terkait juga akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===========================================================================
// SUBTAB 2: RIWAYAT PESERTA (Pelatihan + Uji Kompetensi)
// ===========================================================================

type RiwayatData = {
  angkatan: (Angkatan & { pelatihan?: Pelatihan | null })[]
  nilai: (Nilai & { ujiKompetensi?: UjiKompetensi | null })[]
}

function PesertaRiwayatView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()
  const [pesertaList, setPesertaList] = useState<Peserta[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [riwayat, setRiwayat] = useState<RiwayatData | null>(null)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)

  useEffect(() => {
    api.peserta.listAll()
      .then((r) => setPesertaList(r))
      .catch((e) => toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setListLoading(false))
  }, [toast])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const r = await api.peserta.riwayat(selectedId)
        if (!cancelled) setRiwayat(r)
      } catch (e) {
        if (!cancelled) toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedId, toast])

  const selectedPeserta = pesertaList.find((p) => p.id === selectedId) || null

  const filteredPeserta = useMemo(() => {
    if (!searchTerm.trim()) return pesertaList
    const q = searchTerm.toLowerCase()
    return pesertaList.filter((p) =>
      p.nama.toLowerCase().includes(q) ||
      p.nip.toLowerCase().includes(q) ||
      (p.unitKerja || '').toLowerCase().includes(q) ||
      (p.instansi || '').toLowerCase().includes(q)
    )
  }, [pesertaList, searchTerm])

  // Stats
  const totalPelatihan = riwayat?.angkatan.length || 0
  const totalUji = riwayat?.nilai.length || 0
  const totalLulus = riwayat?.nilai.filter((n) => n.statusKelulusan === 'LULUS').length || 0

  return (
    <div className="space-y-4">
      <PageHeader title="Riwayat Peserta" description="Lihat riwayat pelatihan dan uji kompetensi per peserta">
        <Button variant="outline" size="sm" onClick={() => setActiveView('peserta')} className="h-9">
          <ArrowRight className="w-4 h-4" /> Kembali ke Data Peserta
        </Button>
      </PageHeader>

      {/* Peserta selector */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Cari Peserta</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ketik nama / NIP / unit kerja..."
                  className="pl-9 h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Pilih Peserta</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder={listLoading ? 'Memuat daftar peserta...' : 'Pilih peserta dari daftar'} /></SelectTrigger>
                <SelectContent>
                  {filteredPeserta.length === 0 ? (
                    <SelectItem value="__none" disabled>Tidak ada peserta cocok</SelectItem>
                  ) : (
                    filteredPeserta.slice(0, 100).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nama} — {p.nip} {p.instansi ? `(${p.instansi})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedId ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Silakan pilih peserta untuk melihat riwayat pelatihan dan uji kompetensi
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="border-slate-200 shadow-sm animate-pulse"><CardContent className="p-5 h-64 bg-slate-100 rounded-xl" /></Card>
          <Card className="border-slate-200 shadow-sm animate-pulse"><CardContent className="p-5 h-64 bg-slate-100 rounded-xl" /></Card>
        </div>
      ) : !riwayat ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">Data riwayat tidak ditemukan</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Peserta info */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-slate-500">Peserta Terpilih</p>
                  <p className="text-lg font-semibold text-slate-900">{selectedPeserta?.nama || '-'}</p>
                  <p className="text-xs text-slate-400 font-mono">NIP: {selectedPeserta?.nip || '-'} · {selectedPeserta?.unitKerja || '-'} · {selectedPeserta?.instansi || '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedPeserta?.status || 'AKTIF'} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statcards */}
          <div className="grid grid-cols-3 gap-3 lg:gap-4">
            <StatCard title="Total Pelatihan" value={totalPelatihan} icon={GraduationCap} color="blue" />
            <StatCard title="Total Uji Kompetensi" value={totalUji} icon={Award} color="amber" />
            <StatCard title="Uji Lulus" value={totalLulus} icon={UserCheck} color="green" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Riwayat Pelatihan */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#0F4C81]" /> Riwayat Pelatihan
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {riwayat.angkatan.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    <GraduationCap className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Belum ada riwayat pelatihan
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Pelatihan</th>
                          <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Periode</th>
                          <th className="text-right text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Nilai</th>
                          <th className="text-center text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {riwayat.angkatan.map((a, i) => (
                          <motion.tr
                            key={a.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.03 }}
                            className="hover:bg-slate-50/50"
                          >
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-slate-900 line-clamp-1 text-sm">{a.pelatihan?.nama || a.namaAngkatan}</p>
                              <p className="text-xs text-slate-400 font-mono">{a.pelatihan?.kode || '-'} · {a.namaAngkatan}</p>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-600">
                              <p>{formatTanggalSingkat(a.tanggalMulai)}</p>
                              <p className="text-slate-400">s/d {formatTanggalSingkat(a.tanggalSelesai)}</p>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {a.peserta?.[0]?.nilaiAkhir != null ? (
                                <span className="font-semibold text-[#0F4C81]">{a.peserta[0].nilaiAkhir}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <StatusBadge status={a.status} />
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Riwayat Uji Kompetensi */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#0F4C81]" /> Riwayat Uji Kompetensi
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {riwayat.nilai.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    <Award className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Belum ada riwayat uji kompetensi
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Kode Uji</th>
                          <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Skema / Tanggal</th>
                          <th className="text-right text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Nilai</th>
                          <th className="text-center text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {riwayat.nilai.map((n, i) => (
                          <motion.tr
                            key={n.id}
                            initial={{ opacity: 0, x: 6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: i * 0.03 }}
                            className="hover:bg-slate-50/50"
                          >
                            <td className="px-4 py-2.5">
                              <span className="font-mono text-xs font-semibold text-[#0F4C81]">{n.ujiKompetensi?.kode || '-'}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-600">
                              <p className="line-clamp-1 text-slate-700">{n.ujiKompetensi?.skemaSertifikasi || '-'}</p>
                              <p className="text-slate-400">{n.ujiKompetensi ? formatTanggalSingkat(n.ujiKompetensi.tanggalUji) : '-'}</p>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {n.nilaiAkhir != null ? (
                                <span className="font-semibold text-[#0F4C81]">{n.nilaiAkhir}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <StatusBadge status={n.statusKelulusan} />
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
