'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import type { AnalisisDiklatItem } from '@/lib/types'
import { PageHeader } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, Save, X, Download, Upload, Search,
  ChevronLeft, ChevronRight, RefreshCw, FileSpreadsheet,
} from 'lucide-react'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const METODE_OPTIONS = [
  { value: 'TATAP_MUKA', label: 'Tatap Muka' },
  { value: 'DARING', label: 'Daring' },
  { value: 'BLENDED', label: 'Blended' },
]

const KATEGORI_OPTIONS = [
  { value: 'TEKNIS', label: 'Teknis' },
  { value: 'MANAJERIAL', label: 'Manajerial' },
  { value: 'FUNGSIONAL', label: 'Fungsional' },
  { value: 'SOSIAL_KULTURAL', label: 'Sosial Kultural' },
]

const PRIORITAS_OPTIONS = [
  { value: 'TINGGI', label: 'Tinggi' },
  { value: 'SEDANG', label: 'Sedang' },
  { value: 'RENDAH', label: 'Rendah' },
]

const FILTER_PRIORITAS = [
  { value: 'TINGGI', label: 'Tinggi' },
  { value: 'SEDANG', label: 'Sedang' },
  { value: 'RENDAH', label: 'Rendah' },
]

const METODE_LABEL: Record<string, string> = {
  TATAP_MUKA: 'Tatap Muka',
  DARING: 'Daring',
  BLENDED: 'Blended',
}

const KATEGORI_LABEL: Record<string, string> = {
  TEKNIS: 'Teknis',
  MANAJERIAL: 'Manajerial',
  FUNGSIONAL: 'Fungsional',
  SOSIAL_KULTURAL: 'Sosial Kultural',
}

const PRIORITAS_LABEL: Record<string, string> = {
  TINGGI: 'Tinggi',
  SEDANG: 'Sedang',
  RENDAH: 'Rendah',
}

const METODE_COLORS: Record<string, string> = {
  TATAP_MUKA: 'bg-blue-100 text-blue-700',
  DARING: 'bg-green-100 text-[#195737]',
  BLENDED: 'bg-purple-100 text-purple-700',
}

const KATEGORI_COLORS: Record<string, string> = {
  TEKNIS: 'bg-[#195737]/10 text-[#195737]',
  MANAJERIAL: 'bg-amber-50 text-amber-700',
  FUNGSIONAL: 'bg-blue-50 text-blue-700',
  SOSIAL_KULTURAL: 'bg-purple-50 text-purple-700',
}

const PRIORITAS_COLORS: Record<string, string> = {
  TINGGI: 'bg-orange-100 text-orange-700',
  SEDANG: 'bg-blue-100 text-blue-700',
  RENDAH: 'bg-slate-100 text-slate-600',
}

const STATUS_LABEL: Record<string, string> = {
  AKTIF: 'Aktif',
  NONAKTIF: 'Nonaktif',
}

const STATUS_COLORS: Record<string, string> = {
  AKTIF: 'bg-green-100 text-green-700',
  NONAKTIF: 'bg-slate-100 text-slate-500',
}

function generateTahunOptions() {
  const now = new Date().getFullYear()
  const years: { value: string; label: string }[] = []
  for (let y = now - 2; y <= now + 5; y++) {
    years.push({ value: String(y), label: String(y) })
  }
  return years
}

const TAHUN_OPTIONS = generateTahunOptions()

const EMPTY_FORM: Partial<AnalisisDiklatItem> = {
  outcome: '',
  programPrioritasRPJMA: '',
  sasaranRPJMA: '',
  skpaSasaran: '',
  namaPelatihan: '',
  kategori: 'TEKNIS',
  metodePembelajaran: 'TATAP_MUKA',
  durasiJP: 0,
  durasiHari: 0,
  targetOutput: '',
  prioritas: 'SEDANG',
  tahunPelaksanaan: new Date().getFullYear(),
  status: 'AKTIF',
}

// ===========================================================================
// ROOT COMPONENT
// ===========================================================================

export function AnalisisDiklatInputView() {
  return <AnalisisDiklatTable />
}

// ===========================================================================
// MAIN TABLE VIEW
// ===========================================================================

function AnalisisDiklatTable() {
  const { toast } = useToast()

  const [data, setData] = useState<AnalisisDiklatItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTahun, setFilterTahun] = useState('')
  const [filterPrioritas, setFilterPrioritas] = useState('')

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AnalisisDiklatItem | null>(null)
  const [form, setForm] = useState<Partial<AnalisisDiklatItem>>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<AnalisisDiklatItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        prioritas: filterPrioritas || undefined,
        tahun: filterTahun || undefined,
      }
      const res = await api.analisisDiklat.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filterTahun, filterPrioritas, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilterTahun = (v: string) => { setFilterTahun(v); setPage(1) }
  const handleFilterPrioritas = (v: string) => { setFilterPrioritas(v); setPage(1) }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, tahunPelaksanaan: new Date().getFullYear() })
    setDialogOpen(true)
  }

  const openEdit = (item: AnalisisDiklatItem) => {
    setEditing(item)
    setForm({
      outcome: item.outcome,
      programPrioritasRPJMA: item.programPrioritasRPJMA,
      sasaranRPJMA: item.sasaranRPJMA,
      skpaSasaran: item.skpaSasaran,
      namaPelatihan: item.namaPelatihan,
      kategori: item.kategori,
      metodePembelajaran: item.metodePembelajaran,
      durasiJP: item.durasiJP,
      durasiHari: item.durasiHari,
      targetOutput: item.targetOutput,
      prioritas: item.prioritas,
      tahunPelaksanaan: item.tahunPelaksanaan,
      status: item.status,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.namaPelatihan?.trim()) {
      toast({ title: 'Validasi', description: 'Nama Pelatihan wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.analisisDiklat.update(editing.id, form)
        toast({ title: 'Berhasil', description: 'Data diperbarui' })
      } else {
        await api.analisisDiklat.create(form)
        toast({ title: 'Berhasil', description: 'Data baru ditambahkan' })
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
      await api.analisisDiklat.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Data dihapus' })
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = () => {
    api.analisisDiklat.exportXls()
    toast({ title: 'Ekspor', description: 'File XLS sedang diunduh...' })
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const res = await api.analisisDiklat.importXls(file)
      toast({ title: 'Berhasil', description: `${res.imported} data berhasil diimpor` })
      fetchData()
    } catch (err) {
      toast({ title: 'Gagal', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const totalPages = Math.ceil(total / pageSize) || 1
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Input Analisis Kebutuhan Diklat"
        description="Kelola data analisis kebutuhan diklat dengan fitur ekspor/impor XLS"
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="h-9 border-[#4ADE80] text-[#195737] hover:bg-green-50">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Ekspor XLS</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => { api.analisisDiklat.downloadTemplate(); toast({ title: 'Template', description: 'Template XLS sedang diunduh...' }) }} className="h-9 border-slate-300 text-slate-600 hover:bg-slate-50">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Template</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="h-9 border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <Upload className={cn('w-4 h-4', importing && 'animate-bounce')} />
            <span className="hidden sm:inline">{importing ? 'Mengimpor...' : 'Impor XLS'}</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </PageHeader>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Cari outcome, pelatihan, sasaran..."
                  className="pl-9 h-9"
                />
              </div>
              <Select value={filterTahun || 'all'} onValueChange={(v) => handleFilterTahun(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 w-full sm:w-36">
                  <SelectValue placeholder="Tahun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tahun</SelectItem>
                  {TAHUN_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPrioritas || 'all'} onValueChange={(v) => handleFilterPrioritas(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 w-full sm:w-36">
                  <SelectValue placeholder="Prioritas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Prioritas</SelectItem>
                  {FILTER_PRIORITAS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-9">
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button size="sm" onClick={openCreate} className="h-9 bg-[#0F4C81] hover:bg-[#0a3a63]">
                <Plus className="w-4 h-4" />
                Tambah Data
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-slate-200 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide w-12 text-center">No</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[180px]">Outcome</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[160px]">Program Prioritas RPJMA</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[140px]">Sasaran RPJMA</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[120px]">SKPA Sasaran</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[140px]">Kategori</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[160px]">Nama Pelatihan</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[120px]">Metode</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide w-20 text-center">Durasi (JP)</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide w-24 text-center">Lama Hari</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide min-w-[140px]">Target Output</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide w-24 text-center">Prioritas</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide w-28 text-center">Tahun</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide w-20 text-center">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide text-right w-[100px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 14 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-12 text-slate-400">
                        <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p>Belum ada data analisis diklat</p>
                        <p className="text-xs mt-1">Klik &quot;Tambah Data&quot; atau impor dari file XLS</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((row, idx) => (
                      <TableRow key={row.id} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <TableCell className="text-sm text-slate-500 text-center tabular-nums">{start + idx}</TableCell>
                        <TableCell className="text-sm text-slate-700 max-w-[200px]">
                          <p className="line-clamp-2" title={row.outcome}>{row.outcome || '-'}</p>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-[180px]">
                          <p className="line-clamp-2" title={row.programPrioritasRPJMA}>{row.programPrioritasRPJMA || '-'}</p>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-[160px]">
                          <p className="line-clamp-2" title={row.sasaranRPJMA}>{row.sasaranRPJMA || '-'}</p>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-[140px]">
                          <p className="line-clamp-2" title={row.skpaSasaran}>{row.skpaSasaran || '-'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn('text-xs font-medium px-2 py-0.5', KATEGORI_COLORS[row.kategori] || '')}>
                            {KATEGORI_LABEL[row.kategori] || row.kategori}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-slate-800 max-w-[180px]">
                          <p className="line-clamp-2" title={row.namaPelatihan}>{row.namaPelatihan || '-'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn('text-xs font-medium px-2 py-0.5', METODE_COLORS[row.metodePembelajaran] || '')}>
                            {METODE_LABEL[row.metodePembelajaran] || row.metodePembelajaran}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 text-center tabular-nums">{row.durasiJP ? `${row.durasiJP} JP` : '-'}</TableCell>
                        <TableCell className="text-sm text-slate-700 text-center tabular-nums">{row.durasiHari ? `${row.durasiHari} hari` : '-'}</TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-[160px]">
                          <p className="line-clamp-2" title={row.targetOutput}>{row.targetOutput || '-'}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className={cn('text-xs font-medium px-2 py-0.5', PRIORITAS_COLORS[row.prioritas] || '')}>
                            {PRIORITAS_LABEL[row.prioritas] || row.prioritas}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700 text-center tabular-nums">{row.tahunPelaksanaan}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className={cn('text-xs font-medium px-2 py-0.5', STATUS_COLORS[row.status] || '')}>
                            {STATUS_LABEL[row.status] || row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-[#0F4C81]" onClick={() => openEdit(row)} title="Edit">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-red-600" onClick={() => setDeleteTarget(row)} title="Hapus">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <p className="text-slate-500 text-xs">
              Menampilkan <span className="font-medium text-slate-700">{start}-{end}</span> dari <span className="font-medium text-slate-700">{total}</span> data
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1 || loading} className="h-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                  let p = i + 1
                  if (totalPages > 5) {
                    if (page > 3) p = page - 2 + i
                    if (page > totalPages - 2) p = totalPages - 4 + i
                  }
                  if (p < 1 || p > totalPages) return null
                  return (
                    <Button
                      key={p}
                      variant={p === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(p)}
                      disabled={loading}
                      className={cn('h-8 w-8 p-0', p === page && 'bg-[#0F4C81] hover:bg-[#0a3a63]')}
                    >
                      {p}
                    </Button>
                  )
                })}
              </div>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages || loading} className="h-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Data Analisis Diklat' : 'Tambah Data Analisis Diklat'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Outcome</Label>
              <Textarea
                value={form.outcome || ''}
                onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                placeholder="Deskripsi outcome yang diharapkan"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Program Prioritas RPJMA</Label>
              <Input
                value={form.programPrioritasRPJMA || ''}
                onChange={(e) => setForm({ ...form, programPrioritasRPJMA: e.target.value })}
                placeholder="Program prioritas RPJMA"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sasaran RPJMA</Label>
              <Input
                value={form.sasaranRPJMA || ''}
                onChange={(e) => setForm({ ...form, sasaranRPJMA: e.target.value })}
                placeholder="Sasaran RPJMA"
              />
            </div>
            <div className="space-y-1.5">
              <Label>SKPA Sasaran</Label>
              <Input
                value={form.skpaSasaran || ''}
                onChange={(e) => setForm({ ...form, skpaSasaran: e.target.value })}
                placeholder="SKPA Sasaran"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kategori <span className="text-red-500">*</span></Label>
              <Select value={form.kategori || 'TEKNIS'} onValueChange={(v) => setForm({ ...form, kategori: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KATEGORI_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nama Pelatihan <span className="text-red-500">*</span></Label>
              <Input
                value={form.namaPelatihan || ''}
                onChange={(e) => setForm({ ...form, namaPelatihan: e.target.value })}
                placeholder="Nama pelatihan"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Metode Pembelajaran</Label>
              <Select value={form.metodePembelajaran || 'TATAP_MUKA'} onValueChange={(v) => setForm({ ...form, metodePembelajaran: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Durasi (JP)</Label>
              <Input
                type="number"
                min={0}
                value={form.durasiJP ?? 0}
                onChange={(e) => setForm({ ...form, durasiJP: parseInt(e.target.value, 10) || 0 })}
                placeholder="Jam Pelajaran"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lama Hari</Label>
              <Input
                type="number"
                min={0}
                value={form.durasiHari ?? 0}
                onChange={(e) => setForm({ ...form, durasiHari: parseInt(e.target.value, 10) || 0 })}
                placeholder="Hari"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Target Output</Label>
              <Textarea
                value={form.targetOutput || ''}
                onChange={(e) => setForm({ ...form, targetOutput: e.target.value })}
                placeholder="Target output yang diharapkan"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prioritas</Label>
              <Select value={form.prioritas || 'SEDANG'} onValueChange={(v) => setForm({ ...form, prioritas: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITAS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tahun Pelaksanaan</Label>
              <Input
                type="number"
                min={2020}
                max={2035}
                value={form.tahunPelaksanaan ?? new Date().getFullYear()}
                onChange={(e) => setForm({ ...form, tahunPelaksanaan: parseInt(e.target.value, 10) || new Date().getFullYear() })}
                placeholder="Tahun"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status Publikasi</Label>
              <Select value={form.status || 'AKTIF'} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AKTIF">Tampilkan di Portal</SelectItem>
                  <SelectItem value="NONAKTIF">Sembunyikan</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">Pilih &quot;Tampilkan di Portal&quot; agar muncul di Jelajahi Program.</p>
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
              Yakin ingin menghapus data <span className="font-semibold">&quot;{deleteTarget?.namaPelatihan}&quot;</span>? Tindakan ini tidak dapat dibatalkan.
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
