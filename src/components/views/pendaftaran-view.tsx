'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavStore } from '@/store/auth-store'
import { DataTable, PageHeader, type Column, type FilterOption } from '@/components/shared/data-table'
import { formatTanggalSingkat, formatDateTime } from '@/components/shared/ui-helpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import {
  ArrowLeft, Download, Loader2, FileText, CheckCircle2, XCircle, Clock, AlertCircle,
  Pencil, FileSpreadsheet, FileDown, Eye, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ===========================================================================
// TYPES
// ===========================================================================

interface PendaftaranItem {
  id: string
  nama: string
  nip: string
  pangkatGolongan: string
  jenisKelamin: string
  tempatLahir: string
  tanggalLahir: string
  jabatan: string
  unitKerja: string
  instansi: string
  nomorHP: string
  nomorRekening: string
  npwp: string
  pelatihan: string
  pelatihanKategori: string
  pelatihanMetode: string
  pelatihanJP: number
  pelatihanTahun: number
  status: string
  catatanAdmin: string
  jumlahDokumen: number
  createdAt: string
  updatedAt: string
}

interface DokumenItem {
  id: string
  tipe: string
  label: string
  namaFile: string
  ukuran: string
  terakhirDiupload: string
}

interface PendaftaranDetail extends PendaftaranItem {
 dokumen: DokumenItem[]
}

interface PendaftaranListResponse {
  data: PendaftaranItem[]
  total: number
  page: number
  pageSize: number
}

// ===========================================================================
// CONSTANTS
// ===========================================================================

const STATUS_OPTIONS = [
  { value: 'MENUNGGU', label: 'Menunggu' },
  { value: 'DITERIMA', label: 'Diterima' },
  { value: 'DITOLAK', label: 'Ditolak' },
]

const STATUS_STYLE: Record<string, string> = {
  MENUNGGU: 'bg-amber-50 text-amber-700 border-amber-200',
  DITERIMA: 'bg-green-50 text-[#195737] border-[#86EFAC]',
  DITOLAK: 'bg-red-50 text-red-700 border-red-200',
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  MENUNGGU: Clock,
  DITERIMA: CheckCircle2,
  DITOLAK: XCircle,
}

const TIPE_DOKUMEN_LABELS: Record<string, string> = {
  KTP: 'KTP',
  SURAT_TUGAS: 'Surat Tugas',
  NPWP: 'NPWP',
  REK_BANK: 'REK Bank Aceh',
}

// Module-level selected ID shared between list and detail views
let _selectedPendaftaranId = ''

// ===========================================================================
// ROOT COMPONENT
// ===========================================================================

export function PendaftaranView() {
  const { activeView, setActiveView } = useNavStore()

  if (activeView === 'pendaftaran-dokumen') return <PendaftaranDokumenView />
  return <PendaftaranListView />
}

// ===========================================================================
// SUB-VIEW 1: DATA PENDAFTAR LIST (with Edit, Export PDF, Export Excel)
// ===========================================================================

function PendaftaranListView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()

  const [data, setData] = useState<PendaftaranItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pelatihanFilter, setPelatihanFilter] = useState('')
  const [pelatihanOptions, setPelatihanOptions] = useState<{ id: string; nama: string }[]>([])

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<PendaftaranItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Fetch pelatihan options untuk dropdown filter
  useEffect(() => {
    fetch('/api/portal/pelatihan-list', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((list: { id: string; nama: string }[]) => setPelatihanOptions(list))
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        status: statusFilter || undefined,
        pelatihanId: pelatihanFilter || undefined,
      }
      const qs = '?' + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)
      ).toString()
      const res = await fetch(`/api/pendaftaran${qs}`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: PendaftaranListResponse = await res.json()
      setData(json.data)
      setTotal(json.total)
    } catch (e) {
      toast({ title: 'Gagal memuat data', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, statusFilter, pelatihanFilter, toast])

  useEffect(() => { fetchData() }, [fetchData])

  // Export handlers
  const handleExportXls = () => {
    const params = statusFilter ? `?status=${statusFilter}` : ''
    window.location.href = `/api/pendaftaran/export/xls${params}`
  }

  const handleExportPdf = () => {
    const params = statusFilter ? `?status=${statusFilter}` : ''
    window.location.href = `/api/pendaftaran/export/pdf${params}`
  }

  const handleRowClick = (item: PendaftaranItem) => {
    _selectedPendaftaranId = item.id
    setActiveView('pendaftaran-dokumen')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/pendaftaran/${deleteTarget.id}`, { method: 'DELETE', credentials: 'same-origin' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      toast({ title: 'Berhasil', description: `Pendaftaran ${deleteTarget.nama} dihapus` })
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal menghapus', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const filters: FilterOption[] = [
    {
      key: 'status',
      label: 'Status',
      options: STATUS_OPTIONS,
    },
  ]

  const columns: Column<PendaftaranItem>[] = [
    {
      key: 'no',
      header: 'No',
      width: '50px',
      render: (_row, i) => <span className="text-slate-500">{(page - 1) * pageSize + i + 1}</span>,
    },
    {
      key: 'nama',
      header: 'Nama',
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleRowClick(row) }}
          className="text-left font-medium text-[#0F4C81] hover:text-[#195737] hover:underline transition-colors"
        >
          {row.nama}
        </button>
      ),
    },
    { key: 'nip', header: 'NIP', render: (row) => <span className="text-xs font-mono">{row.nip}</span> },
    { key: 'jenisKelamin', header: 'L/P', render: (row) => <span className="text-xs text-slate-600">{row.jenisKelamin === 'L' ? 'Laki-laki' : row.jenisKelamin === 'P' ? 'Perempuan' : '-'}</span> },
    { key: 'jabatan', header: 'Jabatan', render: (row) => <span className="text-slate-600 max-w-[150px] truncate block">{row.jabatan || '-'}</span> },
    { key: 'unitKerja', header: 'Unit Kerja', render: (row) => <span className="text-slate-600 max-w-[150px] truncate block">{row.unitKerja || '-'}</span> },
    { key: 'instansi', header: 'Instansi', render: (row) => <span className="text-slate-600 max-w-[150px] truncate block">{row.instansi || '-'}</span> },
    { key: 'pelatihan', header: 'Pelatihan', render: (row) => <span className="text-slate-600 max-w-[180px] truncate block">{row.pelatihan || '-'}</span> },
    { key: 'nomorHP', header: 'No. HP' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const Icon = STATUS_ICON[row.status] || AlertCircle
        return (
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', STATUS_STYLE[row.status])}>
            <Icon className="w-3 h-3" />
            {STATUS_OPTIONS.find((o) => o.value === row.status)?.label || row.status}
          </span>
        )
      },
    },
    { key: 'jumlahDokumen', header: 'Dok', render: (row) => <span className="text-center block font-medium">{row.jumlahDokumen}/4</span> },
    { key: 'createdAt', header: 'Tgl Daftar', render: (row) => <span className="text-slate-500 text-xs whitespace-nowrap">{formatTanggalSingkat(row.createdAt)}</span> },
  ]

  return (
    <div>
      <PageHeader title="Data Pendaftar" description="Kelola pendaftaran peserta dari portal publik">
        <div className="flex items-center gap-2">
          {pelatihanOptions.length > 1 && (
            <Select value={pelatihanFilter || '__all__'} onValueChange={(v) => { setPelatihanFilter(v === '__all__' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-9 text-sm w-56">
                <SelectValue placeholder="Semua Pelatihan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Semua Pelatihan</SelectItem>
                {pelatihanOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportXls}
            className="h-9 text-[#195737] border-[#86EFAC] hover:bg-[#195737] hover:text-white hover:border-[#195737]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">Export Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            className="h-9 text-[#195737] border-[#86EFAC] hover:bg-[#195737] hover:text-white hover:border-[#195737]"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">Export PDF</span>
          </Button>
        </div>
      </PageHeader>
      <DataTable<PendaftaranItem>
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari nama, NIP, instansi, jabatan..."
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        onPageChange={setPage}
        filters={filters}
        filterValues={{ status: statusFilter }}
        onFilterChange={(key, value) => {
          if (key === 'status') { setStatusFilter(value); setPage(1) }
        }}
        onRefresh={fetchData}
        rowKey={(row) => row.id}
        emptyMessage="Belum ada data pendaftaran dari portal"
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-[#195737]" onClick={(e) => { e.stopPropagation(); _selectedPendaftaranId = row.id; setActiveView('pendaftaran-dokumen') }} title="Lihat Detail">
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }} title="Hapus">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus pendaftaran <span className="font-semibold">{deleteTarget?.nama}</span> (NIP: {deleteTarget?.nip})? Seluruh dokumen yang diunggah juga akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.
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
// SUB-VIEW 2: DOKUMEN PESERTA DETAIL (with Edit Biodata)
// ===========================================================================

function PendaftaranDokumenView() {
  const { setActiveView } = useNavStore()
  const { toast } = useToast()

  // React state untuk tracking selected pendaftaran (sinkron dari module-level var)
  const [selectedId, setSelectedId] = useState(_selectedPendaftaranId)
  const isListMode = !selectedId

  const [data, setData] = useState<PendaftaranDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Status update dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [catatan, setCatatan] = useState('')

  // Edit biodata dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    nama: '', nip: '', pangkatGolongan: '', jenisKelamin: '', tempatLahir: '', tanggalLahir: '',
    jabatan: '', unitKerja: '', instansi: '', nomorHP: '', nomorRekening: '', npwp: '',
  })

  // === LIST MODE STATE ===
  const [listData, setListData] = useState<PendaftaranItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listSearch, setListSearch] = useState('')
  const [listStatusFilter, setListStatusFilter] = useState('')
  const [listPelatihanFilter, setListPelatihanFilter] = useState('')

  // Unique pelatihan list dari data yang sudah di-load
  const pelatihanOptions = useMemo(() => {
    const set = new Set(listData.map((d) => d.pelatihan).filter(Boolean))
    return Array.from(set).sort()
  }, [listData])

  // Filtered data berdasarkan pelatihan
  const filteredListData = useMemo(() => {
    if (!listPelatihanFilter) return listData
    return listData.filter((d) => d.pelatihan === listPelatihanFilter)
  }, [listData, listPelatihanFilter])

  // Fetch list data (list mode)
  const fetchListData = useCallback(async () => {
    setListLoading(true)
    try {
      const params: Record<string, string> = {}
      if (listSearch) params.search = listSearch
      if (listStatusFilter) params.status = listStatusFilter
      params.pageSize = '100'
      const qs = '?' + new URLSearchParams(params).toString()
      const res = await fetch(`/api/pendaftaran${qs}`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: PendaftaranListResponse = await res.json()
      setListData(json.data)
    } catch (e) {
      toast({ title: 'Gagal memuat data', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setListLoading(false)
    }
  }, [listSearch, listStatusFilter, toast])

  // Fetch detail data (detail mode)
  const fetchDetailData = useCallback(async () => {
    if (!selectedId) { setLoading(false); return }
    setLoading(true)
    try {
      const detailRes = await fetch(`/api/pendaftaran/${selectedId}`, { credentials: 'same-origin' })
      if (!detailRes.ok) throw new Error(`HTTP ${detailRes.status}`)
      const detail = await detailRes.json()
      setData(detail)
    } catch (e) {
      toast({ title: 'Gagal memuat detail', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [selectedId, toast])

  useEffect(() => {
    if (isListMode) fetchListData()
    else fetchDetailData()
  }, [isListMode, fetchListData, fetchDetailData])

  // Handler: pilih pendaftar dari daftar
  const handleSelectPendaftar = (item: PendaftaranItem) => {
    _selectedPendaftaranId = item.id
    setSelectedId(item.id)
    setData(null)
  }

  // Handler: kembali ke daftar dari detail
  const handleBackToList = () => {
    _selectedPendaftaranId = ''
    setSelectedId('')
    setData(null)
  }

  const handleUpdateStatus = async () => {
    if (!data || !newStatus) return
    setSaving(true)
    try {
      const res = await fetch(`/api/pendaftaran/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: newStatus, catatanAdmin: catatan }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const updated = await res.json()
      setData(updated)
      setStatusDialogOpen(false)
      setNewStatus('')
      setCatatan('')
      toast({ title: 'Berhasil', description: 'Status pendaftaran diperbarui' })
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const openEditDialog = () => {
    if (!data) return
    setEditForm({
      nama: data.nama,
      nip: data.nip,
      pangkatGolongan: data.pangkatGolongan,
      jenisKelamin: (data as any).jenisKelamin || '',
      tempatLahir: data.tempatLahir,
      tanggalLahir: data.tanggalLahir,
      jabatan: data.jabatan,
      unitKerja: data.unitKerja,
      instansi: data.instansi,
      nomorHP: data.nomorHP,
      nomorRekening: data.nomorRekening,
      npwp: data.npwp,
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!data) return
    if (!editForm.nama.trim()) { toast({ title: 'Validasi', description: 'Nama wajib diisi', variant: 'destructive' }); return }
    if (!/^\d{18}$/.test(editForm.nip.trim())) { toast({ title: 'Validasi', description: 'NIP harus 18 digit', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/pendaftaran/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(editForm),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const updated = await res.json()
      setData(updated)
      setEditDialogOpen(false)
      toast({ title: 'Berhasil', description: 'Biodata pendaftar diperbarui' })
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadDokumen = async (id: string, tipe: string, label: string) => {
    try {
      const res = await fetch(`/api/pendaftaran/${id}/dokumen/${tipe}`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${label.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'Gagal mengunduh', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const openStatusDialog = () => {
    if (!data) return
    setNewStatus(data.status)
    setCatatan(data.catatanAdmin || '')
    setStatusDialogOpen(true)
  }

  const editSet = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditForm((p) => ({ ...p, [k]: e.target.value }))

  // ========================
  // LIST MODE RENDER
  // ========================
  if (isListMode) {
    return (
      <div>
        <PageHeader title="Dokumen Peserta" description="Pilih pendaftar untuk melihat dokumen yang diunggah">
          <Button size="sm" variant="outline" onClick={() => setActiveView('pendaftaran-list')} className="h-9 text-[#195737] border-[#86EFAC] hover:bg-[#195737] hover:text-white hover:border-[#195737]">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">Data Pendaftar</span>
          </Button>
        </PageHeader>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-sm font-bold text-slate-900">Daftar Pendaftar & Dokumen</CardTitle>
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <Select value={listPelatihanFilter || '__all__'} onValueChange={(v) => setListPelatihanFilter(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-sm w-52">
                    <SelectValue placeholder="Semua Pelatihan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua Pelatihan</SelectItem>
                    {pelatihanOptions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Cari nama, NIP..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="h-8 text-sm w-48"
                />
                <Select value={listStatusFilter || undefined} onValueChange={(v) => setListStatusFilter(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-8 text-sm w-32">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua Status</SelectItem>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#0F4C81]" />
                <p className="text-sm text-slate-500">Memuat data pendaftar...</p>
              </div>
            ) : filteredListData.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400">Tidak ada pendaftar untuk pelatihan ini</p>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">No</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Nama / NIP</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Pelatihan</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Dokumen</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredListData.map((item, idx) => {
                      const Icon = STATUS_ICON[item.status] || AlertCircle
                      const docComplete = item.jumlahDokumen >= 4
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3 text-slate-500 text-xs">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <p className="font-medium text-slate-800 text-sm">{item.nama}</p>
                            <p className="text-xs font-mono text-slate-400">{item.nip}</p>
                          </td>
                          <td className="py-2.5 px-3 hidden md:table-cell">
                            <span className="text-xs text-slate-600 max-w-[200px] truncate block">{item.pelatihan || '-'}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                              docComplete ? 'bg-green-50 text-[#195737]' : 'bg-amber-50 text-amber-600'
                            )}>
                              {docComplete ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                              {item.jumlahDokumen}/4
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', STATUS_STYLE[item.status])}>
                              <Icon className="w-3 h-3" />
                              {STATUS_OPTIONS.find((o) => o.value === item.status)?.label || item.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-[#195737]" onClick={() => handleSelectPendaftar(item)} title="Lihat Dokumen">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ========================
  // DETAIL MODE - Loading & Empty States
  // ========================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#0F4C81]" />
        <p className="text-sm text-slate-500">Memuat detail pendaftaran...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500">Data pendaftaran tidak ditemukan</p>
        <Button variant="outline" className="mt-4" onClick={handleBackToList}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Daftar
        </Button>
      </div>
    )
  }

  const StatusIcon = STATUS_ICON[data.status] || AlertCircle

  const detailSections = [
    {
      title: 'Data Pribadi',
      fields: [
        { label: 'Nama Lengkap', value: data.nama },
        { label: 'NIP', value: data.nip },
        { label: 'Pangkat/Golongan', value: data.pangkatGolongan },
        { label: 'Jenis Kelamin', value: (data as any).jenisKelamin === 'L' ? 'Laki-laki' : (data as any).jenisKelamin === 'P' ? 'Perempuan' : '-' },
        { label: 'Tempat Lahir', value: data.tempatLahir },
        { label: 'Tanggal Lahir', value: data.tanggalLahir },
      ],
    },
    {
      title: 'Jabatan & Instansi',
      fields: [
        { label: 'Jabatan', value: data.jabatan },
        { label: 'Unit Kerja', value: data.unitKerja },
        { label: 'Instansi', value: data.instansi },
      ],
    },
    {
      title: 'Kontak & Rekening',
      fields: [
        { label: 'No. HP', value: data.nomorHP },
        { label: 'No. REK Bank Aceh', value: data.nomorRekening },
        { label: 'NPWP', value: data.npwp },
      ],
    },
    {
      title: 'Pelatihan',
      fields: [
        { label: 'Nama Pelatihan', value: data.pelatihan },
        { label: 'Tanggal Daftar', value: formatDateTime(data.createdAt) },
        { label: 'Terakhir Diupdate', value: formatDateTime(data.updatedAt) },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      {/* Back button & header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleBackToList}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Detail Pendaftaran</h2>
            <p className="text-sm text-slate-500">Dokumen & verifikasi pendaftaran peserta</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium', STATUS_STYLE[data.status])}>
            <StatusIcon className="w-4 h-4" />
            {STATUS_OPTIONS.find((o) => o.value === data.status)?.label || data.status}
          </span>
          <Button size="sm" variant="outline" onClick={openEditDialog} className="h-9 text-[#195737] border-[#86EFAC] hover:bg-[#195737] hover:text-white hover:border-[#195737]">
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">Edit Biodata</span>
          </Button>
          <Button size="sm" onClick={openStatusDialog} className="h-9 bg-[#195737] hover:bg-[#0F4227] text-white">
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline ml-1.5">Update Status</span>
          </Button>
        </div>
      </div>

      {/* Biodata cards - responsive grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {detailSections.map((section) => (
          <Card key={section.title} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {section.fields.map((f) => (
                  <div key={f.label} className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide sm:w-36 sm:flex-shrink-0">{f.label}</span>
                    <span className="text-sm text-slate-700">{f.value || '-'}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Catatan Admin */}
      {data.catatanAdmin && (
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Catatan Admin</p>
                <p className="text-sm text-amber-800 mt-1">{data.catatanAdmin}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dokumen card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-slate-900">
            Dokumen Unggahan ({data.dokumen?.length || 0}/4)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data.dokumen || data.dokumen.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">Belum ada dokumen yang diunggah</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.dokumen.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#195737]/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-[#195737]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {TIPE_DOKUMEN_LABELS[doc.tipe] || doc.label || doc.tipe}
                      </p>
                      <p className="text-xs text-slate-400">
                        {doc.namaFile} • {doc.ukuran}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadDokumen(data.id, doc.tipe, TIPE_DOKUMEN_LABELS[doc.tipe] || doc.label || doc.tipe)}
                    className="flex-shrink-0 h-8 text-[#195737] border-[#86EFAC] hover:bg-[#195737] hover:text-white"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline ml-1">Unduh</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Biodata Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Biodata Pendaftar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nama Lengkap <span className="text-red-500">*</span></Label>
                <Input value={editForm.nama} onChange={editSet('nama')} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>NIP <span className="text-red-500">*</span></Label>
                <Input value={editForm.nip} onChange={editSet('nip')} maxLength={18} className="h-10 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Pangkat/Golongan</Label>
                <Input value={editForm.pangkatGolongan} onChange={editSet('pangkatGolongan')} placeholder="Contoh: III/c" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Jenis Kelamin</Label>
                <select
                  value={editForm.jenisKelamin}
                  onChange={(e) => setEditForm((p) => ({ ...p, jenisKelamin: e.target.value }))}
                  className="w-full h-10 bg-white border border-slate-300 rounded-md text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#195737]/20 focus:border-[#195737]"
                >
                  <option value="">-- Pilih --</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Tempat Lahir</Label>
                <Input value={editForm.tempatLahir} onChange={editSet('tempatLahir')} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal Lahir</Label>
                <Input type="date" value={editForm.tanggalLahir} onChange={editSet('tanggalLahir')} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Jabatan</Label>
                <Input value={editForm.jabatan} onChange={editSet('jabatan')} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Kerja</Label>
                <Input value={editForm.unitKerja} onChange={editSet('unitKerja')} className="h-10" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Instansi</Label>
                <Input value={editForm.instansi} onChange={editSet('instansi')} className="h-10" />
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Kontak & Rekening</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>No. HP</Label>
                  <Input value={editForm.nomorHP} onChange={editSet('nomorHP')} className="h-10" />
                </div>
                <div className="space-y-1.5">
                  <Label>NPWP</Label>
                  <Input value={editForm.npwp} onChange={editSet('npwp')} className="h-10" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nomor REK Bank Aceh</Label>
                  <Input value={editForm.nomorRekening} onChange={editSet('nomorRekening')} className="h-10" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}>Batal</Button>
            </DialogClose>
            <Button onClick={handleSaveEdit} disabled={saving} className="bg-[#195737] hover:bg-[#0F4227] text-white">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Status Pendaftaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Peserta</Label>
              <p className="text-sm text-slate-700 font-medium">{data.nama} ({data.nip})</p>
            </div>
            <div className="space-y-2">
              <Label>Status Baru</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Tambahkan catatan untuk pendaftar..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}>Batal</Button>
            </DialogClose>
            <Button onClick={handleUpdateStatus} disabled={saving || !newStatus} className="bg-[#195737] hover:bg-[#0F4227] text-white">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
