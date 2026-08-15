'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { Pelatihan, UjiKompetensi } from '@/lib/types'
import { useNavStore } from '@/store/auth-store'
import { DataTable, StatCard, PageHeader, type Column } from '@/components/shared/data-table'
import { StatusBadge, formatTanggal, formatTanggalSingkat, kategoriLabel } from '@/components/shared/ui-helpers'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Archive, FileText, FileSpreadsheet, Printer, BookOpen, Award, Eye, X, RotateCcw } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ===========================================================================
// ROOT
// ===========================================================================

export function ArsipView() {
  const { activeView } = useNavStore()
  if (activeView === 'arsip-uji') return <ArsipUjiView />
  return <ArsipPelatihanView />
}

// ===========================================================================
// ARSIP PELATIHAN
// ===========================================================================

function ArsipPelatihanView() {
  const { toast } = useToast()
  const [data, setData] = useState<(Pelatihan & { _count?: { angkatan: number }; deletedAt?: string | null })[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [detailTarget, setDetailTarget] = useState<(typeof data)[0] | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<(typeof data)[0] | null>(null)
  const [restoring, setRestoring] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
      }
      const res = await api.arsip.pelatihan(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  const handleRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      const res = await fetch(`/api/arsip/pelatihan/${restoreTarget.id}/restore`, {
        method: 'POST', credentials: 'same-origin',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal memulihkan')
      }
      toast({ title: 'Berhasil', description: 'Pelatihan dipulihkan dari arsip' })
      setRestoreTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setRestoring(false)
    }
  }

  const handleExportPDF = () => {
    toast({ title: 'Export PDF', description: 'Mengunduh arsip-pelatihan.pdf...' })
    api.arsip.exportPelatihanPdf()
  }

  const handleExportExcel = () => {
    toast({ title: 'Export Excel', description: 'Mengunduh arsip-pelatihan.xlsx...' })
    api.arsip.exportPelatihanXls()
  }

  const columns: Column<(typeof data)[0]>[] = [
    { key: 'kode', header: 'Kode', render: (r) => <span className="font-mono text-xs font-semibold text-[#0F4C81]">{r.kode}</span> },
    {
      key: 'nama', header: 'Nama Pelatihan', render: (r) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.nama}</p>
          {r.deskripsi && <p className="text-xs text-slate-400 line-clamp-1">{r.deskripsi}</p>}
        </div>
      ),
    },
    { key: 'kategori', header: 'Kategori', render: (r) => <span className="text-slate-600">{kategoriLabel(r.kategori)}</span> },
    { key: 'durasiHari', header: 'Durasi', render: (r) => <span className="text-slate-600">{r.durasiHari} hari</span> },
    { key: 'jp', header: 'JP', render: (r) => <span className="font-medium">{r.jp} JP</span> },
    { key: 'angkatan', header: 'Angkatan', render: (r) => <span className="font-medium text-[#0F4C81]">{r._count?.angkatan || 0}</span> },
    {
      key: 'deletedAt', header: 'Diarsipkan', render: (r) => (
        <span className="text-xs text-slate-500">{r.deletedAt ? formatTanggal(r.deletedAt) : '-'}</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Arsip Pelatihan" description="Data pelatihan yang telah dihapus (soft delete) dan dipindahkan ke arsip">
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-9">
          <Printer className="w-4 h-4" /> Export PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9">
          <FileSpreadsheet className="w-4 h-4" /> Export Excel
        </Button>
      </PageHeader>

      <StatCard title="Total Arsip Pelatihan" value={total} icon={Archive} color="purple" subtitle="Data yang diarsipkan" />

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari kode / nama pelatihan..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data arsip pelatihan"
        actions={(row) => (
          <>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-[#0F4C81]" onClick={() => setDetailTarget(row)} title="Lihat Detail">
              <Eye className="w-4 h-4" /> Detail
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-emerald-600" onClick={() => setRestoreTarget(row)} title="Pulihkan">
              <RotateCcw className="w-4 h-4" /> Pulihkan
            </Button>
          </>
        )}
      />

      {/* Detail Dialog */}
      <Dialog open={!!detailTarget} onOpenChange={(o) => !o && setDetailTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Arsip Pelatihan</DialogTitle>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-3 py-2">
              <DetailRow label="Kode" value={detailTarget.kode} />
              <DetailRow label="Nama" value={detailTarget.nama} />
              <DetailRow label="Kategori" value={kategoriLabel(detailTarget.kategori)} />
              <DetailRow label="Durasi" value={`${detailTarget.durasiHari} hari (${detailTarget.jp} JP)`} />
              <DetailRow label="Jumlah Angkatan" value={String(detailTarget._count?.angkatan || 0)} />
              <DetailRow label="Status" value={<StatusBadge status={detailTarget.status} />} />
              {detailTarget.deskripsi && <DetailRow label="Deskripsi" value={detailTarget.deskripsi} />}
              <DetailRow label="Diarsipkan pada" value={detailTarget.deletedAt ? formatTanggal(detailTarget.deletedAt) : '-'} />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline"><X className="w-4 h-4" /> Tutup</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pulihkan dari Arsip?</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin memulihkan pelatihan <span className="font-semibold">{restoreTarget?.nama}</span> dari arsip? Data akan kembali aktif di Data Pelatihan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {restoring ? 'Memulihkan...' : 'Pulihkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===========================================================================
// ARSIP UJI KOMPETENSI
// ===========================================================================

function ArsipUjiView() {
  const { toast } = useToast()
  const [data, setData] = useState<(UjiKompetensi & { angkatan?: any; asesor?: any[]; _count?: { nilai: number }; deletedAt?: string | null })[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [detailTarget, setDetailTarget] = useState<(typeof data)[0] | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<(typeof data)[0] | null>(null)
  const [restoring, setRestoring] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
      }
      const res = await api.arsip.ujiKompetensi(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  const handleRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      const res = await fetch(`/api/arsip/uji-kompetensi/${restoreTarget.id}/restore`, {
        method: 'POST', credentials: 'same-origin',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal memulihkan')
      }
      toast({ title: 'Berhasil', description: 'Uji Kompetensi dipulihkan dari arsip' })
      setRestoreTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setRestoring(false)
    }
  }

  const handleExportPDF = () => {
    toast({ title: 'Export PDF', description: 'Mengunduh arsip-uji-kompetensi.pdf...' })
    api.arsip.exportUjiKompetensiPdf()
  }

  const handleExportExcel = () => {
    toast({ title: 'Export Excel', description: 'Mengunduh arsip-uji-kompetensi.xlsx...' })
    api.arsip.exportUjiKompetensiXls()
  }

  const columns: Column<(typeof data)[0]>[] = [
    { key: 'kode', header: 'Kode', render: (r) => <span className="font-mono text-xs font-semibold text-slate-900">{r.kode}</span> },
    {
      key: 'skemaSertifikasi', header: 'Skema Sertifikasi', render: (r) => (
        <span className="text-slate-700 line-clamp-1 max-w-[200px] inline-block">{r.skemaSertifikasi}</span>
      ),
    },
    { key: 'tanggalUji', header: 'Tanggal Uji', render: (r) => <span className="text-xs text-slate-600">{formatTanggal(r.tanggalUji)}</span> },
    { key: 'tempat', header: 'Tempat', render: (r) => <span className="text-slate-600 text-xs">{r.tempat}</span> },
    { key: 'jumlahPeserta', header: 'Peserta', render: (r) => <span className="font-medium">{r.jumlahPeserta}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'asesor', header: 'Asesor', render: (r) => (
        <span className="text-xs text-slate-600">
          {r.asesor && r.asesor.length > 0
            ? r.asesor.map((a: any) => a.nama).join(', ')
            : '-'}
        </span>
      ),
    },
    {
      key: 'deletedAt', header: 'Diarsipkan', render: (r) => (
        <span className="text-xs text-slate-500">{r.deletedAt ? formatTanggal(r.deletedAt) : '-'}</span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Arsip Uji Kompetensi" description="Data uji kompetensi yang telah dihapus (soft delete) dan dipindahkan ke arsip">
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-9">
          <Printer className="w-4 h-4" /> Export PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9">
          <FileSpreadsheet className="w-4 h-4" /> Export Excel
        </Button>
      </PageHeader>

      <StatCard title="Total Arsip Uji Kompetensi" value={total} icon={Archive} color="purple" subtitle="Data yang diarsipkan" />

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
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data arsip uji kompetensi"
        actions={(row) => (
          <>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-[#0F4C81]" onClick={() => setDetailTarget(row)} title="Lihat Detail">
              <Eye className="w-4 h-4" /> Detail
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-emerald-600" onClick={() => setRestoreTarget(row)} title="Pulihkan">
              <RotateCcw className="w-4 h-4" /> Pulihkan
            </Button>
          </>
        )}
      />

      {/* Detail Dialog */}
      <Dialog open={!!detailTarget} onOpenChange={(o) => !o && setDetailTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Arsip Uji Kompetensi</DialogTitle>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-3 py-2">
              <DetailRow label="Kode" value={detailTarget.kode} />
              <DetailRow label="Skema Sertifikasi" value={detailTarget.skemaSertifikasi} />
              <DetailRow label="Tanggal Uji" value={formatTanggal(detailTarget.tanggalUji)} />
              <DetailRow label="Tempat" value={detailTarget.tempat} />
              <DetailRow label="Jumlah Peserta" value={String(detailTarget.jumlahPeserta)} />
              <DetailRow label="Angkatan" value={detailTarget.angkatan ? `${detailTarget.angkatan.namaAngkatan} — ${detailTarget.angkatan.pelatihan?.nama || ''}` : '-'} />
              <DetailRow label="Asesor" value={detailTarget.asesor && detailTarget.asesor.length > 0 ? detailTarget.asesor.map((a: any) => a.nama).join(', ') : '-'} />
              <DetailRow label="Nilai Terinput" value={String(detailTarget._count?.nilai || 0)} />
              <DetailRow label="Status" value={<StatusBadge status={detailTarget.status} />} />
              {detailTarget.catatan && <DetailRow label="Catatan" value={detailTarget.catatan} />}
              <DetailRow label="Diarsipkan pada" value={detailTarget.deletedAt ? formatTanggal(detailTarget.deletedAt) : '-'} />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline"><X className="w-4 h-4" /> Tutup</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pulihkan dari Arsip?</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin memulihkan uji kompetensi <span className="font-semibold">{restoreTarget?.kode}</span> dari arsip? Data akan kembali aktif di Uji Kompetensi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {restoring ? 'Memulihkan...' : 'Pulihkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===========================================================================
// SHARED
// ===========================================================================

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm py-1.5 border-b border-slate-100 last:border-0">
      <p className="text-slate-500">{label}</p>
      <p className="col-span-2 text-slate-900 font-medium">{value}</p>
    </div>
  )
}
