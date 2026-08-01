'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { AnalisisKebutuhan, Pelatihan } from '@/lib/types'
import { useNavStore } from '@/store/auth-store'
import { DataTable, StatCard, PageHeader, type Column, type FilterOption } from '@/components/shared/data-table'
import { StatusBadge, formatTanggal, kategoriLabel } from '@/components/shared/ui-helpers'
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
import { Pencil, Trash2, Plus, Save, X, ClipboardList, AlertTriangle, ArrowUp, ArrowRight, BarChart3, FileBarChart } from 'lucide-react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const JENIS_KOMPETENSI = [
  { value: 'TEKNIS', label: 'Teknis' },
  { value: 'MANAJERIAL', label: 'Manajerial' },
  { value: 'FUNGSIONAL', label: 'Fungsional' },
  { value: 'SOSIAL_KULTURAL', label: 'Sosial Kultural' },
]

const TINGKAT_KEBUTUHAN = [
  { value: 'RENDAH', label: 'Rendah' },
  { value: 'SEDANG', label: 'Sedang' },
  { value: 'TINGGI', label: 'Tinggi' },
  { value: 'SANGAT_TINGGI', label: 'Sangat Tinggi' },
]

const PRIORITAS = [
  { value: 'URGENT', label: 'Urgent' },
  { value: 'TINGGI', label: 'Tinggi' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'RENDAH', label: 'Rendah' },
]

const STATUS_ANALISIS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'DISETUJUI', label: 'Disetujui' },
  { value: 'DITOLAK', label: 'Ditolak' },
  { value: 'SELESAI', label: 'Selesai' },
]

const PRIORITAS_BADGE: Record<string, { label: string; className: string }> = {
  URGENT: { label: 'Urgent', className: 'bg-red-100 text-red-700 border-red-200' },
  TINGGI: { label: 'Tinggi', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  NORMAL: { label: 'Normal', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  RENDAH: { label: 'Rendah', className: 'bg-slate-100 text-slate-700 border-slate-200' },
}

const PRIORITAS_ORDER: Record<string, number> = { URGENT: 0, TINGGI: 1, NORMAL: 2, RENDAH: 3 }

function PrioritasBadge({ prioritas }: { prioritas: string }) {
  const item = PRIORITAS_BADGE[prioritas] || { label: prioritas, className: 'bg-slate-100 text-slate-700 border-slate-200' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${item.className}`}>
      {item.label}
    </span>
  )
}

function TingkatBadge({ tingkat }: { tingkat: string }) {
  const map: Record<string, string> = {
    RENDAH: 'bg-slate-100 text-slate-700 border-slate-200',
    SEDANG: 'bg-blue-100 text-blue-700 border-blue-200',
    TINGGI: 'bg-orange-100 text-orange-700 border-orange-200',
    SANGAT_TINGGI: 'bg-red-100 text-red-700 border-red-200',
  }
  const labelMap: Record<string, string> = {
    RENDAH: 'Rendah', SEDANG: 'Sedang', TINGGI: 'Tinggi', SANGAT_TINGGI: 'Sangat Tinggi',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[tingkat] || map.SEDANG}`}>
      {labelMap[tingkat] || tingkat}
    </span>
  )
}

const EMPTY_FORM: Partial<AnalisisKebutuhan> = {
  judul: '',
  tahun: new Date().getFullYear(),
  unitKerja: '',
  jenisKompetensi: 'TEKNIS',
  jumlahPegawai: 0,
  tingkatKebutuhan: 'SEDANG',
  prioritas: 'NORMAL',
  pelatihanId: null,
  catatan: '',
  status: 'DRAFT',
}

// ===========================================================================
// ROOT COMPONENT
// ===========================================================================

export function AnalisisView() {
  const { activeView } = useNavStore()

  if (activeView === 'analisis-input') return <AnalisisInputForm />
  if (activeView === 'analisis-prioritas') return <AnalisisPrioritasView />
  if (activeView === 'analisis-rekap') return <AnalisisRekapView />
  return <AnalisisDataTable />
}

// ===========================================================================
// SUBTAB 1: DATA TABLE WITH CRUD
// ===========================================================================

function AnalisisDataTable() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()

  const [data, setData] = useState<AnalisisKebutuhan[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [pelatihanList, setPelatihanList] = useState<Pelatihan[]>([])

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AnalisisKebutuhan | null>(null)
  const [form, setForm] = useState<Partial<AnalisisKebutuhan>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<AnalisisKebutuhan | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        tahun: filters.tahun || undefined,
        status: filters.status || undefined,
        prioritas: filters.prioritas || undefined,
        jenisKompetensi: filters.jenisKompetensi || undefined,
      }
      const res = await api.analisis.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filters, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    api.pelatihan.listAll().then(setPelatihanList).catch(() => {})
  }, [])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }))
    setPage(1)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, tahun: new Date().getFullYear() })
    setDialogOpen(true)
  }

  const openEdit = (item: AnalisisKebutuhan) => {
    setEditing(item)
    setForm({
      judul: item.judul,
      tahun: item.tahun,
      unitKerja: item.unitKerja,
      jenisKompetensi: item.jenisKompetensi,
      jumlahPegawai: item.jumlahPegawai,
      tingkatKebutuhan: item.tingkatKebutuhan,
      prioritas: item.prioritas,
      pelatihanId: item.pelatihanId || null,
      catatan: item.catatan || '',
      status: item.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.judul || !form.unitKerja) {
      toast({ title: 'Validasi', description: 'Judul dan Unit Kerja wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Partial<AnalisisKebutuhan> = {
        ...form,
        tahun: Number(form.tahun) || new Date().getFullYear(),
        jumlahPegawai: Number(form.jumlahPegawai) || 0,
        pelatihanId: form.pelatihanId === 'none' || !form.pelatihanId ? null : form.pelatihanId,
      }
      if (editing) {
        await api.analisis.update(editing.id, payload)
        toast({ title: 'Berhasil', description: 'Analisis kebutuhan diperbarui' })
      } else {
        await api.analisis.create(payload)
        toast({ title: 'Berhasil', description: 'Analisis kebutuhan ditambahkan' })
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
      await api.analisis.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Analisis kebutuhan dihapus' })
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const filterOptions: FilterOption[] = [
    { key: 'status', label: 'Status', options: STATUS_ANALISIS },
    { key: 'prioritas', label: 'Prioritas', options: PRIORITAS },
    { key: 'jenisKompetensi', label: 'Jenis', options: JENIS_KOMPETENSI },
  ]

  const columns: Column<AnalisisKebutuhan>[] = [
    {
      key: 'judul', header: 'Judul', render: (r) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.judul}</p>
          <p className="text-xs text-slate-400 line-clamp-1">{r.catatan || '-'}</p>
        </div>
      ),
    },
    { key: 'unitKerja', header: 'Unit Kerja', render: (r) => <span className="text-slate-600">{r.unitKerja}</span> },
    { key: 'tahun', header: 'Tahun', render: (r) => <span className="font-medium">{r.tahun}</span> },
    { key: 'jenisKompetensi', header: 'Jenis', render: (r) => <span className="text-slate-600">{kategoriLabel(r.jenisKompetensi)}</span> },
    { key: 'jumlahPegawai', header: 'Pegawai', render: (r) => <span className="font-medium">{r.jumlahPegawai}</span> },
    { key: 'tingkatKebutuhan', header: 'Tingkat', render: (r) => <TingkatBadge tingkat={r.tingkatKebutuhan} /> },
    { key: 'prioritas', header: 'Prioritas', render: (r) => <PrioritasBadge prioritas={r.prioritas} /> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Analisis Kebutuhan Kompetensi" description="Kelola data analisis kebutuhan kompetensi pegawai">
        <Button variant="outline" size="sm" onClick={() => setActiveView('analisis-input')} className="h-9">
          <Plus className="w-4 h-4" /> Input Baru
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveView('analisis-prioritas')} className="h-9">
          <AlertTriangle className="w-4 h-4" /> Prioritas
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveView('analisis-rekap')} className="h-9">
          <BarChart3 className="w-4 h-4" /> Rekap
        </Button>
      </PageHeader>

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari judul / unit kerja..."
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
        emptyMessage="Belum ada analisis kebutuhan"
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
      <AnalisisFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        form={form}
        setForm={setForm}
        pelatihanList={pelatihanList}
        saving={saving}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus analisis <span className="font-semibold">{deleteTarget?.judul}</span>? Tindakan ini tidak dapat dibatalkan.
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
// SHARED FORM DIALOG (used in table CRUD and full-page input)
// ===========================================================================

interface FormDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  editing: AnalisisKebutuhan | null
  form: Partial<AnalisisKebutuhan>
  setForm: (f: Partial<AnalisisKebutuhan>) => void
  pelatihanList: Pelatihan[]
  saving: boolean
  onSave: () => void
}

function AnalisisFormDialog({ open, onOpenChange, editing, form, setForm, pelatihanList, saving, onSave }: FormDialogProps) {
  const update = (k: keyof AnalisisKebutuhan, v: unknown) => setForm({ ...form, [k]: v })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Analisis Kebutuhan' : 'Tambah Analisis Kebutuhan'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Judul Analisis <span className="text-red-500">*</span></Label>
            <Input value={form.judul || ''} onChange={(e) => update('judul', e.target.value)} placeholder="Contoh: Analisis Kebutuhan Diklat Teknis 2024" />
          </div>
          <div className="space-y-1.5">
            <Label>Tahun <span className="text-red-500">*</span></Label>
            <Input type="number" value={form.tahun || ''} onChange={(e) => update('tahun', parseInt(e.target.value, 10) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Unit Kerja <span className="text-red-500">*</span></Label>
            <Input value={form.unitKerja || ''} onChange={(e) => update('unitKerja', e.target.value)} placeholder="Contoh: Dinas PUPR Aceh" />
          </div>
          <div className="space-y-1.5">
            <Label>Jenis Kompetensi</Label>
            <Select value={form.jenisKompetensi || 'TEKNIS'} onValueChange={(v) => update('jenisKompetensi', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {JENIS_KOMPETENSI.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Jumlah Pegawai</Label>
            <Input type="number" value={form.jumlahPegawai ?? 0} onChange={(e) => update('jumlahPegawai', parseInt(e.target.value, 10) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tingkat Kebutuhan</Label>
            <Select value={form.tingkatKebutuhan || 'SEDANG'} onValueChange={(v) => update('tingkatKebutuhan', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TINGKAT_KEBUTUHAN.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Prioritas</Label>
            <Select value={form.prioritas || 'NORMAL'} onValueChange={(v) => update('prioritas', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITAS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Pelatihan Terkait</Label>
            <Select
              value={form.pelatihanId || 'none'}
              onValueChange={(v) => update('pelatihanId', v === 'none' ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Pilih pelatihan (opsional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Tidak ada —</SelectItem>
                {pelatihanList.map((p) => <SelectItem key={p.id} value={p.id}>{p.kode} - {p.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status || 'DRAFT'} onValueChange={(v) => update('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_ANALISIS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Catatan</Label>
            <Textarea rows={3} value={form.catatan || ''} onChange={(e) => update('catatan', e.target.value)} placeholder="Catatan tambahan..." />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={saving}><X className="w-4 h-4" /> Batal</Button>
          </DialogClose>
          <Button onClick={onSave} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63]">
            <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// SUBTAB 2: INPUT FORM (full-page)
// ===========================================================================

function AnalisisInputForm() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()
  const [form, setForm] = useState<Partial<AnalisisKebutuhan>>({ ...EMPTY_FORM })
  const [pelatihanList, setPelatihanList] = useState<Pelatihan[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.pelatihan.listAll().then(setPelatihanList).catch(() => {})
  }, [])

  const update = (k: keyof AnalisisKebutuhan, v: unknown) => setForm((prev) => ({ ...prev, [k]: v }))

  const handleSubmit = async () => {
    if (!form.judul || !form.unitKerja) {
      toast({ title: 'Validasi', description: 'Judul dan Unit Kerja wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await api.analisis.create({
        ...form,
        tahun: Number(form.tahun) || new Date().getFullYear(),
        jumlahPegawai: Number(form.jumlahPegawai) || 0,
        pelatihanId: form.pelatihanId === 'none' || !form.pelatihanId ? null : form.pelatihanId,
      })
      toast({ title: 'Berhasil', description: 'Analisis kebutuhan ditambahkan' })
      setActiveView('analisis')
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Input Analisis Kebutuhan" description="Formulir penambahan analisis kebutuhan kompetensi baru">
        <Button variant="outline" size="sm" onClick={() => setActiveView('analisis')} className="h-9">
          <ArrowRight className="w-4 h-4" /> Kembali ke Daftar
        </Button>
      </PageHeader>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#0F4C81]" /> Formulir Analisis Kebutuhan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Judul Analisis <span className="text-red-500">*</span></Label>
              <Input value={form.judul || ''} onChange={(e) => update('judul', e.target.value)} placeholder="Contoh: Analisis Kebutuhan Diklat Teknis 2024" />
            </div>
            <div className="space-y-1.5">
              <Label>Tahun <span className="text-red-500">*</span></Label>
              <Input type="number" value={form.tahun || ''} onChange={(e) => update('tahun', parseInt(e.target.value, 10) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit Kerja <span className="text-red-500">*</span></Label>
              <Input value={form.unitKerja || ''} onChange={(e) => update('unitKerja', e.target.value)} placeholder="Contoh: Dinas PUPR Aceh" />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis Kompetensi</Label>
              <Select value={form.jenisKompetensi || 'TEKNIS'} onValueChange={(v) => update('jenisKompetensi', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JENIS_KOMPETENSI.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jumlah Pegawai</Label>
              <Input type="number" value={form.jumlahPegawai ?? 0} onChange={(e) => update('jumlahPegawai', parseInt(e.target.value, 10) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tingkat Kebutuhan</Label>
              <Select value={form.tingkatKebutuhan || 'SEDANG'} onValueChange={(v) => update('tingkatKebutuhan', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TINGKAT_KEBUTUHAN.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioritas</Label>
              <Select value={form.prioritas || 'NORMAL'} onValueChange={(v) => update('prioritas', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITAS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pelatihan Terkait</Label>
              <Select
                value={form.pelatihanId || 'none'}
                onValueChange={(v) => update('pelatihanId', v === 'none' ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Pilih pelatihan (opsional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Tidak ada —</SelectItem>
                  {pelatihanList.map((p) => <SelectItem key={p.id} value={p.id}>{p.kode} - {p.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || 'DRAFT'} onValueChange={(v) => update('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_ANALISIS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Catatan</Label>
              <Textarea rows={4} value={form.catatan || ''} onChange={(e) => update('catatan', e.target.value)} placeholder="Catatan tambahan..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setActiveView('analisis')} disabled={saving}>
              <X className="w-4 h-4" /> Batal
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63]">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Analisis'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// SUBTAB 3: PRIORITAS CARDS
// ===========================================================================

function AnalisisPrioritasView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()
  const [items, setItems] = useState<AnalisisKebutuhan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.analisis.listAll()
      .then(setItems)
      .catch((e) => toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [toast])

  const groups = useMemo(() => {
    const g: Record<string, AnalisisKebutuhan[]> = { URGENT: [], TINGGI: [], NORMAL: [], RENDAH: [] }
    items.forEach((it) => {
      if (g[it.prioritas]) g[it.prioritas].push(it)
      else g.NORMAL.push(it)
    })
    return g
  }, [items])

  const groupMeta: Record<string, { label: string; color: string; ring: string; icon: React.ComponentType<{ className?: string }> }> = {
    URGENT: { label: 'Urgent', color: 'text-red-700 bg-red-50 border-red-200', ring: 'ring-red-100', icon: AlertTriangle },
    TINGGI: { label: 'Tinggi', color: 'text-orange-700 bg-orange-50 border-orange-200', ring: 'ring-orange-100', icon: ArrowUp },
    NORMAL: { label: 'Normal', color: 'text-blue-700 bg-blue-50 border-blue-200', ring: 'ring-blue-100', icon: ClipboardList },
    RENDAH: { label: 'Rendah', color: 'text-slate-700 bg-slate-50 border-slate-200', ring: 'ring-slate-100', icon: ClipboardList },
  }

  const orderedGroups = Object.keys(groups).sort((a, b) => (PRIORITAS_ORDER[a] ?? 99) - (PRIORITAS_ORDER[b] ?? 99))

  return (
    <div className="space-y-4">
      <PageHeader title="Prioritas Analisis Kebutuhan" description="Pengelompokan analisis berdasarkan tingkat prioritas">
        <Button variant="outline" size="sm" onClick={() => setActiveView('analisis')} className="h-9">
          <ArrowRight className="w-4 h-4" /> Kembali
        </Button>
      </PageHeader>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-5 h-32 bg-slate-100 rounded-xl" /></Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">Belum ada data analisis</CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {orderedGroups.map((key) => {
            const meta = groupMeta[key]
            const list = groups[key]
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${meta.color}`}>
                    <meta.icon className="w-3.5 h-3.5" /> {meta.label}
                  </div>
                  <span className="text-xs text-slate-500">{list.length} analisis</span>
                </div>
                {list.length === 0 ? (
                  <p className="text-sm text-slate-400 pl-1">Tidak ada analisis dengan prioritas ini</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map((it, i) => (
                      <motion.div
                        key={it.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                      >
                        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow h-full">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="font-semibold text-slate-900 text-sm line-clamp-2 flex-1">{it.judul}</p>
                              <TingkatBadge tingkat={it.tingkatKebutuhan} />
                            </div>
                            <div className="space-y-1 text-xs text-slate-500">
                              <p><span className="text-slate-400">Unit Kerja:</span> <span className="font-medium text-slate-700">{it.unitKerja}</span></p>
                              <p><span className="text-slate-400">Tahun:</span> <span className="font-medium text-slate-700">{it.tahun}</span></p>
                              <p><span className="text-slate-400">Jenis:</span> <span className="font-medium text-slate-700">{kategoriLabel(it.jenisKompetensi)}</span></p>
                              <p><span className="text-slate-400">Pegawai:</span> <span className="font-medium text-slate-700">{it.jumlahPegawai} orang</span></p>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                              <StatusBadge status={it.status} />
                              {it.pelatihan && <span className="text-xs text-slate-500 truncate max-w-[140px]">{it.pelatihan.kode}</span>}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// SUBTAB 4: REKAP (table + bar chart)
// ===========================================================================

function AnalisisRekapView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()
  const [rows, setRows] = useState<{ tahun: number; jenisKompetensi: string; jumlah: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.analisis.rekap()
      .then((r) => setRows(r as { tahun: number; jenisKompetensi: string; jumlah: number }[]))
      .catch((e) => toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [toast])

  // Build chart data: one bar per tahun, stacked by jenisKompetensi
  const chartData = useMemo(() => {
    const byTahun: Record<number, Record<string, number>> = {}
    rows.forEach((r) => {
      if (!byTahun[r.tahun]) byTahun[r.tahun] = {}
      byTahun[r.tahun][r.jenisKompetensi] = (byTahun[r.tahun][r.jenisKompetensi] || 0) + r.jumlah
    })
    return Object.keys(byTahun).sort((a, b) => Number(a) - Number(b)).map((t) => {
      const item: Record<string, number | string> = { tahun: t }
      JENIS_KOMPETENSI.forEach((j) => {
        item[j.label] = byTahun[Number(t)][j.value] || 0
      })
      return item
    })
  }, [rows])

  const COLORS: Record<string, string> = {
    Teknis: '#0F4C81',
    Manajerial: '#198754',
    Fungsional: '#d97706',
    'Sosial Kultural': '#7c3aed',
  }

  const sortedRows = [...rows].sort((a, b) => b.tahun - a.tahun || a.jenisKompetensi.localeCompare(b.jenisKompetensi))
  const totalAnalisis = rows.reduce((s, r) => s + r.jumlah, 0)
  const totalTahun = new Set(rows.map((r) => r.tahun)).size

  return (
    <div className="space-y-4">
      <PageHeader title="Rekap Analisis Kebutuhan" description="Ringkasan analisis dikelompokkan berdasarkan tahun dan jenis kompetensi">
        <Button variant="outline" size="sm" onClick={() => setActiveView('analisis')} className="h-9">
          <ArrowRight className="w-4 h-4" /> Kembali
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <StatCard title="Total Analisis" value={totalAnalisis} icon={ClipboardList} color="blue" />
        <StatCard title="Jenis Kompetensi" value={new Set(rows.map((r) => r.jenisKompetensi)).size} icon={FileBarChart} color="green" />
        <StatCard title="Tahun Terdata" value={totalTahun} icon={BarChart3} color="amber" />
      </div>

      {loading ? (
        <Card className="border-slate-200 shadow-sm animate-pulse"><CardContent className="p-5 h-72 bg-slate-100 rounded-xl" /></Card>
      ) : rows.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">Belum ada data analisis untuk direkap</CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0F4C81]" /> Grafik per Tahun & Jenis Kompetensi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="tahun" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {JENIS_KOMPETENSI.map((j) => (
                    <Bar key={j.value} dataKey={j.label} stackId="a" fill={COLORS[j.label]} radius={[0, 0, 0, 0]} maxBarSize={50} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#0F4C81]" /> Tabel Rekap
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Tahun</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Jenis Kompetensi</th>
                      <th className="text-right text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedRows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-900">{r.tahun}</td>
                        <td className="px-4 py-2.5 text-slate-700">{kategoriLabel(r.jenisKompetensi)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-[#0F4C81]">{r.jumlah}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td className="px-4 py-2.5 font-semibold text-slate-900" colSpan={2}>Total</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#0F4C81]">{totalAnalisis}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
