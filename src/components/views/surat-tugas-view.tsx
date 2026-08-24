'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { SuratTugas } from '@/lib/types'
import { DataTable, PageHeader, type Column } from '@/components/shared/data-table'
import { formatTanggal } from '@/components/shared/ui-helpers'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Save, X, Download, Trash2, Pencil, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const STATUS_TABS = [
  { value: '', label: 'Semua' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'TERBIT', label: 'Terbit' },
]

const STATUS_BADGE_MAP: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  TERBIT: { label: 'Terbit', className: 'bg-green-100 text-green-700 border-green-200' },
}

// ===========================================================================
// ROOT COMPONENT
// ===========================================================================

export function SuratTugasView() {
  return <SuratTugasDataTable />
}

// ===========================================================================
// DATA TABLE
// ===========================================================================

interface FormState {
  nomor: string
  perihal: string
  penerima: string
  tanggalSurat: string
  tanggalMulai: string
  tanggalSelesai: string
  catatan: string
  file: File | null
}

const EMPTY_FORM: FormState = {
  nomor: '',
  perihal: '',
  penerima: '',
  tanggalSurat: '',
  tanggalMulai: '',
  tanggalSelesai: '',
  catatan: '',
  file: null,
}

function SuratTugasDataTable() {
  const { toast } = useToast()

  const [data, setData] = useState<SuratTugas[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('')

  // create/edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SuratTugas | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<SuratTugas | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
      }
      if (activeTab) params.status = activeTab
      const res = await api.suratTugas.list(params)
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
    setEditTarget(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const openEdit = (item: SuratTugas) => {
    setEditTarget(item)
    setForm({
      nomor: item.nomor || '',
      perihal: item.perihal || '',
      penerima: item.penerima || '',
      tanggalSurat: item.tanggalSurat ? item.tanggalSurat.split('T')[0] : '',
      tanggalMulai: item.tanggalMulai ? item.tanggalMulai.split('T')[0] : '',
      tanggalSelesai: item.tanggalSelesai ? item.tanggalSelesai.split('T')[0] : '',
      catatan: item.catatan || '',
      file: null,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.nomor || !form.perihal || !form.penerima || !form.tanggalSurat) {
      toast({ title: 'Validasi', description: 'Nomor, Perihal, Penerima, dan Tanggal Surat wajib diisi', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      if (editTarget) {
        // Edit: JSON update (no file)
        await api.suratTugas.update(editTarget.id, {
          nomor: form.nomor,
          perihal: form.perihal,
          penerima: form.penerima,
          tanggalSurat: form.tanggalSurat,
          tanggalMulai: form.tanggalMulai || null,
          tanggalSelesai: form.tanggalSelesai || null,
          catatan: form.catatan || null,
        })
        toast({ title: 'Berhasil', description: 'Surat tugas berhasil diperbarui' })
      } else {
        // Create: FormData with optional file
        const fd = new FormData()
        fd.append('nomor', form.nomor)
        fd.append('perihal', form.perihal)
        fd.append('penerima', form.penerima)
        fd.append('tanggalSurat', form.tanggalSurat)
        if (form.tanggalMulai) fd.append('tanggalMulai', form.tanggalMulai)
        if (form.tanggalSelesai) fd.append('tanggalSelesai', form.tanggalSelesai)
        if (form.catatan) fd.append('catatan', form.catatan)
        if (form.file) fd.append('file', form.file)
        await api.suratTugas.create(fd)
        toast({ title: 'Berhasil', description: 'Surat tugas berhasil dibuat' })
      }
      setDialogOpen(false)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = (item: SuratTugas) => {
    api.suratTugas.downloadFile(item.id)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.suratTugas.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Surat tugas dihapus' })
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<SuratTugas>[] = [
    {
      key: 'nomor', header: 'Nomor', render: (r) => (
        <div className="min-w-[160px]">
          <p className="font-mono text-xs font-medium text-slate-900 line-clamp-1">{r.nomor}</p>
        </div>
      ),
    },
    {
      key: 'perihal', header: 'Perihal', render: (r) => (
        <span className="text-sm text-slate-600 line-clamp-1">{r.perihal}</span>
      ),
    },
    {
      key: 'penerima', header: 'Penerima', render: (r) => (
        <span className="text-sm text-slate-600 line-clamp-1">{r.penerima}</span>
      ),
    },
    {
      key: 'tanggalSurat', header: 'Tanggal Surat', render: (r) => (
        <span className="text-xs text-slate-500">{formatTanggal(r.tanggalSurat)}</span>
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
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Surat Tugas" description="Kelola surat tugas untuk kegiatan pelatihan dan penugasan" />

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
        searchPlaceholder="Cari nomor / perihal..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onAdd={openCreate}
        addLabel="Buat Surat Tugas"
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data surat tugas"
        actions={(row) => (
          <>
            {row.file && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-slate-500 hover:text-[#0F4C81]"
                onClick={() => handleDownload(row)}
                title="Download File"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-500 hover:text-[#0F4C81]"
              onClick={() => openEdit(row)}
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
              onClick={() => setDeleteTarget(row)}
              title="Hapus"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0F4C81]" />
              {editTarget ? 'Edit Surat Tugas' : 'Buat Surat Tugas Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Nomor Surat <span className="text-red-500">*</span></Label>
              <Input
                value={form.nomor}
                onChange={(e) => setForm({ ...form, nomor: e.target.value })}
                placeholder="Nomor surat tugas"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Penerima <span className="text-red-500">*</span></Label>
              <Input
                value={form.penerima}
                onChange={(e) => setForm({ ...form, penerima: e.target.value })}
                placeholder="Nama penerima surat"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Perihal <span className="text-red-500">*</span></Label>
              <Input
                value={form.perihal}
                onChange={(e) => setForm({ ...form, perihal: e.target.value })}
                placeholder="Perihal surat tugas"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Surat <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={form.tanggalSurat}
                onChange={(e) => setForm({ ...form, tanggalSurat: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                value={form.tanggalMulai}
                onChange={(e) => setForm({ ...form, tanggalMulai: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Selesai</Label>
              <Input
                type="date"
                value={form.tanggalSelesai}
                onChange={(e) => setForm({ ...form, tanggalSelesai: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Catatan</Label>
              <Textarea
                value={form.catatan}
                onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                placeholder="Catatan tambahan (opsional)"
                rows={2}
              />
            </div>
            {!editTarget && (
              <div className="sm:col-span-2 space-y-1.5">
                <Label>File Surat (PDF)</Label>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                    className="file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#0F4C81]/10 file:text-[#0F4C81] hover:file:bg-[#0F4C81]/20"
                  />
                  <p className="text-xs text-slate-400 mt-1">Format: PDF</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}><X className="w-4 h-4" /> Batal</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63]">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : (editTarget ? 'Perbarui' : 'Simpan')}
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
              Yakin ingin menghapus surat tugas <span className="font-semibold">&quot;{deleteTarget?.nomor}&quot;</span>? Tindakan ini tidak dapat dibatalkan.
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
