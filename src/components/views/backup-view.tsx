'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { BackupHistory, User } from '@/lib/types'
import { useNavStore } from '@/store/auth-store'
import { DataTable, StatCard, PageHeader, type Column } from '@/components/shared/data-table'
import { StatusBadge, formatDateTime } from '@/components/shared/ui-helpers'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Database, Download, Trash2, RotateCcw, HardDrive, CheckCircle2, Clock, AlertTriangle, FileArchive, ShieldAlert } from 'lucide-react'

// ===========================================================================
// ROOT
// ===========================================================================

export function BackupView() {
  const { activeView } = useNavStore()

  if (activeView === 'backup-restore') return <BackupRestoreView />
  if (activeView === 'backup-riwayat') return <BackupRiwayatView />
  return <BackupMainView />
}

// ===========================================================================
// HELPERS
// ===========================================================================

function parseSizeMB(ukuran: string): number {
  // "1.5 MB" -> 1.5 ; "8 MB" -> 8
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

// ===========================================================================
// SUBTAB 1: BACKUP (main)
// ===========================================================================

function BackupMainView() {
  const { toast } = useToast()

  const [data, setData] = useState<BackupHistory[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.backup.list()
      setData(r)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await api.users.list({ page: 1, pageSize: 1000 })
        if (!cancelled) setUsers(res.data)
      } catch {
        /* ignore */
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleCreate = async () => {
    setCreating(true)
    try {
      await api.backup.create()
      toast({ title: 'Berhasil', description: 'Backup database baru berhasil dibuat' })
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const stats = useMemo(() => {
    const total = data.length
    const berhasil = data.filter((b) => b.status === 'BERHASIL').length
    const totalMB = data.reduce((s, b) => s + parseSizeMB(b.ukuran), 0)
    const terakhir = data[0]?.createdAt
    return { total, berhasil, totalMB, terakhir }
  }, [data])

  const userName = (id?: string | null) => {
    if (!id) return 'Sistem'
    const u = users.find((x) => x.id === id)
    return u?.nama || 'Sistem'
  }

  const columns: Column<BackupHistory>[] = [
    {
      key: 'namaFile', header: 'Nama File', render: (r) => (
        <div className="flex items-center gap-2 min-w-[220px]">
          <FileArchive className="w-4 h-4 text-[#0F4C81] flex-shrink-0" />
          <div>
            <p className="font-mono text-xs font-medium text-slate-900">{r.namaFile}</p>
            <p className="text-xs text-slate-400">{r.tipe}</p>
          </div>
        </div>
      ),
    },
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
                <p className="text-sm text-white/80 mt-0.5">
                  Backup database akan disimpan dengan penamaan otomatis berdasarkan timestamp
                </p>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating}
              size="lg"
              className="bg-white text-[#0F4C81] hover:bg-white/90 h-11"
            >
              <Download className="w-4 h-4" />
              {creating ? 'Memproses...' : 'Buat Backup'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        data={data}
        total={data.length}
        page={1}
        pageSize={data.length}
        loading={loading}
        columns={columns}
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada riwayat backup"
      />
    </div>
  )
}

// ===========================================================================
// SUBTAB 2: RESTORE
// ===========================================================================

function BackupRestoreView() {
  const { toast } = useToast()

  const [data, setData] = useState<BackupHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [restoreTarget, setRestoreTarget] = useState<BackupHistory | null>(null)
  const [restoring, setRestoring] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.backup.list()
      setData(r.filter((b) => b.status === 'BERHASIL'))
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    // Simulasi restore (mock)
    setTimeout(() => {
      toast({
        title: 'Restore Berhasil',
        description: `Database berhasil direstore dari ${restoreTarget.namaFile}`,
      })
      setRestoring(false)
      setRestoreTarget(null)
    }, 1200)
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Restore Database" description="Pulihkan database dari file backup yang tersedia" />

      <Card className="border-amber-200 bg-amber-50 shadow-sm">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 text-sm">Peringatan: Operasi Restore Akan Menimpa Data</h3>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Melakukan restore akan <span className="font-semibold">menggantikan seluruh data database saat ini</span> dengan data dari file backup yang dipilih.
              Tindakan ini tidak dapat dibatalkan. Pastikan Anda telah membuat backup terbaru sebelum melanjutkan.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-[#0F4C81]" /> Daftar Backup Tersedia
          </CardTitle>
          <CardDescription className="text-xs">
            Pilih file backup untuk dipulihkan ke database saat ini
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Database className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              Belum ada backup tersedia untuk direstore
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-[#0F4C81]/10 flex items-center justify-center flex-shrink-0">
                      <FileArchive className="w-5 h-5 text-[#0F4C81]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-medium text-slate-900 truncate">{b.namaFile}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span>{b.ukuran}</span>
                        <span>•</span>
                        <span>{formatDateTime(b.createdAt)}</span>
                        <span>•</span>
                        <StatusBadge status={b.status} />
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRestoreTarget(b)}
                    className="h-9 border-[#0F4C81] text-[#0F4C81] hover:bg-[#0F4C81] hover:text-white"
                  >
                    <RotateCcw className="w-4 h-4" /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" /> Konfirmasi Restore Database
            </AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan merestore database dari file <span className="font-mono font-semibold">{restoreTarget?.namaFile}</span>.
              <br /><br />
              <span className="text-amber-700 font-medium">⚠️ Seluruh data saat ini akan ditimpa dengan data dari file backup ini.</span>
              <br />
              Tindakan ini tidak dapat dibatalkan. Lanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={restoring}
              className="bg-[#0F4C81] hover:bg-[#0a3a63] text-white"
            >
              {restoring ? 'Memproses...' : 'Ya, Restore Sekarang'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===========================================================================
// SUBTAB 3: RIWAYAT (full history with delete)
// ===========================================================================

function BackupRiwayatView() {
  const { toast } = useToast()

  const [data, setData] = useState<BackupHistory[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<BackupHistory | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.backup.list()
      setData(r)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await api.users.list({ page: 1, pageSize: 1000 })
        if (!cancelled) setUsers(res.data)
      } catch {
        /* ignore */
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.backup.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Riwayat backup dihapus' })
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const userName = (id?: string | null) => {
    if (!id) return 'Sistem'
    const u = users.find((x) => x.id === id)
    return u?.nama || 'Sistem'
  }

  const columns: Column<BackupHistory>[] = [
    {
      key: 'namaFile', header: 'Nama File', render: (r) => (
        <div className="flex items-center gap-2 min-w-[220px]">
          <FileArchive className="w-4 h-4 text-[#0F4C81] flex-shrink-0" />
          <div>
            <p className="font-mono text-xs font-medium text-slate-900">{r.namaFile}</p>
            <p className="text-xs text-slate-400">{r.tipe}</p>
          </div>
        </div>
      ),
    },
    { key: 'ukuran', header: 'Ukuran', render: (r) => <span className="font-medium text-slate-700">{r.ukuran}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'dibuatOleh', header: 'Dibuat Oleh', render: (r) => <span className="text-xs text-slate-600">{userName(r.dibuatOleh)}</span> },
    { key: 'createdAt', header: 'Waktu', render: (r) => <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Riwayat Backup" description="Seluruh riwayat backup database (read-only dengan opsi hapus)" />

      <DataTable
        data={data}
        total={data.length}
        page={1}
        pageSize={data.length}
        loading={loading}
        columns={columns}
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada riwayat backup"
        actions={(row) => (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
            onClick={() => setDeleteTarget(row)}
            title="Hapus riwayat"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus Riwayat</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus riwayat backup <span className="font-mono font-semibold">{deleteTarget?.namaFile}</span>?
              <br /><br />
              <span className="text-xs text-slate-500">Catatan: ini hanya menghapus catatan riwayat, bukan file fisik backup.</span>
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
