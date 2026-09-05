'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { api } from '@/lib/api'
import type { BackupHistory, User } from '@/lib/types'
import { useNavStore, useAuthStore, hasPermission } from '@/store/auth-store'
import { DataTable, StatCard, PageHeader, type Column } from '@/components/shared/data-table'
import { StatusBadge, formatDateTime } from '@/components/shared/ui-helpers'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Database, Download, Trash2, RotateCcw, HardDrive, CheckCircle2, Clock, AlertTriangle, FileArchive, ShieldAlert, Upload } from 'lucide-react'

export function BackupView() {
  const { activeView } = useNavStore()
  if (activeView === 'backup-restore') return <BackupRestoreView />
  if (activeView === 'backup-riwayat') return <BackupRiwayatView />
  return <BackupMainView />
}

type EnrichedBackup = BackupHistory & { fileExists?: boolean }

function parseSizeMB(ukuran: string): number {
  const m = ukuran.match(/([\d.]+)\s*MB/i)
  if (m) return parseFloat(m[1])
  const k = ukuran.match(/([\d.]+)\s*KB/i)
  if (k) return parseFloat(k[1]) / 1024
  return 0
}

function formatTotalSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}

function BackupMainView() {
  const { toast } = useToast()
  const [data, setData] = useState<EnrichedBackup[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const role = useAuthStore((s) => s.user?.role)
  const canViewUsers = hasPermission(role, 'users:view')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try { const r = await api.backup.list(); setData(r) }
    catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    // Daftar user hanya bisa diakses SUPER_ADMIN (users:view) — tanpa ini
    // browser mencatat error 403 di console tiap kali halaman backup dibuka
    // oleh ADMIN_BIDANG (nama "Dibuat Oleh" memang kosong untuk role itu).
    if (!canViewUsers) return
    let cancelled = false
    api.users.list({ page: 1, pageSize: 1000 }).then(r => { if (!cancelled) setUsers(r.data) }).catch(() => {})
    return () => { cancelled = true }
  }, [canViewUsers])

  const handleCreate = async () => {
    setCreating(true)
    try {
      await api.backup.create()
      toast({ title: 'Berhasil', description: 'Backup lengkap berhasil dibuat (.zip: database + file upload)' })
      fetchData()
    } catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) }
    finally { setCreating(false) }
  }

  const handleDownload = (item: EnrichedBackup) => {
    if (!item.fileExists) {
      toast({ title: 'File Tidak Ada', description: 'File backup tidak ditemukan di server', variant: 'destructive' })
      return
    }
    api.backup.download(item.id)
  }

  const stats = useMemo(() => {
    const total = data.length
    const berhasil = data.filter(b => b.status === 'BERHASIL').length
    const totalMB = data.reduce((s, b) => s + parseSizeMB(b.ukuran), 0)
    const terakhir = data[0]?.createdAt
    return { total, berhasil, totalMB, terakhir }
  }, [data])

  const userName = (id?: string | null) => {
    if (!id) return 'Sistem'
    const u = users.find(x => x.id === id)
    return u?.nama || 'Sistem'
  }

  const columns: Column<EnrichedBackup>[] = [
    { key: 'namaFile', header: 'Nama File', render: (r) => (
      <div className="flex items-center gap-2 min-w-[220px]">
        <FileArchive className="w-4 h-4 text-[#0F4C81] flex-shrink-0" />
        <div>
          <p className="font-mono text-xs font-medium text-slate-900">{r.namaFile}</p>
          <p className="text-xs text-slate-400">{r.tipe}</p>
        </div>
      </div>
    )},
    { key: 'ukuran', header: 'Ukuran', render: (r) => <span className="font-medium text-slate-700">{r.ukuran}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'dibuatOleh', header: 'Dibuat Oleh', render: (r) => <span className="text-xs text-slate-600">{userName(r.dibuatOleh)}</span> },
    { key: 'createdAt', header: 'Waktu', render: (r) => <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Backup & Restore" description="Cadangkan dan kelola data database sistem" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Total Backup" value={stats.total} icon={Database} color="blue" />
        <StatCard title="Backup Berhasil" value={stats.berhasil} icon={CheckCircle2} color="green" />
        <StatCard title="Total Ukuran" value={formatTotalSize(stats.totalMB)} icon={HardDrive} color="amber" />
        <StatCard title="Backup Terakhir" value={stats.terakhir ? formatDateTime(stats.terakhir) : '-'} icon={Clock} color="slate" />
      </div>
      <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-[#0F4C81] to-[#0a3a63] text-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <Database className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Buat Backup Sekarang</h3>
                <p className="text-sm text-white/80 mt-0.5">File database (.sql) akan disalin ke folder backups</p>
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating} size="lg" className="bg-white text-[#0F4C81] hover:bg-white/90 h-11">
              <Download className="w-4 h-4" /> {creating ? 'Memproses...' : 'Buat Backup'}
            </Button>
          </div>
        </CardContent>
      </Card>
      <DataTable
        data={data} total={data.length} page={1} pageSize={data.length} loading={loading}
        columns={columns} onRefresh={fetchData} rowKey={(r) => r.id} emptyMessage="Belum ada riwayat backup"
        actions={(row) => (
          <Button size="sm" variant="ghost"
            className={`h-8 px-2 ${row.fileExists ? 'text-[#0F4C81] hover:bg-[#0F4C81]/10' : 'text-slate-300 cursor-not-allowed'}`}
            onClick={() => handleDownload(row)} disabled={!row.fileExists}
            title={row.fileExists ? 'Download file backup' : 'File tidak tersedia'}>
            <Download className="w-4 h-4" /> {row.fileExists ? 'Download' : 'N/A'}
          </Button>
        )}
      />
    </div>
  )
}

function BackupRestoreView() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<EnrichedBackup[]>([])
  const [loading, setLoading] = useState(true)
  const [restoreTarget, setRestoreTarget] = useState<EnrichedBackup | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [showUploadConfirm, setShowUploadConfirm] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try { const r = await api.backup.list(); setData(r.filter(b => b.status === 'BERHASIL' && b.fileExists)) }
    catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      const res = await api.backup.restore(restoreTarget.id)
      toast({ title: 'Restore Berhasil', description: res.message })
      setRestoring(false); setRestoreTarget(null)
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) { toast({ title: 'Gagal Restore', description: (e as Error).message, variant: 'destructive' }); setRestoring(false) }
  }

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const name = file.name.toLowerCase()
    if (!name.endsWith('.sql') && !name.endsWith('.zip')) {
      toast({ title: 'Format Salah', description: 'File harus .sql (dump MySQL) atau .zip (backup lengkap: database + file upload)', variant: 'destructive' })
      return
    }
    setUploadFile(file)
    setShowUploadConfirm(true)
  }

  const handleUploadRestore = async () => {
    if (!uploadFile) return
    setUploading(true)
    try {
      const res = await api.backup.uploadRestore(uploadFile)
      toast({ title: 'Restore Berhasil', description: res.message })
      setShowUploadConfirm(false); setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) { toast({ title: 'Gagal Restore', description: (e as Error).message, variant: 'destructive' }) }
    finally { setUploading(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Restore Database" description="Pulihkan database & file upload dari file backup" />
      <Card className="border-amber-200 bg-amber-50 shadow-sm">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 text-sm">Peringatan: Restore Akan Menimpa Data</h3>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              <span className="font-semibold">Seluruh data database saat ini akan diganti</span> dengan data dari file backup. Backup format .zip juga memulihkan file upload (sertifikat/surat tugas/dokumen pendaftar) dan akan menimpa file yang sama. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-600" /> Restore dari File Komputer
          </CardTitle>
          <CardDescription className="text-xs">Upload file backup (.sql dump MySQL atau .zip backup lengkap berisi database + file upload)</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept=".sql,.zip" className="hidden" onChange={handleUploadChange} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="border-emerald-600 text-emerald-600 hover:bg-emerald-50">
              <Upload className="w-4 h-4" /> Pilih File Backup
            </Button>
            {uploadFile && (
              <span className="text-xs text-slate-600">
                <span className="font-mono font-medium">{uploadFile.name}</span>
                <span className="text-slate-400 ml-1">({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-[#0F4C81]" /> Daftar Backup Tersedia
          </CardTitle>
          <CardDescription className="text-xs">Pilih file backup untuk dipulihkan</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Database className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              Belum ada backup tersedia
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.map(b => (
                <li key={b.id} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-[#0F4C81]/10 flex items-center justify-center flex-shrink-0">
                      <FileArchive className="w-5 h-5 text-[#0F4C81]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-medium text-slate-900 truncate">{b.namaFile}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span>{b.ukuran}</span><span>•</span><span>{formatDateTime(b.createdAt)}</span><span>•</span><StatusBadge status={b.status} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => api.backup.download(b.id)} className="h-9 text-xs" title="Download">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRestoreTarget(b)} className="h-9 border-[#0F4C81] text-[#0F4C81] hover:bg-[#0F4C81] hover:text-white">
                      <RotateCcw className="w-4 h-4" /> Restore
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!restoreTarget} onOpenChange={o => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-600" /> Konfirmasi Restore</AlertDialogTitle>
            <AlertDialogDescription>
              Restore database{restoreTarget?.namaFile?.toLowerCase().endsWith('.zip') ? ' + file upload (sertifikat/surat tugas/dokumen pendaftar)' : ''} dari <span className="font-mono font-semibold">{restoreTarget?.namaFile}</span>?
              <br /><br /><span className="text-amber-700 font-medium">⚠️ Seluruh data saat ini akan ditimpa!</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring} className="bg-[#0F4C81] hover:bg-[#0a3a63] text-white">
              {restoring ? 'Memproses...' : 'Ya, Restore Sekarang'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showUploadConfirm} onOpenChange={o => { if (!o) { setShowUploadConfirm(false); setUploadFile(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-600" /> Upload & Restore</AlertDialogTitle>
            <AlertDialogDescription>
              Ganti database{uploadFile?.name?.toLowerCase().endsWith('.zip') ? ' + pulihkan file upload (sertifikat/surat tugas/dokumen pendaftar)' : ''} dengan <span className="font-mono font-semibold">{uploadFile?.name}</span> ({uploadFile ? (uploadFile.size / 1024 / 1024).toFixed(2) : '0'} MB)?
              <br /><br /><span className="text-amber-700 font-medium">⚠️ Seluruh data saat ini akan ditimpa!</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={uploading}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleUploadRestore} disabled={uploading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {uploading ? 'Mengupload...' : 'Ya, Upload & Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function BackupRiwayatView() {
  const { toast } = useToast()
  const [data, setData] = useState<EnrichedBackup[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<EnrichedBackup | null>(null)
  const [deleting, setDeleting] = useState(false)
  const role = useAuthStore((s) => s.user?.role)
  const canViewUsers = hasPermission(role, 'users:view')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try { const r = await api.backup.list(); setData(r) }
    catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    // Daftar user hanya bisa diakses SUPER_ADMIN (users:view) — tanpa ini
    // browser mencatat error 403 di console tiap kali halaman dibuka
    // oleh ADMIN_BIDANG (nama "Dibuat Oleh" memang kosong untuk role itu).
    if (!canViewUsers) return
    let cancelled = false
    api.users.list({ page: 1, pageSize: 1000 }).then(r => { if (!cancelled) setUsers(r.data) }).catch(() => {})
    return () => { cancelled = true }
  }, [canViewUsers])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.backup.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Backup dihapus (file fisik juga dihapus)' })
      setDeleteTarget(null); fetchData()
    } catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) }
    finally { setDeleting(false) }
  }

  const userName = (id?: string | null) => {
    if (!id) return 'Sistem'
    const u = users.find(x => x.id === id)
    return u?.nama || 'Sistem'
  }

  const columns: Column<EnrichedBackup>[] = [
    { key: 'namaFile', header: 'Nama File', render: (r) => (
      <div className="flex items-center gap-2 min-w-[220px]">
        <FileArchive className={`w-4 h-4 flex-shrink-0 ${r.fileExists ? 'text-[#0F4C81]' : 'text-slate-300'}`} />
        <div>
          <p className="font-mono text-xs font-medium text-slate-900">{r.namaFile}</p>
          <p className="text-xs text-slate-400">{r.tipe}{!r.fileExists && <span className="text-amber-600 ml-2">• File hilang</span>}</p>
        </div>
      </div>
    )},
    { key: 'ukuran', header: 'Ukuran', render: (r) => <span className="font-medium text-slate-700">{r.ukuran}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'dibuatOleh', header: 'Dibuat Oleh', render: (r) => <span className="text-xs text-slate-600">{userName(r.dibuatOleh)}</span> },
    { key: 'createdAt', header: 'Waktu', render: (r) => <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Riwayat Backup" description="Seluruh riwayat backup dengan opsi hapus" />
      <DataTable
        data={data} total={data.length} page={1} pageSize={data.length} loading={loading}
        columns={columns} onRefresh={fetchData} rowKey={(r) => r.id} emptyMessage="Belum ada riwayat backup"
        actions={(row) => (
          <div className="flex items-center gap-1">
            {row.fileExists && (
              <Button size="sm" variant="ghost" className="h-8 px-2 text-[#0F4C81]" onClick={() => api.backup.download(row.id)} title="Download">
                <Download className="w-4 h-4" />
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-red-600" onClick={() => setDeleteTarget(row)} title="Hapus">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Hapus <span className="font-mono font-semibold">{deleteTarget?.namaFile}</span>?
              <br /><br /><span className="text-red-600 font-medium">File fisik backup akan ikut terhapus dari server.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
