'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { NotifikasiEmail } from '@/lib/types'
import { DataTable, PageHeader, type Column } from '@/components/shared/data-table'
import { formatDateTime } from '@/components/shared/ui-helpers'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Trash2, Plus, Save, X, Send, Mail, Bell, MailCheck, MailWarning, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const JENIS_OPTIONS = [
  { value: 'INFO', label: 'Informasi' },
  { value: 'PENGINGAT', label: 'Pengingat' },
  { value: 'UNDANGAN', label: 'Undangan' },
]

const STATUS_TABS = [
  { value: '', label: 'Semua' },
  { value: 'DRAF', label: 'Draft' },
  { value: 'TERKIRIM', label: 'Terkirim' },
  { value: 'GAGAL', label: 'Gagal' },
]

const STATUS_BADGE_MAP: Record<string, { label: string; className: string }> = {
  DRAF: { label: 'Draf', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  TERKIRIM: { label: 'Terkirim', className: 'bg-green-100 text-green-700 border-green-200' },
  GAGAL: { label: 'Gagal', className: 'bg-red-100 text-red-700 border-red-200' },
}

const JENIS_BADGE_MAP: Record<string, { label: string; className: string }> = {
  INFO: { label: 'Informasi', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  PENGINGAT: { label: 'Pengingat', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  UNDANGAN: { label: 'Undangan', className: 'bg-purple-50 text-purple-700 border-purple-200' },
}

// ===========================================================================
// ROOT COMPONENT
// ===========================================================================

export function NotifikasiView() {
  return <NotifikasiDataTable />
}

// ===========================================================================
// DATA TABLE
// ===========================================================================

interface FormState {
  subjek: string
  penerima: string
  jenis: string
  isi: string
}

const EMPTY_FORM: FormState = {
  subjek: '',
  penerima: '',
  jenis: 'INFO',
  isi: '',
}

function NotifikasiDataTable() {
  const { toast } = useToast()

  const [data, setData] = useState<NotifikasiEmail[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('')

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<NotifikasiEmail | null>(null)
  const [deleting, setDeleting] = useState(false)

  // send state
  const [sendingId, setSendingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
      }
      if (activeTab) params.status = activeTab
      const res = await api.notifikasi.list(params)
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

  const openCompose = () => {
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.subjek || !form.penerima || !form.isi) {
      toast({ title: 'Validasi', description: 'Subjek, Penerima, dan Isi wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await api.notifikasi.create({
        subjek: form.subjek,
        penerima: form.penerima,
        jenis: form.jenis || undefined,
        isi: form.isi,
      })
      toast({ title: 'Berhasil', description: 'Draf notifikasi berhasil dibuat' })
      setDialogOpen(false)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async (item: NotifikasiEmail) => {
    setSendingId(item.id)
    try {
      await api.notifikasi.send(item.id)
      toast({ title: 'Berhasil', description: `Notifikasi "${item.subjek}" terkirim` })
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSendingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.notifikasi.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Notifikasi dihapus' })
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<NotifikasiEmail>[] = [
    {
      key: 'subjek', header: 'Subjek', render: (r) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.subjek}</p>
        </div>
      ),
    },
    {
      key: 'penerima', header: 'Penerima', render: (r) => (
        <span className="text-sm text-slate-600 line-clamp-1">{r.penerima}</span>
      ),
    },
    {
      key: 'jenis', header: 'Jenis', render: (r) => {
        const badge = r.jenis ? JENIS_BADGE_MAP[r.jenis] : null
        if (!badge) return <span className="text-slate-400">-</span>
        return (
          <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', badge.className)}>
            {badge.label}
          </span>
        )
      },
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
      <PageHeader title="Notifikasi Email" description="Kelola dan kirim notifikasi email kepada peserta dan pemangku kepentingan" />

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
        searchPlaceholder="Cari subjek / penerima..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onAdd={openCompose}
        addLabel="Buat Notifikasi"
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data notifikasi"
        actions={(row) => (
          <>
            {row.status === 'DRAF' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-slate-500 hover:text-green-600"
                onClick={() => handleSend(row)}
                disabled={sendingId === row.id}
                title="Kirim"
              >
                <Send className={cn('w-4 h-4', sendingId === row.id && 'animate-pulse')} />
              </Button>
            )}
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

      {/* Compose Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#0F4C81]" />
              Buat Notifikasi Baru
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label>Penerima (Email) <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  value={form.penerima}
                  onChange={(e) => setForm({ ...form, penerima: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subjek <span className="text-red-500">*</span></Label>
              <Input
                value={form.subjek}
                onChange={(e) => setForm({ ...form, subjek: e.target.value })}
                placeholder="Subjek email notifikasi"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Isi Pesan <span className="text-red-500">*</span></Label>
              <Textarea
                value={form.isi}
                onChange={(e) => setForm({ ...form, isi: e.target.value })}
                placeholder="Tulis isi pesan email..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}><X className="w-4 h-4" /> Batal</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63]">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Draf'}
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
              Yakin ingin menghapus notifikasi <span className="font-semibold">&quot;{deleteTarget?.subjek}&quot;</span>? Tindakan ini tidak dapat dibatalkan.
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
