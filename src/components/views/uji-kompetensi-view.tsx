'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { UjiKompetensi, Asesor, Nilai, Peserta, Angkatan } from '@/lib/types'
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
import {
  Pencil, Trash2, Plus, Save, X, Award, ClipboardCheck, BarChart3,
  CalendarDays, UserCheck, UserX, Percent, ArrowRight, Eye, Users, CheckCircle2,
  Search, RotateCcw, FileUser, Link2, Unlink,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const STATUS_UJI = [
  { value: 'DIJADWALKAN', label: 'Dijadwalkan' },
  { value: 'BERLANGSUNG', label: 'Berlangsung' },
  { value: 'SELESAI', label: 'Selesai' },
  { value: 'DIBATALKAN', label: 'Dibatalkan' },
]

const STATUS_KELULUSAN = [
  { value: 'LULUS', label: 'Lulus' },
  { value: 'TIDAK_LULUS', label: 'Tidak Lulus' },
  { value: 'BELUM', label: 'Belum Dinilai' },
]

const EMPTY_FORM: Partial<UjiKompetensi> = {
  kode: '',
  angkatanId: null,
  tanggalUji: '',
  tempat: '',
  skemaSertifikasi: '',
  jumlahPeserta: 0,
  status: 'DIJADWALKAN',
  catatan: '',
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

export function UjiKompetensiView() {
  const { activeView } = useNavStore()
  if (activeView === 'uji-penilaian') return <UjiPenilaianView />
  if (activeView === 'uji-hasil') return <UjiHasilView />
  if (activeView === 'uji-rekap') return <UjiRekapView />
  if (activeView === 'uji-biodata') return <UjiBiodataPesertaView />
  return <UjiJadwalDataTable />
}

// ===========================================================================
// SUBTAB 1: JADWAL UJI KOMPETENSI (CRUD)
// ===========================================================================

function UjiJadwalDataTable() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()

  const [data, setData] = useState<UjiKompetensi[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [angkatanList, setAngkatanList] = useState<Angkatan[]>([])

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UjiKompetensi | null>(null)
  const [form, setForm] = useState<Partial<UjiKompetensi>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<UjiKompetensi | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        status: filters.status || undefined,
      }
      const res = await api.ujiKompetensi.list(params)
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
    api.angkatan.listAll().then(setAngkatanList).catch(() => {})
  }, [])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }))
    setPage(1)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, tanggalUji: new Date().toISOString().slice(0, 10) })
    setDialogOpen(true)
  }

  const openEdit = (item: UjiKompetensi) => {
    setEditing(item)
    setForm({
      kode: item.kode,
      angkatanId: item.angkatanId || null,
      tanggalUji: toDateInput(item.tanggalUji),
      tempat: item.tempat,
      skemaSertifikasi: item.skemaSertifikasi,
      jumlahPeserta: item.jumlahPeserta,
      status: item.status,
      catatan: item.catatan || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.kode || !form.skemaSertifikasi || !form.tempat) {
      toast({ title: 'Validasi', description: 'Kode, Skema Sertifikasi, dan Tempat wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Partial<UjiKompetensi> = {
        ...form,
        tanggalUji: form.tanggalUji ? new Date(form.tanggalUji).toISOString() : new Date().toISOString(),
        jumlahPeserta: Number(form.jumlahPeserta) || 0,
        angkatanId: form.angkatanId === 'none' || !form.angkatanId ? null : form.angkatanId,
      }
      if (editing) {
        await api.ujiKompetensi.update(editing.id, payload)
        toast({ title: 'Berhasil', description: 'Jadwal uji kompetensi diperbarui' })
      } else {
        await api.ujiKompetensi.create(payload)
        toast({ title: 'Berhasil', description: 'Jadwal uji kompetensi ditambahkan' })
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
      await api.ujiKompetensi.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Jadwal uji kompetensi dihapus' })
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const filterOptions: FilterOption[] = [
    { key: 'status', label: 'Status', options: STATUS_UJI },
  ]

  const columns: Column<UjiKompetensi>[] = [
    { key: 'kode', header: 'Kode', render: (r) => <span className="font-mono text-xs font-semibold text-[#0F4C81]">{r.kode}</span> },
    {
      key: 'skemaSertifikasi', header: 'Skema Sertifikasi', render: (r) => (
        <div className="min-w-[220px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.skemaSertifikasi}</p>
          {r.angkatan && <p className="text-xs text-slate-400 line-clamp-1">Angkatan: {r.angkatan.namaAngkatan}</p>}
        </div>
      ),
    },
    { key: 'tanggalUji', header: 'Tanggal Uji', render: (r) => <span className="text-xs text-slate-600">{formatTanggalSingkat(r.tanggalUji)}</span> },
    { key: 'tempat', header: 'Tempat', render: (r) => <span className="text-sm text-slate-600 line-clamp-1">{r.tempat}</span> },
    { key: 'jumlahPeserta', header: 'Peserta', render: (r) => <span className="font-medium text-sm">{r.jumlahPeserta}</span> },
    {
      key: 'asesor', header: 'Asesor', render: (r) => (
        <span className="text-xs text-slate-600">{r.asesor?.length || 0} orang</span>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Jadwal Uji Kompetensi" description="Kelola jadwal pelaksanaan uji kompetensi teknis">
        <Button variant="outline" size="sm" onClick={() => setActiveView('uji-penilaian')} className="h-9">
          <ClipboardCheck className="w-4 h-4" /> Penilaian
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveView('uji-hasil')} className="h-9">
          <Eye className="w-4 h-4" /> Hasil
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveView('uji-rekap')} className="h-9">
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
        searchPlaceholder="Cari kode / skema / tempat..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        filters={filterOptions}
        filterValues={filters}
        onFilterChange={handleFilter}
        onAdd={openCreate}
        addLabel="Tambah Jadwal"
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada jadwal uji kompetensi"
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
            <DialogTitle>{editing ? 'Edit Jadwal Uji Kompetensi' : 'Tambah Jadwal Uji Kompetensi'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Kode Uji <span className="text-red-500">*</span></Label>
              <Input value={form.kode || ''} onChange={(e) => setForm({ ...form, kode: e.target.value })} placeholder="Contoh: UK-2024-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Uji <span className="text-red-500">*</span></Label>
              <Input type="date" value={toDateInput(form.tanggalUji as string)} onChange={(e) => setForm({ ...form, tanggalUji: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Skema Sertifikasi <span className="text-red-500">*</span></Label>
              <Input value={form.skemaSertifikasi || ''} onChange={(e) => setForm({ ...form, skemaSertifikasi: e.target.value })} placeholder="Contoh: Sertifikasi Kompetensi ASN Bidang TI" />
            </div>
            <div className="space-y-1.5">
              <Label>Tempat Uji <span className="text-red-500">*</span></Label>
              <Input value={form.tempat || ''} onChange={(e) => setForm({ ...form, tempat: e.target.value })} placeholder="Contoh: Ruang Uji BPSDM Aceh" />
            </div>
            <div className="space-y-1.5">
              <Label>Jumlah Peserta</Label>
              <Input type="number" value={form.jumlahPeserta ?? 0} onChange={(e) => setForm({ ...form, jumlahPeserta: parseInt(e.target.value, 10) || 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label>Angkatan Terkait</Label>
              <Select
                value={form.angkatanId || 'none'}
                onValueChange={(v) => setForm({ ...form, angkatanId: v === 'none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Pilih angkatan (opsional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Tidak ada —</SelectItem>
                  {angkatanList.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.namaAngkatan} {a.pelatihan ? `(${a.pelatihan.kode})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || 'DIJADWALKAN'} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_UJI.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
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
              Yakin ingin menghapus jadwal uji <span className="font-semibold">{deleteTarget?.kode}</span>? Seluruh data nilai peserta terkait juga akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.
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
// SHARED: NILAI ROW EDITOR (used by penilaian and hasil)
// ===========================================================================

interface NilaiRow {
  id: string
  pesertaId: string
  pesertaNama: string
  pesertaNip: string
  nilaiPreTest: number
  nilaiPostTest: number
  nilaiPraktik: number
  nilaiTeori: number
  nilaiAkhir: number | null
  statusKelulusan: string
}

function computeNilaiAkhir(r: { nilaiPreTest: number; nilaiPostTest: number; nilaiPraktik: number; nilaiTeori: number }): number {
  const vals = [r.nilaiPreTest, r.nilaiPostTest, r.nilaiPraktik, r.nilaiTeori].filter((v) => v > 0)
  if (vals.length === 0) return 0
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
}

function statusFromNilai(akhir: number): string {
  if (akhir === 0) return 'BELUM'
  return akhir >= 70 ? 'LULUS' : 'TIDAK_LULUS'
}

function mapNilaiToRow(n: Nilai): NilaiRow {
  return {
    id: n.id,
    pesertaId: n.pesertaId,
    pesertaNama: n.peserta?.nama || '-',
    pesertaNip: n.peserta?.nip || '-',
    nilaiPreTest: n.nilaiPreTest ?? 0,
    nilaiPostTest: n.nilaiPostTest ?? 0,
    nilaiPraktik: n.nilaiPraktik ?? 0,
    nilaiTeori: n.nilaiTeori ?? 0,
    nilaiAkhir: n.nilaiAkhir ?? null,
    statusKelulusan: n.statusKelulusan,
  }
}

// ===========================================================================
// SUBTAB 2: PENILAIAN (editable table)
// ===========================================================================

function UjiPenilaianView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()
  const [ujiList, setUjiList] = useState<UjiKompetensi[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [rows, setRows] = useState<NilaiRow[]>([])
  const [originalRows, setOriginalRows] = useState<NilaiRow[]>([])
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [savingAll, setSavingAll] = useState(false)
  const [savingRow, setSavingRow] = useState<string>('')

  useEffect(() => {
    api.ujiKompetensi.listAll()
      .then((r) => setUjiList(r))
      .catch((e) => toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setListLoading(false))
  }, [toast])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const u = await api.ujiKompetensi.get(selectedId)
        if (cancelled) return
        const mapped = (u.nilai || []).map(mapNilaiToRow)
        setRows(mapped)
        setOriginalRows(mapped)
      } catch (e) {
        if (!cancelled) toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedId, toast])

  const selectedUji = ujiList.find((u) => u.id === selectedId) || null

  const updateField = (id: string, field: keyof NilaiRow, value: number | string) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r
      const next = { ...r, [field]: value }
      // recompute akhir & status when nilai inputs change
      if (field === 'nilaiPreTest' || field === 'nilaiPostTest' || field === 'nilaiPraktik' || field === 'nilaiTeori') {
        next.nilaiAkhir = computeNilaiAkhir(next)
        next.statusKelulusan = statusFromNilai(next.nilaiAkhir)
      }
      return next
    }))
  }

  const changedIds = useMemo(() => {
    return rows.filter((r) => {
      const o = originalRows.find((x) => x.id === r.id)
      if (!o) return true
      return (
        o.nilaiPreTest !== r.nilaiPreTest ||
        o.nilaiPostTest !== r.nilaiPostTest ||
        o.nilaiPraktik !== r.nilaiPraktik ||
        o.nilaiTeori !== r.nilaiTeori
      )
    }).map((r) => r.id)
  }, [rows, originalRows])

  const hasChanges = changedIds.length > 0

  const saveRow = async (id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    setSavingRow(id)
    try {
      await api.ujiKompetensi.setNilai(selectedId, {
        pesertaId: row.pesertaId,
        nilaiPreTest: row.nilaiPreTest,
        nilaiPostTest: row.nilaiPostTest,
        nilaiPraktik: row.nilaiPraktik,
        nilaiTeori: row.nilaiTeori,
        statusKelulusan: row.statusKelulusan,
      })
      setOriginalRows((prev) => prev.map((r) => r.id === id ? { ...row } : r))
      toast({ title: 'Tersimpan', description: `Nilai ${row.pesertaNama} diperbarui`, duration: 1500 } as any)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSavingRow('')
    }
  }

  const saveAll = async () => {
    if (changedIds.length === 0) {
      toast({ title: 'Info', description: 'Tidak ada perubahan untuk disimpan' })
      return
    }
    setSavingAll(true)
    let ok = 0
    let fail = 0
    for (const id of changedIds) {
      const row = rows.find((r) => r.id === id)
      if (!row) continue
      try {
        await api.ujiKompetensi.setNilai(selectedId, {
          pesertaId: row.pesertaId,
          nilaiPreTest: row.nilaiPreTest,
          nilaiPostTest: row.nilaiPostTest,
          nilaiPraktik: row.nilaiPraktik,
          nilaiTeori: row.nilaiTeori,
          statusKelulusan: row.statusKelulusan,
        })
        ok++
      } catch {
        fail++
      }
    }
    setOriginalRows(rows.map((r) => ({ ...r })))
    setSavingAll(false)
    if (fail === 0) {
      toast({ title: 'Berhasil', description: `${ok} nilai peserta tersimpan` })
    } else {
      toast({ title: 'Sebagian Berhasil', description: `${ok} tersimpan, ${fail} gagal`, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Penilaian Uji Kompetensi" description="Input nilai pre-test, post-test, praktik, dan teori peserta">
        <Button variant="outline" size="sm" onClick={() => setActiveView('uji-jadwal')} className="h-9">
          <ArrowRight className="w-4 h-4" /> Kembali ke Jadwal
        </Button>
      </PageHeader>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Pilih Uji Kompetensi</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder={listLoading ? 'Memuat...' : 'Pilih uji kompetensi...'} /></SelectTrigger>
                <SelectContent>
                  {ujiList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.kode} — {u.skemaSertifikasi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedUji && (
              <>
                <div className="text-xs text-slate-500">
                  <p><span className="text-slate-400">Tanggal:</span> <span className="font-medium text-slate-700">{formatTanggalSingkat(selectedUji.tanggalUji)}</span></p>
                  <p><span className="text-slate-400">Tempat:</span> <span className="font-medium text-slate-700">{selectedUji.tempat}</span></p>
                </div>
                <div className="text-xs text-slate-500">
                  <p><span className="text-slate-400">Peserta:</span> <span className="font-medium text-slate-700">{rows.length} orang</span></p>
                  <p><span className="text-slate-400">Status:</span> <StatusBadge status={selectedUji.status} /></p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedId ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Silakan pilih uji kompetensi untuk menginput nilai peserta
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="border-slate-200 shadow-sm animate-pulse">
          <CardContent className="p-5 h-64 bg-slate-100 rounded-xl" />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Belum ada peserta terdaftar pada uji kompetensi ini
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#0F4C81]" /> Input Nilai Peserta ({rows.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <span className="text-xs text-amber-600 font-medium">{changedIds.length} perubahan belum disimpan</span>
                )}
                <Button size="sm" onClick={saveAll} disabled={savingAll || !hasChanges} className="h-9 bg-[#198754] hover:bg-[#157347]">
                  <Save className="w-4 h-4" /> {savingAll ? 'Menyimpan...' : 'Simpan Semua'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5 sticky left-0 bg-slate-50 z-10 min-w-[200px]">Peserta</th>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-24">Pre-Test</th>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-24">Post-Test</th>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-24">Praktik</th>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-24">Teori</th>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-20">Akhir</th>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-28">Status</th>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => {
                    const akhir = r.nilaiAkhir ?? computeNilaiAkhir(r)
                    const status = r.nilaiAkhir != null ? r.statusKelulusan : statusFromNilai(akhir)
                    const isChanged = changedIds.includes(r.id)
                    return (
                      <motion.tr
                        key={r.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.3) }}
                        className={isChanged ? 'bg-amber-50/40 hover:bg-amber-50/60' : 'hover:bg-slate-50/50'}
                      >
                        <td className="px-4 py-2 sticky left-0 bg-inherit z-10">
                          <p className="font-medium text-slate-900 text-sm line-clamp-1">{r.pesertaNama}</p>
                          <p className="text-xs text-slate-400 font-mono">NIP: {r.pesertaNip}</p>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={r.nilaiPreTest || ''}
                            onChange={(e) => updateField(r.id, 'nilaiPreTest', parseInt(e.target.value, 10) || 0)}
                            className="h-8 text-center text-sm"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={r.nilaiPostTest || ''}
                            onChange={(e) => updateField(r.id, 'nilaiPostTest', parseInt(e.target.value, 10) || 0)}
                            className="h-8 text-center text-sm"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={r.nilaiPraktik || ''}
                            onChange={(e) => updateField(r.id, 'nilaiPraktik', parseInt(e.target.value, 10) || 0)}
                            className="h-8 text-center text-sm"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={r.nilaiTeori || ''}
                            onChange={(e) => updateField(r.id, 'nilaiTeori', parseInt(e.target.value, 10) || 0)}
                            className="h-8 text-center text-sm"
                            placeholder="-"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className={`font-bold ${akhir >= 70 ? 'text-[#198754]' : akhir > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                            {akhir > 0 ? akhir : '-'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <StatusBadge status={status} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => saveRow(r.id)}
                            disabled={!isChanged || savingRow === r.id || savingAll}
                          >
                            {savingRow === r.id ? '...' : 'Simpan'}
                          </Button>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-[#198754]" /> Nilai Akhir = rata-rata dari nilai yang diisi (&gt;0)</span>
              <span>Lulus jika nilai akhir &ge; 70</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ===========================================================================
// SUBTAB 3: HASIL (read-only with filter)
// ===========================================================================

function UjiHasilView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()
  const [ujiList, setUjiList] = useState<UjiKompetensi[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [rows, setRows] = useState<NilaiRow[]>([])
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    api.ujiKompetensi.listAll()
      .then((r) => setUjiList(r))
      .catch((e) => toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setListLoading(false))
  }, [toast])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const u = await api.ujiKompetensi.get(selectedId)
        if (!cancelled) setRows((u.nilai || []).map(mapNilaiToRow))
      } catch (e) {
        if (!cancelled) toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedId, toast])

  const selectedUji = ujiList.find((u) => u.id === selectedId) || null

  const filteredRows = useMemo(() => {
    if (!statusFilter) return rows
    return rows.filter((r) => {
      const akhir = r.nilaiAkhir ?? computeNilaiAkhir(r)
      const status = r.nilaiAkhir != null ? r.statusKelulusan : statusFromNilai(akhir)
      return status === statusFilter
    })
  }, [rows, statusFilter])

  const totalLulus = rows.filter((r) => {
    const akhir = r.nilaiAkhir ?? computeNilaiAkhir(r)
    const status = r.nilaiAkhir != null ? r.statusKelulusan : statusFromNilai(akhir)
    return status === 'LULUS'
  }).length
  const totalTidakLulus = rows.filter((r) => {
    const akhir = r.nilaiAkhir ?? computeNilaiAkhir(r)
    const status = r.nilaiAkhir != null ? r.statusKelulusan : statusFromNilai(akhir)
    return status === 'TIDAK_LULUS'
  }).length
  const totalBelum = rows.filter((r) => {
    const akhir = r.nilaiAkhir ?? computeNilaiAkhir(r)
    const status = r.nilaiAkhir != null ? r.statusKelulusan : statusFromNilai(akhir)
    return status === 'BELUM'
  }).length

  return (
    <div className="space-y-4">
      <PageHeader title="Hasil Uji Kompetensi" description="Lihat hasil nilai dan kelulusan peserta per uji kompetensi">
        <Button variant="outline" size="sm" onClick={() => setActiveView('uji-jadwal')} className="h-9">
          <ArrowRight className="w-4 h-4" /> Kembali ke Jadwal
        </Button>
      </PageHeader>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Pilih Uji Kompetensi</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder={listLoading ? 'Memuat...' : 'Pilih uji kompetensi...'} /></SelectTrigger>
                <SelectContent>
                  {ujiList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.kode} — {u.skemaSertifikasi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Filter Status</Label>
              <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Semua status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUS_KELULUSAN.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedUji && (
              <div className="text-xs text-slate-500">
                <p><span className="text-slate-400">Tanggal:</span> <span className="font-medium text-slate-700">{formatTanggalSingkat(selectedUji.tanggalUji)}</span></p>
                <p><span className="text-slate-400">Status Uji:</span> <StatusBadge status={selectedUji.status} /></p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedId ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <Eye className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Silakan pilih uji kompetensi untuk melihat hasil
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="border-slate-200 shadow-sm animate-pulse">
          <CardContent className="p-5 h-64 bg-slate-100 rounded-xl" />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Belum ada peserta pada uji kompetensi ini
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 lg:gap-4">
            <StatCard title="Lulus" value={totalLulus} icon={UserCheck} color="green" />
            <StatCard title="Tidak Lulus" value={totalTidakLulus} icon={UserX} color="red" />
            <StatCard title="Belum Dinilai" value={totalBelum} icon={Users} color="slate" />
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-[#0F4C81]" /> Hasil Nilai Peserta ({filteredRows.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Peserta</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-20">Pre</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-20">Post</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-20">Praktik</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-20">Teori</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-2 py-2.5 w-20">Akhir</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-4 py-2.5 w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((r) => {
                      const akhir = r.nilaiAkhir ?? computeNilaiAkhir(r)
                      const status = r.nilaiAkhir != null ? r.statusKelulusan : statusFromNilai(akhir)
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-slate-900 text-sm line-clamp-1">{r.pesertaNama}</p>
                            <p className="text-xs text-slate-400 font-mono">NIP: {r.pesertaNip}</p>
                          </td>
                          <td className="px-2 py-2.5 text-center text-slate-600">{r.nilaiPreTest || '-'}</td>
                          <td className="px-2 py-2.5 text-center text-slate-600">{r.nilaiPostTest || '-'}</td>
                          <td className="px-2 py-2.5 text-center text-slate-600">{r.nilaiPraktik || '-'}</td>
                          <td className="px-2 py-2.5 text-center text-slate-600">{r.nilaiTeori || '-'}</td>
                          <td className="px-2 py-2.5 text-center">
                            <span className={`font-bold ${akhir >= 70 ? 'text-[#198754]' : akhir > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                              {akhir > 0 ? akhir : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <StatusBadge status={status} />
                          </td>
                        </tr>
                      )
                    })}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400 text-sm">Tidak ada peserta dengan status ini</td>
                      </tr>
                    )}
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
// SUBTAB 4: REKAP (statcards + barchart + table)
// ===========================================================================

interface RekapRow {
  id?: string
  ujiKompetensiId?: string
  kode?: string
  skemaSertifikasi?: string
  tanggalUji?: string
  totalPeserta?: number
  lulus?: number
  tidakLulus?: number
  belum?: number
  persentase?: number
}

function UjiRekapView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()
  const [rows, setRows] = useState<RekapRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.ujiKompetensi.rekapNilai()
      .then((r) => setRows(r as RekapRow[]))
      .catch((e) => toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [toast])

  const totalUji = rows.length
  const totalLulus = rows.reduce((s, r) => s + (r.lulus || 0), 0)
  const totalTidakLulus = rows.reduce((s, r) => s + (r.tidakLulus || 0), 0)
  const totalPeserta = rows.reduce((s, r) => s + (r.totalPeserta || 0), 0)
  const avgPersentase = totalPeserta > 0 ? Math.round((totalLulus / totalPeserta) * 100) : 0

  // Chart data — one bar per uji (lulus vs tidak lulus)
  const chartData = useMemo(() => {
    return rows.map((r) => ({
      kode: r.kode || '-',
      Lulus: r.lulus || 0,
      'Tidak Lulus': r.tidakLulus || 0,
    }))
  }, [rows])

  return (
    <div className="space-y-4">
      <PageHeader title="Rekap Uji Kompetensi" description="Ringkasan kelulusan peserta per uji kompetensi">
        <Button variant="outline" size="sm" onClick={() => setActiveView('uji-jadwal')} className="h-9">
          <ArrowRight className="w-4 h-4" /> Kembali ke Jadwal
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Total Uji Kompetensi" value={totalUji} icon={CalendarDays} color="blue" />
        <StatCard title="Total Lulus" value={totalLulus} icon={UserCheck} color="green" />
        <StatCard title="Total Tidak Lulus" value={totalTidakLulus} icon={UserX} color="red" />
        <StatCard title="Rata-rata Kelulusan" value={`${avgPersentase}%`} icon={Percent} color="amber" subtitle="Dari semua peserta" />
      </div>

      {loading ? (
        <Card className="border-slate-200 shadow-sm animate-pulse">
          <CardContent className="p-5 h-72 bg-slate-100 rounded-xl" />
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Belum ada data uji kompetensi untuk direkap
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0F4C81]" /> Grafik Kelulusan per Uji Kompetensi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="kode" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} angle={-15} textAnchor="end" height={50} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Lulus" stackId="a" fill="#198754" radius={[0, 0, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="Tidak Lulus" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#0F4C81]" /> Tabel Rekap Kelulusan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Kode / Skema</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Tanggal</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Peserta</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Lulus</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Tidak Lulus</th>
                      <th className="text-center text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">% Kelulusan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <tr key={r.id || r.ujiKompetensiId || i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5">
                          <p className="font-mono text-xs font-semibold text-[#0F4C81]">{r.kode || '-'}</p>
                          <p className="text-xs text-slate-500 line-clamp-1">{r.skemaSertifikasi || '-'}</p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">
                          {r.tanggalUji ? formatTanggalSingkat(r.tanggalUji) : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-center font-medium text-slate-900">{r.totalPeserta || 0}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="font-semibold text-[#198754]">{r.lulus || 0}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="font-semibold text-red-600">{r.tidakLulus || 0}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            (r.persentase || 0) >= 70
                              ? 'bg-green-100 text-[#195737] border-[#86EFAC]'
                              : (r.persentase || 0) >= 50
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-red-100 text-red-700 border-red-200'
                          }`}>
                            {r.persentase ?? 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td className="px-4 py-2.5 font-semibold text-slate-900" colSpan={2}>Total</td>
                      <td className="px-4 py-2.5 text-center font-bold text-slate-900">{totalPeserta}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#198754]">{totalLulus}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-red-600">{totalTidakLulus}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-[#0F4C81]">{avgPersentase}%</td>
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

// ===========================================================================
// SUBTAB 5: BIODATA PESERTA UJI KOMPETENSI
// ===========================================================================

interface BiodataPesertaRow {
  id: string
  nama: string
  nip: string
  jenisKelamin: string
  pangkatGolongan: string
  tempatLahir: string
  tanggalLahir: string
  jabatan: string
  unitKerja: string
  instansi: string
  nomorHP: string
  status: string
  createdAt: string
  namaPelatihan: string
  kategori: string
  pesertaId: string | null
  angkatanInfo: {
    angkatanId: string
    namaAngkatan: string
    pelatihan: string
    status: string
    tanggalMulai: string
    tanggalSelesai: string
  } | null
  jadwalUji: {
    id: string
    kode: string
    tanggalUji: string
    skemaSertifikasi: string
    status: string
  } | null
  nilaiInfo: {
    id: string
    nilaiPreTest: number | null
    nilaiPostTest: number | null
    nilaiPraktik: number | null
    nilaiTeori: number | null
    nilaiAkhir: number | null
    statusKelulusan: string
  } | null
}

function UjiBiodataPesertaView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()

  const [data, setData] = useState<BiodataPesertaRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterUjiId, setFilterUjiId] = useState('')
  const [filterPelatihan, setFilterPelatihan] = useState('')

  // Uji kompetensi list for filter dropdown
  const [ujiList, setUjiList] = useState<{ id: string; kode: string; skemaSertifikasi: string; tanggalUji: string }[]>([])
  const [pelatihanOptions, setPelatihanOptions] = useState<string[]>([])

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<BiodataPesertaRow | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (search) params.set('search', search)
      if (filterUjiId) params.set('ujiId', filterUjiId)
      if (filterPelatihan) params.set('pelatihan', filterPelatihan)

      const res = await fetch(`/api/uji-kompetensi/biodata-peserta?${params.toString()}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal memuat data' }))
        throw new Error(err.error || 'Gagal memuat data')
      }
      const json = await res.json()
      setData(json.data)
      setTotal(json.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filterUjiId, filterPelatihan, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Fetch uji kompetensi list for filter
  useEffect(() => {
    fetch('/api/uji-kompetensi?pageSize=100', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((json) => setUjiList((json.data || []).map((u: any) => ({ id: u.id, kode: u.kode, skemaSertifikasi: u.skemaSertifikasi, tanggalUji: u.tanggalUji }))))
      .catch(() => {})
  }, [])

  // Extract unique pelatihan from data
  useEffect(() => {
    if (data.length > 0) {
      const names = [...new Set(data.map((r) => r.namaPelatihan).filter(Boolean))].sort()
      setPelatihanOptions(names)
    }
  }, [data])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleUjiFilter = (v: string) => { setFilterUjiId(v === 'all' ? '' : v); setPage(1) }
  const handlePelatihanFilter = (v: string) => { setFilterPelatihan(v === 'all' ? '' : v); setPage(1) }
  const handleReset = () => {
    setSearch('')
    setFilterUjiId('')
    setFilterPelatihan('')
    setPage(1)
  }

  const openDetail = (row: BiodataPesertaRow) => {
    setSelectedRow(row)
    setDetailOpen(true)
  }

  // Stats
  const totalTerhubung = data.filter((r) => r.jadwalUji).length
  const totalBelumTerhubung = data.filter((r) => !r.jadwalUji).length

  const KELULUSAN_MAP: Record<string, { label: string; cls: string }> = {
    LULUS: { label: 'Lulus', cls: 'bg-green-100 text-[#195737] border-[#86EFAC]' },
    TIDAK_LULUS: { label: 'Tidak Lulus', cls: 'bg-red-100 text-red-700 border-red-200' },
    BELUM: { label: 'Belum', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  }
  const PENDAFTARAN_MAP: Record<string, { label: string; cls: string }> = {
    MENUNGGU: { label: 'Menunggu', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    DITERIMA: { label: 'Diterima', cls: 'bg-green-100 text-[#195737] border-[#86EFAC]' },
    DITOLAK: { label: 'Ditolak', cls: 'bg-red-100 text-red-700 border-red-200' },
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Biodata Peserta Uji Kompetensi" description="Data pendaftar portal yang disinkronkan dengan jadwal uji kompetensi">
        <Button variant="outline" size="sm" onClick={() => setActiveView('uji-jadwal')} className="h-9">
          <ArrowRight className="w-4 h-4" /> Kembali ke Jadwal
        </Button>
      </PageHeader>

      {/* Filter Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Cari Nama / NIP</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-9 h-9 text-sm"
                  placeholder="Ketik nama atau NIP..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Uji Kompetensi</Label>
              <Select value={filterUjiId || 'all'} onValueChange={handleUjiFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Semua jadwal..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jadwal</SelectItem>
                  {ujiList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="font-mono text-xs">{u.kode}</span> — {u.skemaSertifikasi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Pelatihan</Label>
              <Select value={filterPelatihan || 'all'} onValueChange={handlePelatihanFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Semua pelatihan..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pelatihan</SelectItem>
                  {pelatihanOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={handleReset} className="h-9 w-full">
                <RotateCcw className="w-4 h-4 mr-1" /> Reset Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-[#0F4C81]" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Pendaftar Diterima</p>
                <p className="text-xl font-bold text-slate-900">{total}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <Link2 className="w-5 h-5 text-[#195737]" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Terhubung Uji Kompetensi</p>
                <p className="text-xl font-bold text-[#195737]">{totalTerhubung}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Unlink className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Belum Terhubung</p>
                <p className="text-xl font-bold text-orange-600">{totalBelumTerhubung}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Data Table */}
      {loading ? (
        <Card className="border-slate-200 shadow-sm animate-pulse">
          <CardContent className="p-5 h-72 bg-slate-100 rounded-xl" />
        </Card>
      ) : data.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">
            <FileUser className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            Belum ada data pendaftar yang diterima
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-base flex items-center gap-2">
              <FileUser className="w-4 h-4 text-[#0F4C81]" /> Daftar Pendaftar ({data.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-3 py-2.5 w-10">No</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5">Nama</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5">NIP</th>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-3 py-2.5 w-12">L/P</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5">Pangkat/Gol</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5">Jabatan</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5">Unit Kerja</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5">Pelatihan</th>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-3 py-2.5 w-24">Status</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5">Jadwal Uji</th>
                    <th className="text-left text-xs font-semibold text-slate-600 uppercase px-3 py-2.5">Angkatan</th>
                    <th className="text-center text-xs font-semibold text-slate-600 uppercase px-3 py-2.5 w-28">Kelulusan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((r, i) => {
                    const kelulusanBadge = r.nilaiInfo?.statusKelulusan
                      ? KELULUSAN_MAP[r.nilaiInfo.statusKelulusan] || { label: r.nilaiInfo.statusKelulusan, cls: 'bg-slate-100 text-slate-700 border-slate-200' }
                      : null
                    const pendaftaranBadge = PENDAFTARAN_MAP[r.status] || { label: r.status, cls: 'bg-slate-100 text-slate-700 border-slate-200' }
                    return (
                      <motion.tr
                        key={r.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="hover:bg-slate-50/80 cursor-pointer"
                        onClick={() => openDetail(r)}
                      >
                        <td className="px-3 py-2.5 text-center text-xs text-slate-500">{(page - 1) * pageSize + i + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-900 text-sm line-clamp-1">{r.nama}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-xs text-slate-600">{r.nip}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                            r.jenisKelamin === 'L'
                              ? 'bg-blue-50 text-blue-700'
                              : r.jenisKelamin === 'P'
                                ? 'bg-pink-50 text-pink-700'
                                : 'bg-slate-100 text-slate-400'
                          }`}>
                            {r.jenisKelamin || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 line-clamp-1">{r.pangkatGolongan || '-'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 line-clamp-1">{r.jabatan || '-'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 line-clamp-1">{r.unitKerja || '-'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 line-clamp-1">{r.namaPelatihan || '-'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${pendaftaranBadge.cls}`}>
                            {pendaftaranBadge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {r.jadwalUji ? (
                            <div>
                              <p className="font-mono text-xs font-semibold text-[#0F4C81]">{r.jadwalUji.kode}</p>
                              <p className="text-[10px] text-slate-400">{formatTanggalSingkat(r.jadwalUji.tanggalUji)}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 line-clamp-1">{r.angkatanInfo?.namaAngkatan || '-'}</td>
                        <td className="px-3 py-2.5 text-center">
                          {kelulusanBadge ? (
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${kelulusanBadge.cls}`}>
                              {kelulusanBadge.label}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">-</span>
                          )}
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <span>Menampilkan {data.length} dari {total} data</span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="sm" className="h-7 px-2 text-xs"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >Sebelumnya</Button>
              {Array.from({ length: Math.ceil(total / pageSize) }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === Math.ceil(total / pageSize) || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p} className="contents">
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-slate-300">...</span>}
                    <Button
                      variant={p === page ? 'default' : 'outline'}
                      size="sm" className={`h-7 w-7 p-0 text-xs ${p === page ? 'bg-[#195737] hover:bg-[#0F4227] text-white' : ''}`}
                      onClick={() => setPage(p)}
                    >{p}</Button>
                  </span>
                ))}
              <Button
                variant="outline" size="sm" className="h-7 px-2 text-xs"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage(page + 1)}
              >Selanjutnya</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUser className="w-5 h-5 text-[#0F4C81]" />
              Detail Biodata Peserta
            </DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-5">
              {/* Biodata Section */}
              <div>
                <h4 className="text-sm font-semibold text-[#0F4C81] mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Biodata Pendaftar
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Nama</span>
                    <span className="font-medium text-slate-900">: {selectedRow.nama}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">NIP</span>
                    <span className="font-mono font-medium text-slate-900">: {selectedRow.nip}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Jenis Kelamin</span>
                    <span className="font-medium text-slate-900">: {selectedRow.jenisKelamin === 'L' ? 'Laki-laki' : selectedRow.jenisKelamin === 'P' ? 'Perempuan' : '-'}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Pangkat/Golongan</span>
                    <span className="font-medium text-slate-900">: {selectedRow.pangkatGolongan || '-'}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Tempat Lahir</span>
                    <span className="font-medium text-slate-900">: {selectedRow.tempatLahir || '-'}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Tanggal Lahir</span>
                    <span className="font-medium text-slate-900">: {formatTanggal(selectedRow.tanggalLahir)}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Jabatan</span>
                    <span className="font-medium text-slate-900">: {selectedRow.jabatan || '-'}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Unit Kerja</span>
                    <span className="font-medium text-slate-900">: {selectedRow.unitKerja || '-'}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Instansi</span>
                    <span className="font-medium text-slate-900">: {selectedRow.instansi || '-'}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">No. HP</span>
                    <span className="font-medium text-slate-900">: {selectedRow.nomorHP || '-'}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Pelatihan</span>
                    <span className="font-medium text-slate-900">: {selectedRow.namaPelatihan || '-'}</span>
                  </div>
                  <div className="flex justify-between sm:justify-start gap-2">
                    <span className="text-slate-500 flex-shrink-0">Tgl Daftar</span>
                    <span className="font-medium text-slate-900">: {formatTanggal(selectedRow.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Angkatan Section */}
              {selectedRow.angkatanInfo && (
                <div>
                  <h4 className="text-sm font-semibold text-[#195737] mb-3 flex items-center gap-2">
                    <Link2 className="w-4 h-4" /> Info Angkatan
                  </h4>
                  <div className="bg-green-50/50 border border-[#86EFAC]/50 rounded-lg p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                      <div className="flex justify-between sm:justify-start gap-2">
                        <span className="text-slate-500 flex-shrink-0">Angkatan</span>
                        <span className="font-medium text-slate-900">: {selectedRow.angkatanInfo.namaAngkatan}</span>
                      </div>
                      <div className="flex justify-between sm:justify-start gap-2">
                        <span className="text-slate-500 flex-shrink-0">Status</span>
                        <span className="font-medium text-slate-900">: <StatusBadge status={selectedRow.angkatanInfo.status} /></span>
                      </div>
                      <div className="flex justify-between sm:justify-start gap-2">
                        <span className="text-slate-500 flex-shrink-0">Pelatihan</span>
                        <span className="font-medium text-slate-900">: {selectedRow.angkatanInfo.pelatihan || '-'}</span>
                      </div>
                      <div className="flex justify-between sm:justify-start gap-2">
                        <span className="text-slate-500 flex-shrink-0">Periode</span>
                        <span className="font-medium text-slate-900">: {formatTanggalSingkat(selectedRow.angkatanInfo.tanggalMulai)} — {formatTanggalSingkat(selectedRow.angkatanInfo.tanggalSelesai)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Uji Kompetensi Section */}
              {selectedRow.jadwalUji && (
                <div>
                  <h4 className="text-sm font-semibold text-[#0F4C81] mb-3 flex items-center gap-2">
                    <Award className="w-4 h-4" /> Jadwal Uji Kompetensi
                  </h4>
                  <div className="bg-blue-50/50 border border-blue-200/50 rounded-lg p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                      <div className="flex justify-between sm:justify-start gap-2">
                        <span className="text-slate-500 flex-shrink-0">Kode Uji</span>
                        <span className="font-mono font-semibold text-[#0F4C81]">: {selectedRow.jadwalUji.kode}</span>
                      </div>
                      <div className="flex justify-between sm:justify-start gap-2">
                        <span className="text-slate-500 flex-shrink-0">Tanggal</span>
                        <span className="font-medium text-slate-900">: {formatTanggal(selectedRow.jadwalUji.tanggalUji)}</span>
                      </div>
                      <div className="flex justify-between sm:justify-start gap-2 sm:col-span-2">
                        <span className="text-slate-500 flex-shrink-0">Skema Sertifikasi</span>
                        <span className="font-medium text-slate-900">: {selectedRow.jadwalUji.skemaSertifikasi}</span>
                      </div>
                      <div className="flex justify-between sm:justify-start gap-2">
                        <span className="text-slate-500 flex-shrink-0">Status Uji</span>
                        <span className="font-medium text-slate-900">: <StatusBadge status={selectedRow.jadwalUji.status} /></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Nilai Section */}
              {selectedRow.nilaiInfo && (
                <div>
                  <h4 className="text-sm font-semibold text-[#195737] mb-3 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4" /> Nilai / Kelulusan
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Pre Test</p>
                        <p className="text-lg font-bold text-slate-700">{selectedRow.nilaiInfo.nilaiPreTest ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Post Test</p>
                        <p className="text-lg font-bold text-slate-700">{selectedRow.nilaiInfo.nilaiPostTest ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Praktik</p>
                        <p className="text-lg font-bold text-slate-700">{selectedRow.nilaiInfo.nilaiPraktik ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Teori</p>
                        <p className="text-lg font-bold text-slate-700">{selectedRow.nilaiInfo.nilaiTeori ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-400 mb-1">Nilai Akhir</p>
                        <p className={`text-lg font-bold ${
                          (selectedRow.nilaiInfo.nilaiAkhir ?? 0) >= 70 ? 'text-[#198754]' : 'text-red-600'
                        }`}>
                          {selectedRow.nilaiInfo.nilaiAkhir ?? '-'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 flex justify-center">
                      <StatusBadge status={selectedRow.nilaiInfo.statusKelulusan} />
                    </div>
                  </div>
                </div>
              )}

              {/* Not linked notice */}
              {!selectedRow.angkatanInfo && !selectedRow.jadwalUji && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  <Unlink className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Belum Terhubung dengan Uji Kompetensi</p>
                    <p className="text-xs text-amber-600 mt-0.5">Peserta ini belum memiliki data angkatan atau jadwal uji kompetensi di sistem.</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="h-9">Tutup</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
