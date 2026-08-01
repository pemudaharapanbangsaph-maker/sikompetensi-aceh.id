'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Pelatihan, Angkatan } from '@/lib/types'
import { useNavStore } from '@/store/auth-store'
import { DataTable, StatCard, PageHeader, type Column, type FilterOption } from '@/components/shared/data-table'
import { StatusBadge, formatTanggal, formatTanggalSingkat, kategoriLabel, metodeLabel } from '@/components/shared/ui-helpers'
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
import { Pencil, Trash2, Plus, Save, X, BookOpen, Calendar, Archive, Eye, Clock } from 'lucide-react'
import { motion } from 'framer-motion'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const KATEGORI_PELATIHAN = [
  { value: 'TEKNIS', label: 'Teknis' },
  { value: 'MANAJERIAL', label: 'Manajerial' },
  { value: 'FUNGSIONAL', label: 'Fungsional' },
  { value: 'SOSIAL_KULTURAL', label: 'Sosial Kultural' },
]

const STATUS_PELATIHAN = [
  { value: 'AKTIF', label: 'Aktif' },
  { value: 'NONAKTIF', label: 'Nonaktif' },
]

const EMPTY_FORM: Partial<Pelatihan> = {
  kode: '',
  nama: '',
  kategori: 'TEKNIS',
  deskripsi: '',
  durasiHari: 1,
  jp: 8,
  status: 'AKTIF',
}

// ===========================================================================
// ROOT COMPONENT
// ===========================================================================

export function PelatihanView() {
  const { activeView } = useNavStore()
  if (activeView === 'pelatihan-jadwal') return <PelatihanJadwalView />
  if (activeView === 'pelatihan-arsip') return <PelatihanArsipView />
  return <PelatihanDataTable />
}

// ===========================================================================
// SUBTAB 1: PELATIHAN DATA TABLE (CRUD)
// ===========================================================================

function PelatihanDataTable() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()

  const [data, setData] = useState<Pelatihan[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Pelatihan | null>(null)
  const [form, setForm] = useState<Partial<Pelatihan>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Pelatihan | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        kategori: filters.kategori || undefined,
        status: filters.status || undefined,
      }
      const res = await api.pelatihan.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filters, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => { setFilters((p) => ({ ...p, [k]: v })); setPage(1) }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const openEdit = (item: Pelatihan) => {
    setEditing(item)
    setForm({
      kode: item.kode,
      nama: item.nama,
      kategori: item.kategori,
      deskripsi: item.deskripsi || '',
      durasiHari: item.durasiHari,
      jp: item.jp,
      status: item.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.kode || !form.nama) {
      toast({ title: 'Validasi', description: 'Kode dan Nama pelatihan wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Partial<Pelatihan> = {
        ...form,
        durasiHari: Number(form.durasiHari) || 1,
        jp: Number(form.jp) || 0,
      }
      if (editing) {
        await api.pelatihan.update(editing.id, payload)
        toast({ title: 'Berhasil', description: 'Pelatihan diperbarui' })
      } else {
        await api.pelatihan.create(payload)
        toast({ title: 'Berhasil', description: 'Pelatihan ditambahkan' })
      }
      setDialogOpen(false)
      fetchData()
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
      await api.pelatihan.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Pelatihan dihapus' })
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const filterOptions: FilterOption[] = [
    { key: 'kategori', label: 'Kategori', options: KATEGORI_PELATIHAN },
    { key: 'status', label: 'Status', options: STATUS_PELATIHAN },
  ]

  const columns: Column<Pelatihan>[] = [
    { key: 'kode', header: 'Kode', render: (r) => <span className="font-mono text-xs font-semibold text-[#0F4C81]">{r.kode}</span> },
    {
      key: 'nama', header: 'Nama Pelatihan', render: (r) => (
        <div className="min-w-[220px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.nama}</p>
          {r.deskripsi && <p className="text-xs text-slate-400 line-clamp-1">{r.deskripsi}</p>}
        </div>
      ),
    },
    { key: 'kategori', header: 'Kategori', render: (r) => <span className="text-slate-600">{kategoriLabel(r.kategori)}</span> },
    { key: 'durasiHari', header: 'Durasi', render: (r) => <span className="text-slate-600">{r.durasiHari} hari</span> },
    { key: 'jp', header: 'JP', render: (r) => <span className="font-medium">{r.jp} JP</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Data Pelatihan" description="Kelola master data pelatihan dan kurikulum">
        <Button variant="outline" size="sm" onClick={() => setActiveView('pelatihan-jadwal')} className="h-9">
          <Calendar className="w-4 h-4" /> Jadwal
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveView('pelatihan-arsip')} className="h-9">
          <Archive className="w-4 h-4" /> Arsip
        </Button>
      </PageHeader>

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari kode / nama pelatihan..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        filters={filterOptions}
        filterValues={filters}
        onFilterChange={handleFilter}
        onAdd={openCreate}
        addLabel="Tambah"
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data pelatihan"
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pelatihan' : 'Tambah Pelatihan'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Kode <span className="text-red-500">*</span></Label>
              <Input value={form.kode || ''} onChange={(e) => setForm({ ...form, kode: e.target.value })} placeholder="Contoh: PL-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={form.kategori || 'TEKNIS'} onValueChange={(v) => setForm({ ...form, kategori: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KATEGORI_PELATIHAN.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nama Pelatihan <span className="text-red-500">*</span></Label>
              <Input value={form.nama || ''} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama lengkap pelatihan" />
            </div>
            <div className="space-y-1.5">
              <Label>Durasi (Hari)</Label>
              <Input type="number" value={form.durasiHari ?? 1} onChange={(e) => setForm({ ...form, durasiHari: parseInt(e.target.value, 10) || 1 })} />
            </div>
            <div className="space-y-1.5">
              <Label>Jumlah JP</Label>
              <Input type="number" value={form.jp ?? 8} onChange={(e) => setForm({ ...form, jp: parseInt(e.target.value, 10) || 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || 'AKTIF'} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_PELATIHAN.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea rows={3} value={form.deskripsi || ''} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder="Deskripsi singkat pelatihan..." />
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
              Yakin ingin menghapus pelatihan <span className="font-semibold">{deleteTarget?.nama}</span>? Semua angkatan terkait juga akan dihapus. Tindakan ini tidak dapat dibatalkan.
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
// SUBTAB 2: JADWAL PELATIHAN (read-only list of angkatan)
// ===========================================================================

function PelatihanJadwalView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()
  const [data, setData] = useState<Angkatan[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        status: filters.status || undefined,
        metode: filters.metode || undefined,
      }
      const res = await api.angkatan.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filters, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => { setFilters((p) => ({ ...p, [k]: v })); setPage(1) }

  const filterOptions: FilterOption[] = [
    {
      key: 'status', label: 'Status', options: [
        { value: 'PERENCANAAN', label: 'Perencanaan' },
        { value: 'BERJALAN', label: 'Berjalan' },
        { value: 'SELESAI', label: 'Selesai' },
        { value: 'DIBATALKAN', label: 'Dibatalkan' },
      ],
    },
    {
      key: 'metode', label: 'Metode', options: [
        { value: 'TATAP_MUKA', label: 'Tatap Muka' },
        { value: 'DARING', label: 'Daring' },
        { value: 'BLENDED', label: 'Blended' },
      ],
    },
  ]

  const columns: Column<Angkatan>[] = [
    {
      key: 'namaAngkatan', header: 'Angkatan', render: (r) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.namaAngkatan}</p>
          <p className="text-xs text-slate-400 line-clamp-1">{r.pelatihan?.nama || '-'}</p>
        </div>
      ),
    },
    { key: 'pelatihan', header: 'Pelatihan', render: (r) => <span className="font-mono text-xs text-[#0F4C81]">{r.pelatihan?.kode || '-'}</span> },
    {
      key: 'tanggalMulai', header: 'Periode', render: (r) => (
        <div className="text-xs text-slate-600 min-w-[160px]">
          <p>{formatTanggalSingkat(r.tanggalMulai)}</p>
          <p className="text-slate-400">s/d {formatTanggalSingkat(r.tanggalSelesai)}</p>
        </div>
      ),
    },
    { key: 'lokasi', header: 'Lokasi', render: (r) => <span className="text-slate-600 text-xs">{r.lokasi || '-'}</span> },
    { key: 'metode', header: 'Metode', render: (r) => <span className="text-slate-600 text-xs">{metodeLabel(r.metode)}</span> },
    {
      key: 'kuota', header: 'Kuota / Peserta', render: (r) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-900">{r._count?.peserta || 0}</span>
          <span className="text-slate-400"> / {r.kuota}</span>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  const totalBerjalan = data.filter((d) => d.status === 'BERJALAN').length
  const totalPerencanaan = data.filter((d) => d.status === 'PERENCANAAN').length

  return (
    <div className="space-y-4">
      <PageHeader title="Jadwal Pelatihan" description="Daftar jadwal angkatan pelatihan yang akan/tengah berlangsung">
        <Button variant="outline" size="sm" onClick={() => setActiveView('pelatihan')} className="h-9">
          <BookOpen className="w-4 h-4" /> Master Pelatihan
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <StatCard title="Total Angkatan" value={total} icon={Calendar} color="blue" />
        <StatCard title="Sedang Berjalan" value={totalBerjalan} icon={Clock} color="amber" />
        <StatCard title="Dalam Perencanaan" value={totalPerencanaan} icon={BookOpen} color="green" />
      </div>

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari nama angkatan / pelatihan..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        filters={filterOptions}
        filterValues={filters}
        onFilterChange={handleFilter}
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada jadwal angkatan"
      />
    </div>
  )
}

// ===========================================================================
// SUBTAB 3: ARSIP (read-only list of SELESAI angkatan)
// ===========================================================================

function PelatihanArsipView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()
  const [data, setData] = useState<Angkatan[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [detailTarget, setDetailTarget] = useState<Angkatan | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search, status: 'SELESAI',
      }
      const res = await api.angkatan.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  const columns: Column<Angkatan>[] = [
    {
      key: 'namaAngkatan', header: 'Angkatan', render: (r) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.namaAngkatan}</p>
          <p className="text-xs text-slate-400 line-clamp-1">{r.pelatihan?.nama || '-'}</p>
        </div>
      ),
    },
    { key: 'pelatihan', header: 'Kode', render: (r) => <span className="font-mono text-xs text-[#0F4C81]">{r.pelatihan?.kode || '-'}</span> },
    {
      key: 'tanggalMulai', header: 'Periode', render: (r) => (
        <div className="text-xs text-slate-600 min-w-[160px]">
          <p>{formatTanggalSingkat(r.tanggalMulai)}</p>
          <p className="text-slate-400">s/d {formatTanggalSingkat(r.tanggalSelesai)}</p>
        </div>
      ),
    },
    { key: 'lokasi', header: 'Lokasi', render: (r) => <span className="text-slate-600 text-xs">{r.lokasi || '-'}</span> },
    { key: 'metode', header: 'Metode', render: (r) => <span className="text-slate-600 text-xs">{metodeLabel(r.metode)}</span> },
    {
      key: 'peserta', header: 'Peserta', render: (r) => (
        <span className="text-xs font-semibold">{r._count?.peserta || 0} orang</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Arsip Pelatihan" description="Riwayat angkatan pelatihan yang telah selesai dilaksanakan">
        <Button variant="outline" size="sm" onClick={() => setActiveView('pelatihan')} className="h-9">
          <BookOpen className="w-4 h-4" /> Master Pelatihan
        </Button>
      </PageHeader>

      <StatCard title="Total Arsip" value={total} icon={Archive} color="purple" subtitle="Angkatan selesai" />

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari nama angkatan / pelatihan..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada arsip pelatihan"
        actions={(row) => (
          <Button size="sm" variant="ghost" className="h-8 px-2 text-[#0F4C81]" onClick={() => setDetailTarget(row)} title="Lihat Detail">
            <Eye className="w-4 h-4" /> Detail
          </Button>
        )}
      />

      {/* Detail Dialog */}
      <Dialog open={!!detailTarget} onOpenChange={(o) => !o && setDetailTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Angkatan</DialogTitle>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-3 py-2">
              <DetailRow label="Nama Angkatan" value={detailTarget.namaAngkatan} />
              <DetailRow label="Pelatihan" value={detailTarget.pelatihan ? `${detailTarget.pelatihan.kode} - ${detailTarget.pelatihan.nama}` : '-'} />
              <DetailRow label="Kategori" value={detailTarget.pelatihan ? kategoriLabel(detailTarget.pelatihan.kategori) : '-'} />
              <DetailRow label="Periode" value={`${formatTanggal(detailTarget.tanggalMulai)} s/d ${formatTanggal(detailTarget.tanggalSelesai)}`} />
              <DetailRow label="Lokasi" value={detailTarget.lokasi || '-'} />
              <DetailRow label="Metode" value={metodeLabel(detailTarget.metode)} />
              <DetailRow label="Kuota" value={`${detailTarget.kuota} peserta`} />
              <DetailRow label="Jumlah Peserta" value={`${detailTarget._count?.peserta || 0} peserta`} />
              <DetailRow label="Status" value={<StatusBadge status={detailTarget.status} />} />
              {detailTarget.catatan && <DetailRow label="Catatan" value={detailTarget.catatan} />}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline"><X className="w-4 h-4" /> Tutup</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm py-1.5 border-b border-slate-100 last:border-0">
      <p className="text-slate-500">{label}</p>
      <p className="col-span-2 text-slate-900 font-medium">{value}</p>
    </div>
  )
}
