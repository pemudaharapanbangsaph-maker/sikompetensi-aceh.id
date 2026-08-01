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
import { Pencil, Trash2, Plus, Save, X, CalendarCheck, Image as ImageIcon, Users, Eye, Upload, ArrowRight } from 'lucide-react'
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
  HADIR: 'bg-green-50 text-green-700 border-green-200',
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
  if (activeView === 'pelatihan-dokumentasi') return <DokumentasiView />
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
        <Button variant="outline" size="sm" onClick={() => setActiveView('pelatihan-dokumentasi')} className="h-9">
          <ImageIcon className="w-4 h-4" /> Dokumentasi
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
              Yakin ingin menghapus angkatan <span className="font-semibold">{deleteTarget?.namaAngkatan}</span>? Semua data peserta, kehadiran, dan dokumentasi terkait akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.
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
                                    {STATUS_KEHADIRAN.map((o) => (
                                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {saving === key && <span className="text-[9px] text-amber-600">...</span>}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
                <span className="text-slate-500">Keterangan:</span>
                {STATUS_KEHADIRAN.map((s) => (
                  <span key={s.value} className={`inline-flex items-center rounded border px-2 py-0.5 ${KEHADIRAN_STYLE[s.value]}`}>
                    {s.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ===========================================================================
// SUBTAB 3: DOKUMENTASI (mock gallery)
// ===========================================================================

interface MockDoc {
  id: string
  angkatanId: string
  judul: string
  deskripsi: string
  createdAt: string
}

function DokumentasiView() {
  const { toast } = useToast()
  const [angkatanList, setAngkatanList] = useState<Angkatan[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [docs, setDocs] = useState<Record<string, MockDoc[]>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.angkatan.listAll()
      .then(setAngkatanList)
      .catch((e) => toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }))
  }, [toast])

  const selectedAngkatan = angkatanList.find((a) => a.id === selectedId) || null
  const selectedDocs = selectedId ? (docs[selectedId] || []) : []

  const handleUpload = async () => {
    if (!judul) {
      toast({ title: 'Validasi', description: 'Judul dokumentasi wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    // Mock: just record judul + deskripsi locally
    await new Promise((r) => setTimeout(r, 400))
    const newDoc: MockDoc = {
      id: `mock-${Date.now()}`,
      angkatanId: selectedId,
      judul,
      deskripsi,
      createdAt: new Date().toISOString(),
    }
    setDocs((prev) => ({ ...prev, [selectedId]: [newDoc, ...(prev[selectedId] || [])] }))
    setJudul('')
    setDeskripsi('')
    setSaving(false)
    setDialogOpen(false)
    toast({ title: 'Berhasil', description: 'Dokumentasi ditambahkan (mock)' })
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Dokumentasi Pelatihan" description="Galeri dokumentasi kegiatan per angkatan pelatihan" />

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 grid sm:grid-cols-2 gap-3 items-end">
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
          {selectedAngkatan && (
            <div className="flex items-end justify-end">
              <Button onClick={() => setDialogOpen(true)} className="bg-[#0F4C81] hover:bg-[#0a3a63] h-9">
                <Upload className="w-4 h-4" /> Upload Dokumentasi
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedId ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Silakan pilih angkatan untuk melihat dokumentasi
          </CardContent>
        </Card>
      ) : selectedDocs.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Belum ada dokumentasi pada angkatan ini
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedDocs.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
            >
              <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-[#0F4C81]/10 to-[#198754]/10 flex items-center justify-center">
                  <ImageIcon className="w-10 h-10 text-[#0F4C81]/30" />
                </div>
                <CardContent className="p-4">
                  <p className="font-semibold text-slate-900 text-sm line-clamp-1">{d.judul}</p>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1 min-h-[2.5rem]">{d.deskripsi || 'Tanpa deskripsi'}</p>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">{formatTanggal(d.createdAt)}</span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                      {metodeLabel(selectedAngkatan?.metode || '')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Dialog (mock) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Dokumentasi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Judul <span className="text-red-500">*</span></Label>
              <Input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Contoh: Foto Kegiatan Hari 1" />
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea rows={3} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder="Deskripsi singkat dokumentasi..." />
            </div>
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
              <Upload className="w-6 h-6 mx-auto mb-1 text-slate-400" />
              Mode mock — file tidak diunggah. Hanya judul & deskripsi yang disimpan.
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}><X className="w-4 h-4" /> Batal</Button>
            </DialogClose>
            <Button onClick={handleUpload} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63]">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
