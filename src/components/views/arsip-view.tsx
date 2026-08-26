'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Pelatihan, UjiKompetensi, Peserta } from '@/lib/types'
import { useNavStore } from '@/store/auth-store'
import { DataTable, StatCard, PageHeader, type Column } from '@/components/shared/data-table'
import { StatusBadge, formatTanggal, kategoriLabel } from '@/components/shared/ui-helpers'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Archive, FileText, FileSpreadsheet, Printer, BookOpen, Award, Eye, X, RotateCcw, Trash2, Filter } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  if (activeView === 'arsip-peserta') return <ArsipPesertaView />
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
  const [deleteTarget, setDeleteTarget] = useState<(typeof data)[0] | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.arsip.pelatihan({ page, pageSize, search })
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
      const res = await fetch(`/api/arsip/pelatihan/${restoreTarget.id}/restore`, { method: 'POST', credentials: 'same-origin' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Gagal memulihkan') }
      toast({ title: 'Berhasil', description: 'Pelatihan dipulihkan dari arsip' })
      setRestoreTarget(null); fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally { setRestoring(false) }
  }

  const handleDeletePermanent = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/arsip/pelatihan/${deleteTarget.id}/delete-permanent`, { method: 'DELETE', credentials: 'same-origin' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Gagal menghapus permanen') }
      toast({ title: 'Dihapus Permanen', description: 'Data pelatihan telah dihapus permanen dari database' })
      setDeleteTarget(null); fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  const columns: Column<(typeof data)[0]>[] = [
    { key: 'kode', header: 'Kode', render: (r) => <span className="font-mono text-xs font-semibold text-[#0F4C81]">{r.kode}</span> },
    { key: 'nama', header: 'Nama Pelatihan', render: (r) => (
      <div className="min-w-[200px]">
        <p className="font-medium text-slate-900 line-clamp-1">{r.nama}</p>
        {r.deskripsi && <p className="text-xs text-slate-400 line-clamp-1">{r.deskripsi}</p>}
      </div>
    )},
    { key: 'kategori', header: 'Kategori', render: (r) => <span className="text-slate-600">{kategoriLabel(r.kategori)}</span> },
    { key: 'durasiHari', header: 'Durasi', render: (r) => <span className="text-slate-600">{r.durasiHari} hari</span> },
    { key: 'jp', header: 'JP', render: (r) => <span className="font-medium">{r.jp} JP</span> },
    { key: 'angkatan', header: 'Angkatan', render: (r) => <span className="font-medium text-[#0F4C81]">{r._count?.angkatan || 0}</span> },
    { key: 'deletedAt', header: 'Diarsipkan', render: (r) => <span className="text-xs text-slate-500">{r.deletedAt ? formatTanggal(r.deletedAt) : '-'}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Arsip Pelatihan" description="Data pelatihan yang telah dihapus (soft delete) dan dipindahkan ke arsip">
        <Button variant="outline" size="sm" onClick={() => { toast({ title: 'Export PDF', description: 'Mengunduh arsip-pelatihan.pdf...' }); api.arsip.exportPelatihanPdf() }} className="h-9"><Printer className="w-4 h-4" /> Export PDF</Button>
        <Button variant="outline" size="sm" onClick={() => { toast({ title: 'Export Excel', description: 'Mengunduh arsip-pelatihan.xlsx...' }); api.arsip.exportPelatihanXls() }} className="h-9"><FileSpreadsheet className="w-4 h-4" /> Export Excel</Button>
      </PageHeader>
      <StatCard title="Total Arsip Pelatihan" value={total} icon={Archive} color="purple" subtitle="Data yang diarsipkan" />
      <DataTable
        data={data} total={total} page={page} pageSize={pageSize} loading={loading} columns={columns}
        searchPlaceholder="Cari kode / nama pelatihan..." searchValue={search} onSearchChange={handleSearch}
        onPageChange={setPage} onRefresh={fetchData} rowKey={(r) => r.id}
        emptyMessage="Belum ada data arsip pelatihan"
        actions={(row) => (
          <>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-[#0F4C81]" onClick={() => setDetailTarget(row)} title="Lihat Detail"><Eye className="w-4 h-4" /> Detail</Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-emerald-600" onClick={() => setRestoreTarget(row)} title="Pulihkan"><RotateCcw className="w-4 h-4" /> Pulihkan</Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600" onClick={() => setDeleteTarget(row)} title="Hapus Permanen"><Trash2 className="w-4 h-4" /> Hapus</Button>
          </>
        )}
      />
      <DetailDialogPelatihan target={detailTarget} onClose={() => setDetailTarget(null)} />
      <RestoreDialog open={!!restoreTarget} title="Pulihkan Pelatihan dari Arsip?" description={<>Yakin ingin memulihkan pelatihan <span className="font-semibold">{restoreTarget?.nama}</span> dari arsip?</>} loading={restoring} onConfirm={handleRestore} onCancel={() => setRestoreTarget(null)} />
      <DeletePermanentDialog open={!!deleteTarget} title="Hapus Permanen Pelatihan?" description={<>Data <span className="font-semibold">{deleteTarget?.nama}</span> akan dihapus <strong>permanen</strong> dari database beserta semua angkatan terkait. Tindakan ini <strong>tidak bisa dibatalkan</strong>!</>} loading={deleting} onConfirm={handleDeletePermanent} onCancel={() => setDeleteTarget(null)} />
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
  const [deleteTarget, setDeleteTarget] = useState<(typeof data)[0] | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.arsip.ujiKompetensi({ page, pageSize, search })
      setData(res.data); setTotal(res.total)
    } catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) } finally { setLoading(false) }
  }, [page, pageSize, search, toast])

  useEffect(() => { fetchData() }, [fetchData])
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }

  const handleRestore = async () => {
    if (!restoreTarget) return; setRestoring(true)
    try {
      const res = await fetch(`/api/arsip/uji-kompetensi/${restoreTarget.id}/restore`, { method: 'POST', credentials: 'same-origin' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Gagal memulihkan') }
      toast({ title: 'Berhasil', description: 'Uji Kompetensi dipulihkan dari arsip' }); setRestoreTarget(null); fetchData()
    } catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) } finally { setRestoring(false) }
  }

  const handleDeletePermanent = async () => {
    if (!deleteTarget) return; setDeleting(true)
    try {
      const res = await fetch(`/api/arsip/uji-kompetensi/${deleteTarget.id}/delete-permanent`, { method: 'DELETE', credentials: 'same-origin' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Gagal menghapus permanen') }
      toast({ title: 'Dihapus Permanen', description: 'Data uji kompetensi telah dihapus permanen' }); setDeleteTarget(null); fetchData()
    } catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) } finally { setDeleting(false) }
  }

  const columns: Column<(typeof data)[0]>[] = [
    { key: 'kode', header: 'Kode', render: (r) => <span className="font-mono text-xs font-semibold text-slate-900">{r.kode}</span> },
    { key: 'skemaSertifikasi', header: 'Skema Sertifikasi', render: (r) => <span className="text-slate-700 line-clamp-1 max-w-[200px] inline-block">{r.skemaSertifikasi}</span> },
    { key: 'tanggalUji', header: 'Tanggal Uji', render: (r) => <span className="text-xs text-slate-600">{formatTanggal(r.tanggalUji)}</span> },
    { key: 'tempat', header: 'Tempat', render: (r) => <span className="text-slate-600 text-xs">{r.tempat}</span> },
    { key: 'jumlahPeserta', header: 'Peserta', render: (r) => <span className="font-medium">{r.jumlahPeserta}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'asesor', header: 'Asesor', render: (r) => <span className="text-xs text-slate-600">{r.asesor && r.asesor.length > 0 ? r.asesor.map((a: any) => a.nama).join(', ') : '-'}</span> },
    { key: 'deletedAt', header: 'Diarsipkan', render: (r) => <span className="text-xs text-slate-500">{r.deletedAt ? formatTanggal(r.deletedAt) : '-'}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Arsip Uji Kompetensi" description="Data uji kompetensi yang telah dihapus (soft delete) dan dipindahkan ke arsip">
        <Button variant="outline" size="sm" onClick={() => { toast({ title: 'Export PDF', description: 'Mengunduh arsip-uji-kompetensi.pdf...' }); api.arsip.exportUjiKompetensiPdf() }} className="h-9"><Printer className="w-4 h-4" /> Export PDF</Button>
        <Button variant="outline" size="sm" onClick={() => { toast({ title: 'Export Excel', description: 'Mengunduh arsip-uji-kompetensi.xlsx...' }); api.arsip.exportUjiKompetensiXls() }} className="h-9"><FileSpreadsheet className="w-4 h-4" /> Export Excel</Button>
      </PageHeader>
      <StatCard title="Total Arsip Uji Kompetensi" value={total} icon={Archive} color="purple" subtitle="Data yang diarsipkan" />
      <DataTable
        data={data} total={total} page={page} pageSize={pageSize} loading={loading} columns={columns}
        searchPlaceholder="Cari kode / skema / tempat..." searchValue={search} onSearchChange={handleSearch}
        onPageChange={setPage} onRefresh={fetchData} rowKey={(r) => r.id}
        emptyMessage="Belum ada data arsip uji kompetensi"
        actions={(row) => (
          <>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-[#0F4C81]" onClick={() => setDetailTarget(row)} title="Lihat Detail"><Eye className="w-4 h-4" /> Detail</Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-emerald-600" onClick={() => setRestoreTarget(row)} title="Pulihkan"><RotateCcw className="w-4 h-4" /> Pulihkan</Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600" onClick={() => setDeleteTarget(row)} title="Hapus Permanen"><Trash2 className="w-4 h-4" /> Hapus</Button>
          </>
        )}
      />
      <DetailDialogUji target={detailTarget} onClose={() => setDetailTarget(null)} />
      <RestoreDialog open={!!restoreTarget} title="Pulihkan Uji Kompetensi dari Arsip?" description={<>Yakin ingin memulihkan uji kompetensi <span className="font-semibold">{restoreTarget?.kode}</span> dari arsip?</>} loading={restoring} onConfirm={handleRestore} onCancel={() => setRestoreTarget(null)} />
      <DeletePermanentDialog open={!!deleteTarget} title="Hapus Permanen Uji Kompetensi?" description={<>Data uji kompetensi <span className="font-semibold">{deleteTarget?.kode}</span> akan dihapus <strong>permanen</strong> dari database. Tindakan ini <strong>tidak bisa dibatalkan</strong>!</>} loading={deleting} onConfirm={handleDeletePermanent} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}

// ===========================================================================
// ARSIP PESERTA
// ===========================================================================

function ArsipPesertaView() {
  const { toast } = useToast()
  const [data, setData] = useState<(Peserta & { _count?: { angkatan: number; nilai: number }; deletedAt?: string | null })[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tipe, setTipe] = useState<string>('')
  const [angkatanId, setAngkatanId] = useState<string>('')
  const [angkatanOptions, setAngkatanOptions] = useState<{ id: string; label: string; count: number }[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  const [detailTarget, setDetailTarget] = useState<(typeof data)[0] | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<(typeof data)[0] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<(typeof data)[0] | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.arsip.peserta({ page, pageSize, search, ...(tipe ? { tipe } : {}), ...(angkatanId ? { angkatanId } : {}) })
      setData(res.data); setTotal(res.total)
    } catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) } finally { setLoading(false) }
  }, [page, pageSize, search, tipe, angkatanId, toast])

  // Load angkatan/uji options ketika tipe berubah
  useEffect(() => {
    if (!tipe) { setAngkatanOptions([]); setAngkatanId(''); return }
    let cancelled = false
    setLoadingOptions(true)
    api.arsip.angkatanOptions(tipe)
      .then(opts => { if (!cancelled) setAngkatanOptions(opts) })
      .catch(() => { if (!cancelled) setAngkatanOptions([]) })
      .finally(() => { if (!cancelled) setLoadingOptions(false) })
    return () => { cancelled = true }
  }, [tipe])

  useEffect(() => { fetchData() }, [fetchData])
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleTipeChange = (v: string) => { setTipe(v === 'SEMUA' ? '' : v); setAngkatanId(''); setPage(1) }
  const handleAngkatanChange = (v: string) => { setAngkatanId(v === 'SEMUA' ? '' : v); setPage(1) }

  const handleRestore = async () => {
    if (!restoreTarget) return; setRestoring(true)
    try {
      const res = await fetch(`/api/arsip/peserta/${restoreTarget.id}/restore`, { method: 'POST', credentials: 'same-origin' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Gagal memulihkan') }
      toast({ title: 'Berhasil', description: 'Peserta dipulihkan dari arsip' }); setRestoreTarget(null); fetchData()
    } catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) } finally { setRestoring(false) }
  }

  const handleDeletePermanent = async () => {
    if (!deleteTarget) return; setDeleting(true)
    try {
      const res = await fetch(`/api/arsip/peserta/${deleteTarget.id}/delete-permanent`, { method: 'DELETE', credentials: 'same-origin' })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Gagal menghapus permanen') }
      toast({ title: 'Dihapus Permanen', description: 'Data peserta telah dihapus permanen' }); setDeleteTarget(null); fetchData()
    } catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) } finally { setDeleting(false) }
  }

  const columns: Column<(typeof data)[0]>[] = [
    { key: 'nip', header: 'NIP', render: (r) => <span className="font-mono text-xs text-slate-700">{r.nip}</span> },
    { key: 'nama', header: 'Nama Peserta', render: (r) => <span className="font-medium text-slate-900">{r.nama}</span> },
    { key: 'jenisKelamin', header: 'JK', render: (r) => <span className="text-slate-600 text-xs">{r.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</span> },
    { key: 'jabatan', header: 'Jabatan', render: (r) => <span className="text-slate-600 text-xs line-clamp-1 max-w-[120px] inline-block">{r.jabatan || '-'}</span> },
    { key: 'unitKerja', header: 'Unit Kerja', render: (r) => <span className="text-slate-600 text-xs line-clamp-1 max-w-[120px] inline-block">{r.unitKerja || '-'}</span> },
    { key: 'angkatan', header: 'Angkatan', render: (r) => <span className="font-medium text-[#0F4C81]">{r._count?.angkatan || 0}</span> },
    { key: 'deletedAt', header: 'Diarsipkan', render: (r) => <span className="text-xs text-slate-500">{r.deletedAt ? formatTanggal(r.deletedAt) : '-'}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Arsip Peserta" description="Data peserta yang telah dihapus (soft delete) dan dipindahkan ke arsip">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <Select value={tipe || 'SEMUA'} onValueChange={handleTipeChange}>
            <SelectTrigger className="w-[200px] h-9 text-sm">
              <SelectValue placeholder="Filter tipe..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SEMUA">Semua Peserta</SelectItem>
              <SelectItem value="PELATIHAN">Peserta Pelatihan</SelectItem>
              <SelectItem value="UJI_KOMPETENSI">Peserta Uji Kompetensi</SelectItem>
            </SelectContent>
          </Select>
          {tipe && (
            <Select value={angkatanId || 'SEMUA'} onValueChange={handleAngkatanChange} disabled={loadingOptions}>
              <SelectTrigger className="w-[280px] h-9 text-sm">
                <SelectValue placeholder={loadingOptions ? 'Memuat...' : 'Pilih angkatan...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SEMUA">Semua {tipe === 'PELATIHAN' ? 'Angkatan' : 'Uji Kompetensi'}</SelectItem>
                {angkatanOptions.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label} ({opt.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => { toast({ title: 'Export PDF', description: 'Mengunduh arsip-peserta.pdf...' }); api.arsip.exportPesertaPdf() }} className="h-9"><Printer className="w-4 h-4" /> Export PDF</Button>
        <Button variant="outline" size="sm" onClick={() => { toast({ title: 'Export Excel', description: 'Mengunduh arsip-peserta.xlsx...' }); api.arsip.exportPesertaXls() }} className="h-9"><FileSpreadsheet className="w-4 h-4" /> Export Excel</Button>
      </PageHeader>
      <StatCard title="Total Arsip Peserta" value={total} icon={Archive} color="purple" subtitle="Data yang diarsipkan" />
      <DataTable
        data={data} total={total} page={page} pageSize={pageSize} loading={loading} columns={columns}
        searchPlaceholder="Cari NIP / nama / unit kerja..." searchValue={search} onSearchChange={handleSearch}
        onPageChange={setPage} onRefresh={fetchData} rowKey={(r) => r.id}
        emptyMessage="Belum ada data arsip peserta"
        actions={(row) => (
          <>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-[#0F4C81]" onClick={() => setDetailTarget(row)} title="Lihat Detail"><Eye className="w-4 h-4" /> Detail</Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-emerald-600" onClick={() => setRestoreTarget(row)} title="Pulihkan"><RotateCcw className="w-4 h-4" /> Pulihkan</Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600" onClick={() => setDeleteTarget(row)} title="Hapus Permanen"><Trash2 className="w-4 h-4" /> Hapus</Button>
          </>
        )}
      />
      <DetailDialogPeserta target={detailTarget} onClose={() => setDetailTarget(null)} />
      <RestoreDialog open={!!restoreTarget} title="Pulihkan Peserta dari Arsip?" description={<>Yakin ingin memulihkan peserta <span className="font-semibold">{restoreTarget?.nama}</span> ({restoreTarget?.nip}) dari arsip?</>} loading={restoring} onConfirm={handleRestore} onCancel={() => setRestoreTarget(null)} />
      <DeletePermanentDialog open={!!deleteTarget} title="Hapus Permanen Peserta?" description={<>Data peserta <span className="font-semibold">{deleteTarget?.nama}</span> ({deleteTarget?.nip}) akan dihapus <strong>permanen</strong> dari database. Tindakan ini <strong>tidak bisa dibatalkan</strong>!</>} loading={deleting} onConfirm={handleDeletePermanent} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}

// ===========================================================================
// SHARED DIALOGS
// ===========================================================================

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm py-1.5 border-b border-slate-100 last:border-0">
      <p className="text-slate-500">{label}</p>
      <p className="col-span-2 text-slate-900 font-medium">{value}</p>
    </div>
  )
}

function RestoreDialog({ title, description, loading, open, onConfirm, onCancel }: { title: string; description: React.ReactNode; loading: boolean; open: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">{loading ? 'Memulihkan...' : 'Pulihkan'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeletePermanentDialog({ title, description, loading, open, onConfirm, onCancel }: { title: string; description: React.ReactNode; loading: boolean; open: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle className="text-red-600">{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">{loading ? 'Menghapus...' : 'Hapus Permanen'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ===========================================================================
// DETAIL DIALOGS
// ===========================================================================

function DetailDialogPelatihan({ target, onClose }: { target: (Pelatihan & { _count?: { angkatan: number }; deletedAt?: string | null }) | null; onClose: () => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Detail Arsip Pelatihan</DialogTitle></DialogHeader>
        {target && (
          <div className="space-y-3 py-2">
            <DetailRow label="Kode" value={target.kode} />
            <DetailRow label="Nama" value={target.nama} />
            <DetailRow label="Kategori" value={kategoriLabel(target.kategori)} />
            <DetailRow label="Durasi" value={`${target.durasiHari} hari (${target.jp} JP)`} />
            <DetailRow label="Jumlah Angkatan" value={String(target._count?.angkatan || 0)} />
            <DetailRow label="Status" value={<StatusBadge status={target.status} />} />
            {target.deskripsi && <DetailRow label="Deskripsi" value={target.deskripsi} />}
            <DetailRow label="Diarsipkan pada" value={target.deletedAt ? formatTanggal(target.deletedAt) : '-'} />
          </div>
        )}
        <DialogFooter><DialogClose asChild><Button variant="outline"><X className="w-4 h-4" /> Tutup</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailDialogUji({ target, onClose }: { target: (UjiKompetensi & { angkatan?: any; asesor?: any[]; _count?: { nilai: number }; deletedAt?: string | null }) | null; onClose: () => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Detail Arsip Uji Kompetensi</DialogTitle></DialogHeader>
        {target && (
          <div className="space-y-3 py-2">
            <DetailRow label="Kode" value={target.kode} />
            <DetailRow label="Skema Sertifikasi" value={target.skemaSertifikasi} />
            <DetailRow label="Tanggal Uji" value={formatTanggal(target.tanggalUji)} />
            <DetailRow label="Tempat" value={target.tempat} />
            <DetailRow label="Jumlah Peserta" value={String(target.jumlahPeserta)} />
            <DetailRow label="Angkatan" value={target.angkatan ? `${target.angkatan.namaAngkatan} — ${target.angkatan.pelatihan?.nama || ''}` : '-'} />
            <DetailRow label="Asesor" value={target.asesor && target.asesor.length > 0 ? target.asesor.map((a: any) => a.nama).join(', ') : '-'} />
            <DetailRow label="Nilai Terinput" value={String(target._count?.nilai || 0)} />
            <DetailRow label="Status" value={<StatusBadge status={target.status} />} />
            {target.catatan && <DetailRow label="Catatan" value={target.catatan} />}
            <DetailRow label="Diarsipkan pada" value={target.deletedAt ? formatTanggal(target.deletedAt) : '-'} />
          </div>
        )}
        <DialogFooter><DialogClose asChild><Button variant="outline"><X className="w-4 h-4" /> Tutup</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailDialogPeserta({ target, onClose }: { target: (Peserta & { _count?: { angkatan: number; nilai: number }; deletedAt?: string | null }) | null; onClose: () => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Detail Arsip Peserta</DialogTitle></DialogHeader>
        {target && (
          <div className="space-y-3 py-2">
            <DetailRow label="NIP" value={target.nip} />
            <DetailRow label="Nama" value={target.nama} />
            <DetailRow label="Jenis Kelamin" value={target.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
            <DetailRow label="Tempat/Tgl Lahir" value={`${target.tempatLahir || '-'}, ${target.tanggalLahir ? formatTanggal(target.tanggalLahir) : '-'}`} />
            <DetailRow label="Jabatan" value={target.jabatan || '-'} />
            <DetailRow label="Pangkat/Gol." value={target.pangkatGolongan || '-'} />
            <DetailRow label="Unit Kerja" value={target.unitKerja || '-'} />
            <DetailRow label="Instansi" value={target.instansi || '-'} />
            <DetailRow label="Pendidikan" value={target.pendidikan || '-'} />
            <DetailRow label="No. Telp" value={target.noTelp || '-'} />
            <DetailRow label="Email" value={target.email || '-'} />
            <DetailRow label="Angkatan" value={String(target._count?.angkatan || 0)} />
            <DetailRow label="Nilai" value={String(target._count?.nilai || 0)} />
            <DetailRow label="Status" value={<StatusBadge status={target.status} />} />
            <DetailRow label="Diarsipkan pada" value={target.deletedAt ? formatTanggal(target.deletedAt) : '-'} />
          </div>
        )}
        <DialogFooter><DialogClose asChild><Button variant="outline"><X className="w-4 h-4" /> Tutup</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
