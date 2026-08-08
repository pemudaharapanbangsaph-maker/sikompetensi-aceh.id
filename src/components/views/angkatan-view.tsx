'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { Angkatan, Pelatihan, Kehadiran, PesertaAngkatan } from '@/lib/types'
import type { PesertaAngkatanView } from '@/lib/api'
import { useNavStore } from '@/store/auth-store'
import { DataTable, StatCard, PageHeader, type Column, type FilterOption } from '@/components/shared/data-table'
import { StatusBadge, formatTanggal, formatTanggalSingkat, metodeLabel } from '@/components/shared/ui-helpers'
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
import { Pencil, Trash2, Plus, Save, X, CalendarCheck, Users, Eye, ArrowRight, FileSpreadsheet, FileDown, User, UserCircle, GraduationCap, Upload, Download, AlertCircle, CheckCircle2, Loader2, ClipboardList } from 'lucide-react'
import { motion } from 'framer-motion'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const METODE_ANGKATAN = [
  { value: 'TATAP_MUKA', label: 'Tatap Muka' },
  { value: 'DARING', label: 'Daring' },
  { value: 'BLENDED', label: 'Blended' },
]

const STATUS_ANGKATAN = [
  { value: 'PERENCANAAN', label: 'Perencanaan' },
  { value: 'BERJALAN', label: 'Berjalan' },
  { value: 'SELESAI', label: 'Selesai' },
  { value: 'DIBATALKAN', label: 'Dibatalkan' },
]

const STATUS_KEHADIRAN = [
  { value: 'HADIR', label: 'Hadir' },
  { value: 'SAKIT', label: 'Sakit' },
  { value: 'IZIN', label: 'Izin' },
  { value: 'ALPA', label: 'Alpa' },
]

const KEHADIRAN_STYLE: Record<string, string> = {
  HADIR: 'bg-green-50 text-[#195737] border-[#86EFAC]',
  SAKIT: 'bg-amber-50 text-amber-700 border-amber-200',
  IZIN: 'bg-blue-50 text-blue-700 border-blue-200',
  ALPA: 'bg-red-50 text-red-700 border-red-200',
}

function toDateInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function generateDates(start: string, end: string): { iso: string; label: string; sub: string }[] {
  const out: { iso: string; label: string; sub: string }[] = []
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return out
  if (e < s) return out
  const cur = new Date(s)
  while (cur <= e) {
    const iso = cur.toISOString().slice(0, 10)
    const label = cur.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
    const sub = cur.toLocaleDateString('id-ID', { weekday: 'short' })
    out.push({ iso, label, sub })
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

const EMPTY_FORM: Partial<Angkatan> = {
  pelatihanId: '',
  namaAngkatan: '',
  tanggalMulai: '',
  tanggalSelesai: '',
  lokasi: '',
  metode: 'TATAP_MUKA',
  kuota: 30,
  status: 'PERENCANAAN',
  catatan: '',
}

// ===========================================================================
// ROOT COMPONENT
// ===========================================================================

export function AngkatanView() {
  const { activeView } = useNavStore()
  if (activeView === 'pelatihan-kehadiran') return <KehadiranView />
  if (activeView === 'pelatihan-peserta-kegiatan') return <PesertaPerKegiatanView />
  return <AngkatanDataTable />
}

// ===========================================================================
// SUBTAB 1: ANGKATAN DATA TABLE (CRUD)
// ===========================================================================

function AngkatanDataTable() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()

  const [data, setData] = useState<Angkatan[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const [pelatihanList, setPelatihanList] = useState<Pelatihan[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Angkatan | null>(null)
  const [form, setForm] = useState<Partial<Angkatan>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Angkatan | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  useEffect(() => {
    api.pelatihan.listAll().then(setPelatihanList).catch(() => {})
  }, [])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => { setFilters((p) => ({ ...p, [k]: v })); setPage(1) }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const openEdit = (item: Angkatan) => {
    setEditing(item)
    setForm({
      pelatihanId: item.pelatihanId,
      namaAngkatan: item.namaAngkatan,
      tanggalMulai: toDateInput(item.tanggalMulai),
      tanggalSelesai: toDateInput(item.tanggalSelesai),
      lokasi: item.lokasi || '',
      metode: item.metode,
      kuota: item.kuota,
      status: item.status,
      catatan: item.catatan || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.pelatihanId || !form.namaAngkatan || !form.tanggalMulai || !form.tanggalSelesai) {
      toast({ title: 'Validasi', description: 'Pelatihan, nama angkatan, dan periode wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Partial<Angkatan> = {
        ...form,
        kuota: Number(form.kuota) || 0,
        tanggalMulai: form.tanggalMulai ? new Date(form.tanggalMulai).toISOString() : undefined,
        tanggalSelesai: form.tanggalSelesai ? new Date(form.tanggalSelesai).toISOString() : undefined,
      }
      if (editing) {
        await api.angkatan.update(editing.id, payload)
        toast({ title: 'Berhasil', description: 'Angkatan diperbarui' })
      } else {
        await api.angkatan.create(payload)
        toast({ title: 'Berhasil', description: 'Angkatan ditambahkan' })
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
      await api.angkatan.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Angkatan dihapus' })
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const filterOptions: FilterOption[] = [
    { key: 'status', label: 'Status', options: STATUS_ANGKATAN },
    { key: 'metode', label: 'Metode', options: METODE_ANGKATAN },
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

  return (
    <div className="space-y-4">
      <PageHeader title="Angkatan Pelatihan" description="Kelola angkatan pelatihan beserta peserta, jadwal, dan lokasi">
        <Button variant="outline" size="sm" onClick={() => setActiveView('pelatihan-kehadiran')} className="h-9">
          <CalendarCheck className="w-4 h-4" /> Kehadiran
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveView('pelatihan-peserta-kegiatan')} className="h-9">
          <Users className="w-4 h-4" /> Peserta Per Kegiatan
        </Button>
      </PageHeader>

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari nama angkatan..."
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
        emptyMessage="Belum ada data angkatan"
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
            <DialogTitle>{editing ? 'Edit Angkatan' : 'Tambah Angkatan'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Pelatihan <span className="text-red-500">*</span></Label>
              <Select value={form.pelatihanId || 'none'} onValueChange={(v) => setForm({ ...form, pelatihanId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih pelatihan..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Pilih pelatihan —</SelectItem>
                  {pelatihanList.map((p) => <SelectItem key={p.id} value={p.id}>{p.kode} - {p.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nama Angkatan <span className="text-red-500">*</span></Label>
              <Input value={form.namaAngkatan || ''} onChange={(e) => setForm({ ...form, namaAngkatan: e.target.value })} placeholder="Contoh: Angkatan I Tahun 2024" />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Mulai <span className="text-red-500">*</span></Label>
              <Input type="date" value={toDateInput(form.tanggalMulai)} onChange={(e) => setForm({ ...form, tanggalMulai: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Selesai <span className="text-red-500">*</span></Label>
              <Input type="date" value={toDateInput(form.tanggalSelesai)} onChange={(e) => setForm({ ...form, tanggalSelesai: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Lokasi</Label>
              <Input value={form.lokasi || ''} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} placeholder="Contoh: BPSDM Aceh, Banda Aceh" />
            </div>
            <div className="space-y-1.5">
              <Label>Metode</Label>
              <Select value={form.metode || 'TATAP_MUKA'} onValueChange={(v) => setForm({ ...form, metode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODE_ANGKATAN.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kuota Peserta</Label>
              <Input type="number" value={form.kuota ?? 30} onChange={(e) => setForm({ ...form, kuota: parseInt(e.target.value, 10) || 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || 'PERENCANAAN'} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_ANGKATAN.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Catatan</Label>
              <Textarea rows={3} value={form.catatan || ''} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="Catatan tambahan..." />
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
              Yakin ingin menghapus angkatan <span className="font-semibold">{deleteTarget?.namaAngkatan}</span>? Semua data peserta dan kehadiran terkait akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.
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
// SUBTAB 2: KEHADIRAN MATRIX
// ===========================================================================

function KehadiranView() {
  const { toast } = useToast()
  const [angkatanList, setAngkatanList] = useState<Angkatan[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [angkatan, setAngkatan] = useState<(Angkatan & { peserta?: PesertaAngkatanView[] }) | null>(null)
  const [kehadiran, setKehadiran] = useState<Kehadiran[]>([])
  const [matrix, setMatrix] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string>('')

  useEffect(() => {
    api.angkatan.listAll()
      .then((r) => {
        setAngkatanList(r.filter((a) => a.status !== 'DIBATALKAN'))
      })
      .catch((e) => toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }))
  }, [toast])

  useEffect(() => {
    if (!selectedId) {
      setAngkatan(null)
      setKehadiran([])
      setMatrix({})
      return
    }
    setLoading(true)
    Promise.all([api.angkatan.get(selectedId), api.angkatan.kehadiran(selectedId)])
      .then(([a, k]) => {
        setAngkatan(a)
        setKehadiran(k)
        const m: Record<string, string> = {}
        k.forEach((rec) => {
          const key = `${rec.pesertaId}_${rec.tanggal.slice(0, 10)}`
          m[key] = rec.statusKehadiran
        })
        setMatrix(m)
      })
      .catch((e) => toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [selectedId, toast])

  const dates = useMemo(() => {
    if (!angkatan) return []
    return generateDates(angkatan.tanggalMulai, angkatan.tanggalSelesai)
  }, [angkatan])

  const handleChange = async (pesertaId: string, tanggal: string, status: string) => {
    const key = `${pesertaId}_${tanggal}`
    setMatrix((prev) => ({ ...prev, [key]: status }))
    setSaving(key)
    try {
      await api.angkatan.setKehadiran(selectedId, { pesertaId, tanggal, statusKehadiran: status })
      toast({ title: 'Tersimpan', description: `Kehadiran diperbarui: ${status}`, duration: 1500 } as any)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
      setMatrix((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    } finally {
      setSaving('')
    }
  }

  const pesertaList = angkatan?.peserta || []

  // Stats
  const totalHadir = Object.values(matrix).filter((s) => s === 'HADIR').length
  const totalAlpa = Object.values(matrix).filter((s) => s === 'ALPA').length

  return (
    <div className="space-y-4">
      <PageHeader title="Kehadiran Peserta" description="Catat kehadiran peserta pelatihan per angkatan dan tanggal" />

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Pilih Angkatan</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Pilih angkatan..." /></SelectTrigger>
                <SelectContent>
                  {angkatanList.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.namaAngkatan} {a.pelatihan ? `(${a.pelatihan.kode})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {angkatan && (
              <>
                <div className="text-xs text-slate-500">
                  <p><span className="text-slate-400">Periode:</span> <span className="font-medium text-slate-700">{formatTanggalSingkat(angkatan.tanggalMulai)} s/d {formatTanggalSingkat(angkatan.tanggalSelesai)}</span></p>
                  <p><span className="text-slate-400">Metode:</span> <span className="font-medium text-slate-700">{metodeLabel(angkatan.metode)}</span></p>
                </div>
                <div className="text-xs text-slate-500">
                  <p><span className="text-slate-400">Peserta:</span> <span className="font-medium text-slate-700">{pesertaList.length} orang</span></p>
                  <p><span className="text-slate-400">Total Hari:</span> <span className="font-medium text-slate-700">{dates.length} hari</span></p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedId ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <CalendarCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Silakan pilih angkatan untuk mengisi kehadiran
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="border-slate-200 shadow-sm animate-pulse">
          <CardContent className="p-5 h-72 bg-slate-100 rounded-xl" />
        </Card>
      ) : pesertaList.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Belum ada peserta terdaftar pada angkatan ini
          </CardContent>
        </Card>
      ) : dates.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            Periode angkatan tidak valid
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <StatCard title="Total Peserta" value={pesertaList.length} icon={Users} color="blue" />
            <StatCard title="Total Hari" value={dates.length} icon={CalendarCheck} color="amber" />
            <StatCard title="Total Hadir" value={totalHadir} icon={CalendarCheck} color="green" />
            <StatCard title="Total Alpa" value={totalAlpa} icon={X} color="red" />
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-[#0F4C81]" /> Matriks Kehadiran
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="border-y border-slate-200">
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5 min-w-[200px] sticky left-0 bg-slate-50 z-10">Peserta</th>
                      {dates.map((d) => (
                        <th key={d.iso} className="text-center text-[10px] font-semibold text-slate-600 uppercase px-2 py-2 min-w-[100px]">
                          <div className="flex flex-col items-center">
                            <span className="text-slate-400">{d.sub}</span>
                            <span>{d.label}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pesertaList.map((pa) => {
                      const peserta = (pa as PesertaAngkatan).peserta
                      return (
                        <tr key={pa.pesertaId} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r border-slate-100">
                            <p className="font-medium text-slate-900 line-clamp-1">{peserta?.nama || 'N/A'}</p>
                            <p className="text-xs text-slate-400 font-mono">{peserta?.nip || ''}</p>
                          </td>
                          {dates.map((d) => {
                            const key = `${pa.pesertaId}_${d.iso}`
                            const status = matrix[key] || 'HADIR'
                            return (
                              <td key={d.iso} className="px-1 py-1 text-center">
                                <Select value={status} onValueChange={(v) => handleChange(pa.pesertaId, d.iso, v)}>
                                  <SelectTrigger className={`h-7 w-[90px] mx-auto text-[10px] border ${KEHADIRAN_STYLE[status]}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUS_KEHADIRAN.map((s) => (
                                      <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {saving === key && <Loader2 className="w-3 h-3 animate-spin text-[#0F4C81] mx-auto mt-0.5" />}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ===========================================================================
// SUBTAB 3: PESERTA PER KEGIATAN
// ===========================================================================

function PesertaPerKegiatanView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()

  const [angkatanList, setAngkatanList] = useState<Angkatan[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [selectedAngkatan, setSelectedAngkatan] = useState<Angkatan | null>(null)
  const [pesertaList, setPesertaList] = useState<PesertaAngkatanView[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [importing, setImporting] = useState(false)

  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    api.angkatan.listAll()
      .then(setAngkatanList)
      .catch(() => {})
  }, [])

  const reloadAngkatan = useCallback(() => {
    if (!selectedId) return
    api.angkatan.get(selectedId).then((a) => {
      setSelectedAngkatan(a as any)
      setPesertaList((a as any).peserta || [])
    }).catch(() => {})
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) { setSelectedAngkatan(null); setPesertaList([]); return }
    setLoading(true)
    api.angkatan.get(selectedId)
      .then((a) => {
        setSelectedAngkatan(a as any)
        setPesertaList((a as any).peserta || [])
      })
      .catch((e) => toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [selectedId, toast])

  const filteredPeserta = useMemo(() => {
    if (!search) return pesertaList
    const s = search.toLowerCase()
    return pesertaList.filter((pa) => {
      const p = (pa as PesertaAngkatan).peserta
      return p?.nama?.toLowerCase().includes(s) || p?.nip?.includes(s)
    })
  }, [pesertaList, search])

  // ===== EXPORT =====
  const handleExportPdf = async () => {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/angkatan/${selectedId}/peserta/export/pdf`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Export gagal')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `peserta-${selectedAngkatan?.namaAngkatan || 'kegiatan'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'Gagal Export', description: e instanceof Error ? e.message : 'Terjadi kesalahan', variant: 'destructive', duration: 3000 } as any)
    }
  }

  const handleExportXls = async () => {
    if (!selectedId) return
    try {
      const res = await fetch(`/api/angkatan/${selectedId}/peserta/export/xls`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Export gagal')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `peserta-${selectedAngkatan?.namaAngkatan || 'kegiatan'}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'Gagal Export', description: e instanceof Error ? e.message : 'Terjadi kesalahan', variant: 'destructive', duration: 3000 } as any)
    }
  }

  // ===== IMPORT =====
  const handleImport = async () => {
    if (!selectedId || !importFile) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await api.angkatan.importPeserta(selectedId, importFile)
      setImportResult(result)
      if (result.created > 0 || result.updated > 0) {
        toast({ title: 'Import Berhasil', description: result.message, duration: 4000 } as any)
        reloadAngkatan()
      }
    } catch (e) {
      toast({ title: 'Gagal Import', description: e instanceof Error ? e.message : 'Terjadi kesalahan', variant: 'destructive', duration: 4000 } as any)
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadTemplate = () => {
    if (!selectedId) return
    api.angkatan.downloadPesertaTemplate(selectedId)
  }

  const openImportDialog = () => {
    setImportFile(null)
    setImportResult(null)
    setImportOpen(true)
  }

  // ===== SYNC DARI PENDAFTAR =====
  const handleSyncPendaftar = async () => {
    if (!selectedId) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch(`/api/angkatan/${selectedId}/sync-pendaftar`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal sinkronisasi')
      setSyncResult(data)
      if (data.added > 0) {
        toast({ title: 'Sinkronisasi Berhasil', description: data.message, duration: 4000 } as any)
        reloadAngkatan()
      }
    } catch (e) {
      toast({ title: 'Gagal Sinkronisasi', description: e instanceof Error ? e.message : 'Terjadi kesalahan', variant: 'destructive', duration: 4000 } as any)
    } finally {
      setSyncing(false)
      setSyncDialogOpen(true)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Peserta Per Kegiatan" description="Lihat dan kelola data peserta per kegiatan/angkatan pelatihan" />

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-3">
          {/* Dropdown - full width, standalone row */}
          <div>
            <Label className="mb-1.5 block">Pilih Kegiatan (Angkatan)</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Pilih kegiatan..." /></SelectTrigger>
              <SelectContent>
                {angkatanList.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="line-clamp-1">{a.namaAngkatan} {a.pelatihan ? `(${a.pelatihan.kode})` : ''}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info + tombol aksi - separate row */}
          {selectedAngkatan && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div className="text-xs text-slate-500">
                <p><span className="text-slate-400">Periode:</span> <span className="font-medium text-slate-700">{formatTanggalSingkat(selectedAngkatan.tanggalMulai)} s/d {formatTanggalSingkat(selectedAngkatan.tanggalSelesai)}</span></p>
                <p><span className="text-slate-400">Lokasi:</span> <span className="font-medium text-slate-700">{selectedAngkatan.lokasi || '-'}</span></p>
              </div>
              <div className="text-xs text-slate-500">
                <p><span className="text-slate-400">Metode:</span> <span className="font-medium text-slate-700">{metodeLabel(selectedAngkatan.metode)}</span></p>
                <p><span className="text-slate-400">Status:</span> <span className="font-medium text-slate-700">{STATUS_ANGKATAN.find((s) => s.value === selectedAngkatan.status)?.label || selectedAngkatan.status}</span></p>
              </div>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <Button onClick={handleSyncPendaftar} disabled={syncing || !selectedAngkatan?.pelatihan} size="sm" variant="outline" className="h-9 border-[#195737] text-[#195737] hover:bg-[#195737] hover:text-white">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />} Ambil Data Pendaftar
                </Button>
                <Button onClick={openImportDialog} size="sm" variant="outline" className="h-9 border-[#195737] text-[#195737] hover:bg-[#195737] hover:text-white">
                  <Upload className="w-4 h-4" /> Import
                </Button>
                <Button onClick={handleDownloadTemplate} size="sm" variant="outline" className="h-9 border-slate-300 text-slate-600 hover:bg-slate-50">
                  <Download className="w-4 h-4" /> Template
                </Button>
                <Button onClick={handleExportXls} disabled={!selectedId || pesertaList.length === 0} size="sm" variant="outline" className="h-9">
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </Button>
                <Button onClick={handleExportPdf} disabled={!selectedId || pesertaList.length === 0} size="sm" className="bg-[#0F4C81] hover:bg-[#0a3a63] h-9">
                  <FileDown className="w-4 h-4" /> PDF
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
            {!selectedId ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Silakan pilih kegiatan (angkatan) untuk melihat data peserta
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="border-slate-200 shadow-sm animate-pulse">
          <CardContent className="p-5 h-72 bg-slate-100 rounded-xl" />
        </Card>
      ) : pesertaList.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Belum ada peserta terdaftar pada kegiatan ini
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
            <StatCard title="Total Peserta" value={pesertaList.length} icon={Users} color="blue" />
            <StatCard title="Laki-laki" value={pesertaList.filter((pa) => (pa as PesertaAngkatan).peserta?.jenisKelamin === 'L').length} icon={User} color="purple" />
            <StatCard title="Perempuan" value={pesertaList.filter((pa) => (pa as PesertaAngkatan).peserta?.jenisKelamin === 'P').length} icon={UserCircle} color="red" />
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-base">Daftar Peserta — {angkatan?.namaAngkatan}</CardTitle>
                <Input
                  placeholder="Cari nama/NIP..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-[220px] h-8 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" style={{ minWidth: '1100px' }}>
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="border-y border-slate-200">
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5" style={{ width: 40 }}>No</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5" style={{ width: 120 }}>NIP</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5" style={{ width: 170 }}>Nama</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-3 py-2.5" style={{ width: 40 }}>L/P</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5" style={{ width: 150 }}>Jabatan</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5" style={{ width: 100 }}>Pangkat/Gol.</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5" style={{ width: 180 }}>Unit Kerja</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5" style={{ width: 160 }}>Instansi</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-3 py-2.5" style={{ width: 80 }}>Nilai Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPeserta.map((pa, idx) => {
                      const peserta = (pa as PesertaAngkatan).peserta
                      const st = STATUS_PESERTA_ANGKATAN[pa.status] || STATUS_PESERTA_ANGKATAN.TERDAFTAR
                      return (
                        <motion.tr
                          key={pa.pesertaId}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15, delay: idx * 0.03 }}
                          className="hover:bg-slate-50/50"
                        >
                          <td className="px-3 py-2 text-slate-500 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600 whitespace-nowrap">{peserta?.nip || '-'}</td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-900 whitespace-nowrap truncate">{peserta?.nama || 'N/A'}</p>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 text-center">{peserta?.jenisKelamin || '-'}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap truncate">{peserta?.jabatan || '-'}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{peserta?.pangkatGolongan || '-'}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap truncate">{peserta?.unitKerja || '-'}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap truncate">{peserta?.instansi || '-'}</td>
                          <td className="px-3 py-2 text-center text-xs font-semibold text-slate-700">{pa.nilaiAkhir != null ? pa.nilaiAkhir : '-'}</td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
                Menampilkan {filteredPeserta.length} dari {pesertaList.length} peserta
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== IMPORT DIALOG ===== */}
      <Dialog open={importOpen} onOpenChange={(v) => { if (!v) { setImportOpen(false); setImportFile(null); setImportResult(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#195737]" />
              Import Peserta
            </DialogTitle>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Petunjuk:</p>
                <p>1. Klik <span className="font-medium text-[#195737]">"Template"</span> untuk mengunduh format Excel yang benar</p>
                <p>2. Isi data peserta di file template sesuai kolom yang tersedia</p>
                <p>3. Upload file yang sudah diisi untuk menambahkan peserta ke angkatan ini</p>
                <p className="text-amber-600">Kolom wajib: <strong>NIP</strong>, <strong>Nama</strong>, <strong>L/P</strong></p>
              </div>

              <div>
                <Label className="mb-1.5 block">Upload File Excel (.xlsx)</Label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      setImportFile(f)
                      setImportResult(null)
                    }}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#195737]/10 file:text-[#195737] hover:file:bg-[#195737]/20 cursor-pointer"
                  />
                </div>
                {importFile && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    File: <span className="font-medium text-slate-700">{importFile.name}</span> ({(importFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="outline" onClick={() => { setImportOpen(false); setImportFile(null) }}>
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="bg-[#195737] hover:bg-[#0F4227]"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Mengimpor...' : 'Import Data'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`rounded-lg border p-4 ${importResult.created > 0 || importResult.updated > 0 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-start gap-3">
                  {(importResult.created > 0 || importResult.updated > 0) ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-slate-800">Hasil Import</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-700">{importResult.created}</p>
                        <p className="text-xs text-slate-500">Ditambahkan</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-700">{importResult.updated}</p>
                        <p className="text-xs text-slate-500">Diperbarui</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-slate-500">{importResult.skipped}</p>
                        <p className="text-xs text-slate-500">Dilewati</p>
                      </div>
                    </div>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-2 p-2 bg-white/60 rounded border border-amber-200">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Peringatan:</p>
                        <div className="max-h-24 overflow-y-auto space-y-0.5">
                          {importResult.errors.map((err: string, idx: number) => (
                            <p key={idx} className="text-[11px] text-amber-600">{err}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => { setImportOpen(false); setImportFile(null); setImportResult(null) }}>
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== SYNC DARI PENDAFTAR DIALOG ===== */}
      <Dialog open={syncDialogOpen} onOpenChange={(v) => { if (!v) setSyncDialogOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#195737]" />
              Hasil Sinkronisasi Data Pendaftar
            </DialogTitle>
          </DialogHeader>
          {syncResult ? (
            <div className="space-y-4">
              <div className={`rounded-lg border p-4 ${syncResult.added > 0 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-start gap-3">
                  {syncResult.added > 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-3 text-sm flex-1">
                    <p className="font-semibold text-slate-800">Ringkasan</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-700">{syncResult.added}</p>
                        <p className="text-xs text-slate-500">Ditambahkan</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-slate-500">{syncResult.skipped}</p>
                        <p className="text-xs text-slate-500">Sudah Ada</p>
                      </div>
                    </div>
                    {syncResult.skippedNames.length > 0 && (
                      <div className="p-2 bg-white/60 rounded border border-slate-200">
                        <p className="text-xs font-semibold text-slate-600 mb-1">Yang sudah ada di angkatan:</p>
                        <div className="max-h-24 overflow-y-auto space-y-0.5">
                          {syncResult.skippedNames.map((name: string, idx: number) => (
                            <p key={idx} className="text-[11px] text-slate-500">• {name}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">Data diambil dari pendaftar berstatus <strong>DITERIMA</strong> yang pelatihannya cocok dengan angkatan ini</p>
              <DialogFooter>
                <Button onClick={() => setSyncDialogOpen(false)}>Tutup</Button>
              </DialogFooter>
            </div>
          ) : syncing ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#195737]" />
              <p className="text-sm text-slate-600">Mengambil data pendaftar...</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
