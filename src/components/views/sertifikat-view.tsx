'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Sertifikat } from '@/lib/types'
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
import { Download, Trash2, Plus, Save, X, FileText, Upload, Award } from 'lucide-react'

// ===========================================================================
// ROOT
// ===========================================================================

export function SertifikatView() {
  return <SertifikatDataTable jenis="PELATIHAN" title="Sertifikat Pelatihan" description="Arsip dan kelola sertifikat pelatihan dari Srikandi" />
}

// ===========================================================================
// DATA TABLE
// ===========================================================================

interface FormState {
  namaPeserta: string
  namaKegiatan: string
  nomorSertifikat: string
  tanggalTerbit: string
  catatan: string
  file: File | null
}

const EMPTY_FORM: FormState = {
  namaPeserta: '',
  namaKegiatan: '',
  nomorSertifikat: '',
  tanggalTerbit: '',
  catatan: '',
  file: null,
}

function SertifikatDataTable({ jenis, title, description }: { jenis: string; title: string; description: string }) {
  const { toast } = useToast()

  const [data, setData] = useState<Sertifikat[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<Sertifikat | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search, jenis,
      }
      const res = await api.sertifikat.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, jenis, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  const openCreate = () => {
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.namaPeserta || !form.namaKegiatan) {
      toast({ title: 'Validasi', description: 'Nama Peserta dan Nama Kegiatan wajib diisi', variant: 'destructive' })
      return
    }
    if (!form.file) {
      toast({ title: 'Validasi', description: 'File sertifikat wajib diunggah', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('jenis', jenis)
      fd.append('namaPeserta', form.namaPeserta)
      fd.append('namaKegiatan', form.namaKegiatan)
      if (form.nomorSertifikat) fd.append('nomorSertifikat', form.nomorSertifikat)
      if (form.tanggalTerbit) fd.append('tanggalTerbit', form.tanggalTerbit)
      if (form.catatan) fd.append('catatan', form.catatan)
      fd.append('file', form.file)
      await api.sertifikat.create(fd)
      toast({ title: 'Berhasil', description: 'Sertifikat berhasil diunggah' })
      setDialogOpen(false)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = (item: Sertifikat) => {
    api.sertifikat.downloadFile(item.id)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.sertifikat.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Sertifikat dihapus' })
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<Sertifikat>[] = [
    {
      key: 'namaPeserta', header: 'Nama Peserta', render: (r) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.namaPeserta || '-'}</p>
        </div>
      ),
    },
    {
      key: 'namaKegiatan', header: 'Nama Kegiatan', render: (r) => (
        <span className="text-sm text-slate-600 line-clamp-1">{r.namaKegiatan || '-'}</span>
      ),
    },
    {
      key: 'nomorSertifikat', header: 'No. Sertifikat', render: (r) => (
        <span className="font-mono text-xs text-slate-600">{r.nomorSertifikat || '-'}</span>
      ),
    },
    {
      key: 'tanggalTerbit', header: 'Tanggal Terbit', render: (r) => (
        <span className="text-xs text-slate-500">{formatTanggal(r.tanggalTerbit)}</span>
      ),
    },
    {
      key: 'ukuranFile', header: 'Ukuran File', render: (r) => (
        <span className="text-xs text-slate-500 font-mono">{r.ukuranFile || '-'}</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description} />

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari nama peserta / kegiatan..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onAdd={openCreate}
        addLabel="Upload Sertifikat"
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data sertifikat"
        actions={(row) => (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-500 hover:text-[#0F4C81]"
              onClick={() => handleDownload(row)}
              title="Download"
            >
              <Download className="w-4 h-4" />
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

      {/* Upload Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#0F4C81]" />
              Upload Sertifikat
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Jenis Sertifikat</Label>
              <Input value={jenis === 'PELATIHAN' ? 'Pelatihan' : 'Uji Kompetensi'} disabled className="bg-slate-50" />
            </div>
            <div className="space-y-1.5">
              <Label>Nama Peserta <span className="text-red-500">*</span></Label>
              <Input
                value={form.namaPeserta}
                onChange={(e) => setForm({ ...form, namaPeserta: e.target.value })}
                placeholder="Nama lengkap peserta"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nama Kegiatan <span className="text-red-500">*</span></Label>
              <Input
                value={form.namaKegiatan}
                onChange={(e) => setForm({ ...form, namaKegiatan: e.target.value })}
                placeholder="Nama pelatihan / uji kompetensi"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nomor Sertifikat</Label>
              <Input
                value={form.nomorSertifikat}
                onChange={(e) => setForm({ ...form, nomorSertifikat: e.target.value })}
                placeholder="Nomor sertifikat"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Terbit</Label>
              <Input
                type="date"
                value={form.tanggalTerbit}
                onChange={(e) => setForm({ ...form, tanggalTerbit: e.target.value })}
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
            <div className="sm:col-span-2 space-y-1.5">
              <Label>File Sertifikat <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.png"
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                  className="file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#0F4C81]/10 file:text-[#0F4C81] hover:file:bg-[#0F4C81]/20"
                />
                <p className="text-xs text-slate-400 mt-1">Format: PDF, JPG, PNG</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}><X className="w-4 h-4" /> Batal</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63]">
              <Save className="w-4 h-4" /> {saving ? 'Mengunggah...' : 'Upload'}
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
              Yakin ingin menghapus sertifikat <span className="font-semibold">{deleteTarget?.nomorSertifikat || deleteTarget?.namaPeserta}</span>? Tindakan ini tidak dapat dibatalkan.
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
