'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { Asesor } from '@/lib/types'
import { DataTable, StatCard, PageHeader, type Column, type FilterOption } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/ui-helpers'
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
import { Pencil, Trash2, Plus, Save, X, Award, UserCheck, Briefcase } from 'lucide-react'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const STATUS_ASESOR = [
  { value: 'AKTIF', label: 'Aktif' },
  { value: 'NONAKTIF', label: 'Nonaktif' },
]

const EMPTY_FORM: Partial<Asesor> = {
  nip: '',
  nama: '',
  bidangKeahlian: '',
  noSertifikat: '',
  instansi: '',
  email: '',
  noTelp: '',
  status: 'AKTIF',
}

// ===========================================================================
// ROOT COMPONENT
// ===========================================================================

export function AsesorView() {
  return <AsesorDataTable />
}

// ===========================================================================
// ASESOR DATA TABLE (CRUD) — single view
// ===========================================================================

function AsesorDataTable() {
  const { toast } = useToast()

  const [data, setData] = useState<Asesor[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [allAsesor, setAllAsesor] = useState<Asesor[]>([])

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Asesor | null>(null)
  const [form, setForm] = useState<Partial<Asesor>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<Asesor | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        status: filters.status || undefined,
      }
      const res = await api.asesor.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filters, toast])

  // Fetch all for statcards (totals)
  const fetchAll = useCallback(async () => {
    try {
      const res = await api.asesor.listAll()
      setAllAsesor(res)
    } catch {
      // silent — statcards just show 0
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

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

  const openEdit = (item: Asesor) => {
    setEditing(item)
    setForm({
      nip: item.nip,
      nama: item.nama,
      bidangKeahlian: item.bidangKeahlian,
      noSertifikat: item.noSertifikat || '',
      instansi: item.instansi || '',
      email: item.email || '',
      noTelp: item.noTelp || '',
      status: item.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.nip || !form.nama || !form.bidangKeahlian) {
      toast({ title: 'Validasi', description: 'NIP, Nama, dan Bidang Keahlian wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Partial<Asesor> = { ...form }
      if (editing) {
        await api.asesor.update(editing.id, payload)
        toast({ title: 'Berhasil', description: 'Data asesor diperbarui' })
      } else {
        await api.asesor.create(payload)
        toast({ title: 'Berhasil', description: 'Asesor baru ditambahkan' })
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
      await api.asesor.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Asesor dihapus' })
      setDeleteTarget(null)
      refresh()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const filterOptions: FilterOption[] = [
    { key: 'status', label: 'Status', options: STATUS_ASESOR },
  ]

  const columns: Column<Asesor>[] = [
    {
      key: 'nama', header: 'Nama Asesor', render: (r) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.nama}</p>
          <p className="text-xs text-slate-400 font-mono">NIP: {r.nip}</p>
        </div>
      ),
    },
    { key: 'bidangKeahlian', header: 'Bidang Keahlian', render: (r) => <span className="text-slate-600 text-sm">{r.bidangKeahlian}</span> },
    { key: 'noSertifikat', header: 'No. Sertifikat', render: (r) => <span className="font-mono text-xs text-slate-600">{r.noSertifikat || '-'}</span> },
    { key: 'instansi', header: 'Instansi', render: (r) => <span className="text-slate-600 text-sm line-clamp-1">{r.instansi || '-'}</span> },
    {
      key: 'email', header: 'Kontak', render: (r) => (
        <div className="text-xs text-slate-600 min-w-[180px]">
          {r.email && <p className="line-clamp-1">{r.email}</p>}
          {r.noTelp && <p className="text-slate-400">{r.noTelp}</p>}
          {!r.email && !r.noTelp && <span className="text-slate-300">-</span>}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  // Stats
  const totalAktif = useMemo(() => allAsesor.filter((a) => a.status === 'AKTIF').length, [allAsesor])
  const totalBidang = useMemo(() => new Set(allAsesor.map((a) => a.bidangKeahlian).filter(Boolean)).size, [allAsesor])

  return (
    <div className="space-y-4">
      <PageHeader title="Data Asesor Kompetensi" description="Kelola data asesor / penguji kompetensi teknis" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <StatCard title="Total Asesor" value={allAsesor.length} icon={Award} color="blue" subtitle="Semua asesor terdaftar" />
        <StatCard title="Asesor Aktif" value={totalAktif} icon={UserCheck} color="green" subtitle="Status aktif" />
        <StatCard title="Bidang Keahlian" value={totalBidang} icon={Briefcase} color="amber" subtitle="Bidang unik" />
      </div>

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari nama / NIP / bidang keahlian..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        filters={filterOptions}
        filterValues={filters}
        onFilterChange={handleFilter}
        onAdd={openCreate}
        addLabel="Tambah Asesor"
        onRefresh={refresh}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data asesor"
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
            <DialogTitle>{editing ? 'Edit Data Asesor' : 'Tambah Asesor Baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>NIP <span className="text-red-500">*</span></Label>
              <Input value={form.nip || ''} onChange={(e) => setForm({ ...form, nip: e.target.value })} placeholder="Nomor Induk Pegawai" />
            </div>
            <div className="space-y-1.5">
              <Label>Nama Lengkap <span className="text-red-500">*</span></Label>
              <Input value={form.nama || ''} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama lengkap asesor" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Bidang Keahlian <span className="text-red-500">*</span></Label>
              <Input value={form.bidangKeahlian || ''} onChange={(e) => setForm({ ...form, bidangKeahlian: e.target.value })} placeholder="Contoh: Sertifikasi ASN, Manajemen Pendidikan" />
            </div>
            <div className="space-y-1.5">
              <Label>Nomor Sertifikat Asesor</Label>
              <Input value={form.noSertifikat || ''} onChange={(e) => setForm({ ...form, noSertifikat: e.target.value })} placeholder="Nomor sertifikat kompetensi" />
            </div>
            <div className="space-y-1.5">
              <Label>Instansi</Label>
              <Input value={form.instansi || ''} onChange={(e) => setForm({ ...form, instansi: e.target.value })} placeholder="Contoh: BPSDM Aceh" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="asesor@example.go.id" />
            </div>
            <div className="space-y-1.5">
              <Label>No. Telepon</Label>
              <Input value={form.noTelp || ''} onChange={(e) => setForm({ ...form, noTelp: e.target.value })} placeholder="08xx-xxxx-xxxx" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || 'AKTIF'} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_ASESOR.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
              Yakin ingin menghapus asesor <span className="font-semibold">{deleteTarget?.nama}</span>? Tindakan ini tidak dapat dibatalkan.
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
