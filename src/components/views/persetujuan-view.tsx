'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Persetujuan } from '@/lib/types'
import { DataTable, PageHeader, type Column } from '@/components/shared/data-table'
import { formatDateTime } from '@/components/shared/ui-helpers'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Save, X, CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const JENIS_OPTIONS = [
  { value: 'PELATIHAN', label: 'Pelatihan' },
  { value: 'UJI_KOMPETENSI', label: 'Uji Kompetensi' },
  { value: 'ANGKATAN', label: 'Angkatan' },
  { value: 'SURAT_TUGAS', label: 'Surat Tugas' },
]

const STATUS_TABS = [
  { value: '', label: 'Semua' },
  { value: 'MENUNGGU', label: 'Menunggu' },
  { value: 'DISETUJUI', label: 'Disetujui' },
  { value: 'DITOLAK', label: 'Ditolak' },
]

const JENIS_BADGE_MAP: Record<string, { label: string; className: string }> = {
  PELATIHAN: { label: 'Pelatihan', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  UJI_KOMPETENSI: { label: 'Uji Kompetensi', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  ANGKATAN: { label: 'Angkatan', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  SURAT_TUGAS: { label: 'Surat Tugas', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

const STATUS_BADGE_MAP: Record<string, { label: string; className: string }> = {
  MENUNGGU: { label: 'Menunggu', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  DISETUJUI: { label: 'Disetujui', className: 'bg-green-100 text-green-700 border-green-200' },
  DITOLAK: { label: 'Ditolak', className: 'bg-red-100 text-red-700 border-red-200' },
}

// ===========================================================================
// ROOT COMPONENT
// ===========================================================================

export function PersetujuanView() {
  return <PersetujuanDataTable />
}

// ===========================================================================
// DATA TABLE
// ===========================================================================

interface FormState {
  jenis: string
  judul: string
  deskripsi: string
}

const EMPTY_FORM: FormState = {
  jenis: 'PELATIHAN',
  judul: '',
  deskripsi: '',
}

function PersetujuanDataTable() {
  const { toast } = useToast()

  const [data, setData] = useState<Persetujuan[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('')

  // create dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // approve/reject state
  const [approveTarget, setApproveTarget] = useState<Persetujuan | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Persetujuan | null>(null)
  const [approveCatatan, setApproveCatatan] = useState('')
  const [rejectCatatan, setRejectCatatan] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
      }
      if (activeTab) params.status = activeTab
      const res = await api.persetujuan.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, activeTab, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setPage(1)
  }

  const openCreate = () => {
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.judul) {
      toast({ title: 'Validasi', description: 'Judul wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await api.persetujuan.create({
        jenis: form.jenis,
        judul: form.judul,
        deskripsi: form.deskripsi || undefined,
      })
      toast({ title: 'Berhasil', description: 'Permohonan persetujuan berhasil dibuat' })
      setDialogOpen(false)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!approveTarget) return
    setProcessing(true)
    try {
      await api.persetujuan.approve(approveTarget.id, { catatan: approveCatatan || undefined })
      toast({ title: 'Berhasil', description: `Permohonan "${approveTarget.judul}" disetujui` })
      setApproveTarget(null)
      setApproveCatatan('')
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setProcessing(true)
    try {
      await api.persetujuan.reject(rejectTarget.id, { catatan: rejectCatatan || undefined })
      toast({ title: 'Berhasil', description: `Permohonan "${rejectTarget.judul}" ditolak` })
      setRejectTarget(null)
      setRejectCatatan('')
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  const columns: Column<Persetujuan>[] = [
    {
      key: 'judul', header: 'Judul', render: (r) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.judul}</p>
        </div>
      ),
    },
    {
      key: 'jenis', header: 'Jenis', render: (r) => {
        const badge = JENIS_BADGE_MAP[r.jenis] || { label: r.jenis, className: 'bg-slate-100 text-slate-700 border-slate-200' }
        return (
          <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', badge.className)}>
            {badge.label}
          </span>
        )
      },
    },
    {
      key: 'pemohonNama', header: 'Pemohon', render: (r) => (
        <span className="text-sm text-slate-600 line-clamp-1">{r.pemohonNama || '-'}</span>
      ),
    },
    {
      key: 'status', header: 'Status', render: (r) => {
        const badge = STATUS_BADGE_MAP[r.status] || { label: r.status, className: 'bg-slate-100 text-slate-700 border-slate-200' }
        return (
          <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', badge.className)}>
            {badge.label}
          </span>
        )
      },
    },
    {
      key: 'createdAt', header: 'Tanggal', render: (r) => (
        <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Persetujuan" description="Kelola permohonan persetujuan untuk berbagai kegiatan" />

      {/* Status Tabs */}
      <div className="flex items-center gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === tab.value
                ? 'bg-[#0F4C81] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari judul..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onAdd={openCreate}
        addLabel="Ajukan Permohonan"
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data persetujuan"
        actions={(row) => (
          <>
            {row.status === 'MENUNGGU' && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-500 hover:text-green-600"
                  onClick={() => { setApproveTarget(row); setApproveCatatan('') }}
                  title="Setujui"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
                  onClick={() => { setRejectTarget(row); setRejectCatatan('') }}
                  title="Tolak"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </>
            )}
          </>
        )}
      />

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#0F4C81]" />
              Ajukan Permohonan Persetujuan
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Jenis <span className="text-red-500">*</span></Label>
              <Select value={form.jenis} onValueChange={(v) => setForm({ ...form, jenis: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JENIS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Judul <span className="text-red-500">*</span></Label>
              <Input
                value={form.judul}
                onChange={(e) => setForm({ ...form, judul: e.target.value })}
                placeholder="Judul permohonan"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                placeholder="Deskripsi permohonan (opsional)"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}><X className="w-4 h-4" /> Batal</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63]">
              <Save className="w-4 h-4" /> {saving ? 'Mengirim...' : 'Ajukan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <AlertDialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" /> Konfirmasi Persetujuan
            </AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menyetujui permohonan <span className="font-semibold">&quot;{approveTarget?.judul}&quot;</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label>Catatan (opsional)</Label>
            <Textarea
              value={approveCatatan}
              onChange={(e) => setApproveCatatan(e.target.value)}
              placeholder="Tambahkan catatan persetujuan..."
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {processing ? 'Memproses...' : 'Setujui'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" /> Konfirmasi Penolakan
            </AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menolak permohonan <span className="font-semibold">&quot;{rejectTarget?.judul}&quot;</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label>Alasan Penolakan <span className="text-red-500">*</span></Label>
            <Textarea
              value={rejectCatatan}
              onChange={(e) => setRejectCatatan(e.target.value)}
              placeholder="Berikan alasan penolakan..."
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={processing || !rejectCatatan.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {processing ? 'Memproses...' : 'Tolak'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
