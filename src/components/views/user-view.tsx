'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { User, AuditLog } from '@/lib/types'
import { useNavStore, useAuthStore } from '@/store/auth-store'
import { DataTable, StatCard, PageHeader, type Column, type FilterOption } from '@/components/shared/data-table'
import { StatusBadge, formatDateTime, roleLabel, roleBadgeClass } from '@/components/shared/ui-helpers'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Pencil, Trash2, Plus, Save, X, Users, ShieldCheck, UserCog, UserCheck, Lock, ScrollText, CheckCircle2, History, KeyRound, Eye, EyeOff, AlertCircle } from 'lucide-react'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN_BIDANG', label: 'Admin Bidang' },
  { value: 'OPERATOR', label: 'Operator' },
]

const STATUS_USER = [
  { value: 'AKTIF', label: 'Aktif' },
  { value: 'NONAKTIF', label: 'Nonaktif' },
]

const AKSI_OPTIONS = [
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'BACKUP', label: 'Backup' },
]

const MODUL_OPTIONS = [
  { value: 'USER', label: 'User' },
  { value: 'AUTH', label: 'Auth' },
  { value: 'PELATIHAN', label: 'Pelatihan' },
  { value: 'ANGKATAN', label: 'Angkatan' },
  { value: 'PESERTA', label: 'Peserta' },
  { value: 'EVALUASI', label: 'Evaluasi' },
  { value: 'UJI_KOMPETENSI', label: 'Uji Kompetensi' },
  { value: 'BACKUP', label: 'Backup' },
  { value: 'SETTINGS', label: 'Settings' },
  { value: 'ANALISIS', label: 'Analisis' },
  { value: 'DASHBOARD', label: 'Dashboard' },
]

// RBAC matrix definition
const ALL_MODULES = [
  'Dashboard',
  'Analisis Kebutuhan',
  'Pelatihan',
  'Uji Kompetensi',
  'Data Peserta',
  'Monitoring & Evaluasi',
  'Laporan',
  'Manajemen User',
  'Backup & Restore',
  'Pengaturan Sistem',
]

const RBAC_MATRIX: Record<string, { label: string; modules: string[]; description: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    modules: [...ALL_MODULES],
    description: 'Akses penuh ke seluruh modul sistem tanpa batasan',
  },
  ADMIN_BIDANG: {
    label: 'Admin Bidang',
    modules: [
      'Dashboard', 'Analisis Kebutuhan', 'Pelatihan', 'Uji Kompetensi',
      'Data Peserta', 'Monitoring & Evaluasi', 'Laporan',
      'Backup & Restore', 'Pengaturan Sistem',
    ],
    description: 'Akses pengelolaan operasional tanpa Manajemen User',
  },
  OPERATOR: {
    label: 'Operator',
    modules: [
      'Dashboard', 'Analisis Kebutuhan', 'Pelatihan', 'Uji Kompetensi',
      'Data Peserta', 'Monitoring & Evaluasi', 'Laporan',
    ],
    description: 'Akses terbatas untuk input data dan pelaporan (read-mostly)',
  },
}

// ===========================================================================
// ROOT
// ===========================================================================

export function UserView() {
  const { activeView } = useNavStore()

  if (activeView === 'user-hak-akses') return <UserHakAksesView />
  if (activeView === 'user-log') return <UserLogView />
  return <UserDataView />
}

// ===========================================================================
// SUBTAB 1: USER DATA (CRUD)
// ===========================================================================

const EMPTY_FORM: Partial<User> & { password?: string } = {
  username: '',
  password: '',
  nama: '',
  email: '',
  role: 'OPERATOR',
  status: 'AKTIF',
  noTelp: '',
}

function UserDataView() {
  const { user: currentUser } = useAuthStore()
  const { toast } = useToast()

  const [data, setData] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [allUsers, setAllUsers] = useState<User[]>([])

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<(Partial<User> & { password?: string })>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  // password change state (Super Admin only)
  const [pwTarget, setPwTarget] = useState<User | null>(null)
  const [pwForm, setPwForm] = useState({ password: '', confirm: '', showPw: false })
  const [pwSaving, setPwSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        role: filters.role || undefined,
        status: filters.status || undefined,
      }
      const res = await api.users.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filters, toast])

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await api.users.list({ page: 1, pageSize: 1000 })
      setAllUsers(res.data)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchAllUsers()
  }, [fetchAllUsers])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }))
    setPage(1)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const openEdit = (item: User) => {
    setEditing(item)
    setForm({
      username: item.username,
      password: '',
      nama: item.nama,
      email: item.email,
      role: item.role,
      status: item.status,
      noTelp: item.noTelp || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.username || !form.email || !form.nama) {
      toast({ title: 'Validasi', description: 'Username, Nama, dan Email wajib diisi', variant: 'destructive' })
      return
    }
    if (!editing && !form.password) {
      toast({ title: 'Validasi', description: 'Password wajib diisi untuk user baru', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload: Partial<User> & { password?: string } = {
        username: form.username,
        nama: form.nama,
        email: form.email,
        role: form.role as User['role'],
        status: form.status as string,
        noTelp: form.noTelp || null,
      }
      if (form.password && form.password.trim() !== '') {
        payload.password = form.password
      }
      if (editing) {
        await api.users.update(editing.id, payload)
        toast({ title: 'Berhasil', description: 'Data user diperbarui' })
      } else {
        await api.users.create(payload as Parameters<typeof api.users.create>[0])
        toast({ title: 'Berhasil', description: 'User baru ditambahkan' })
      }
      setDialogOpen(false)
      fetchData()
      fetchAllUsers()
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
      await api.users.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'User dihapus' })
      setDeleteTarget(null)
      fetchData()
      fetchAllUsers()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const openChangePassword = (item: User) => {
    setPwTarget(item)
    setPwForm({ password: '', confirm: '', showPw: false })
  }

  const handleChangePassword = async () => {
    if (!pwTarget) return
    if (!pwForm.password || pwForm.password.length < 6) {
      toast({ title: 'Validasi', description: 'Password minimal 6 karakter', variant: 'destructive' })
      return
    }
    if (pwForm.password !== pwForm.confirm) {
      toast({ title: 'Validasi', description: 'Konfirmasi password tidak cocok', variant: 'destructive' })
      return
    }
    setPwSaving(true)
    try {
      await api.users.update(pwTarget.id, { password: pwForm.password })
      toast({ title: 'Berhasil', description: `Password user ${pwTarget.nama} berhasil diubah`, variant: 'default' })
      setPwTarget(null)
      setPwForm({ password: '', confirm: '', showPw: false })
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setPwSaving(false)
    }
  }

  const stats = useMemo(() => {
    const totalUser = allUsers.length || total
    const superAdmin = allUsers.filter((u) => u.role === 'SUPER_ADMIN').length
    const adminBidang = allUsers.filter((u) => u.role === 'ADMIN_BIDANG').length
    const operator = allUsers.filter((u) => u.role === 'OPERATOR').length
    return { totalUser, superAdmin, adminBidang, operator }
  }, [allUsers, total])

  const filterOptions: FilterOption[] = [
    { key: 'role', label: 'Role', options: ROLE_OPTIONS },
    { key: 'status', label: 'Status', options: STATUS_USER },
  ]

  const columns: Column<User>[] = [
    {
      key: 'nama', header: 'Nama', render: (r) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-slate-900">{r.nama}</p>
          <p className="text-xs text-slate-400">@{r.username}</p>
        </div>
      ),
    },
    { key: 'username', header: 'Username', render: (r) => <span className="font-mono text-xs text-slate-600">{r.username}</span> },
    { key: 'email', header: 'Email', render: (r) => <span className="text-slate-600 text-xs">{r.email}</span> },
    {
      key: 'role', header: 'Role', render: (r) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleBadgeClass(r.role)}`}>
          {roleLabel(r.role)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'lastLogin', header: 'Login Terakhir', render: (r) => <span className="text-xs text-slate-500">{formatDateTime(r.lastLogin)}</span> },
    { key: 'createdAt', header: 'Dibuat', render: (r) => <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Manajemen User" description="Kelola akun pengguna sistem dan hak aksesnya" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Total User" value={stats.totalUser} icon={Users} color="blue" />
        <StatCard title="Super Admin" value={stats.superAdmin} icon={ShieldCheck} color="red" />
        <StatCard title="Admin Bidang" value={stats.adminBidang} icon={UserCog} color="amber" />
        <StatCard title="Operator" value={stats.operator} icon={UserCheck} color="green" />
      </div>

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari nama / username / email..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        filters={filterOptions}
        filterValues={filters}
        onFilterChange={handleFilter}
        onAdd={openCreate}
        addLabel="Tambah User"
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data user"
        actions={(row) => (
          <>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-[#0F4C81]" onClick={() => openEdit(row)} title="Edit">
              <Pencil className="w-4 h-4" />
            </Button>
            {currentUser?.role === 'SUPER_ADMIN' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-slate-500 hover:text-amber-600"
                onClick={() => openChangePassword(row)}
                title="Ganti Password"
              >
                <KeyRound className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 disabled:opacity-40"
              onClick={() => setDeleteTarget(row)}
              disabled={row.id === currentUser?.id}
              title={row.id === currentUser?.id ? 'Tidak dapat menghapus diri sendiri' : 'Hapus'}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'Tambah User Baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Username <span className="text-red-500">*</span></Label>
              <Input
                value={form.username || ''}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="username login"
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password {editing && <span className="text-xs text-slate-400">(kosongkan jika tidak diubah)</span>}{!editing && <span className="text-red-500">*</span>}</Label>
              <Input
                type="password"
                value={form.password || ''}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? '•••••••' : 'Min. 6 karakter'}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nama Lengkap <span className="text-red-500">*</span></Label>
              <Input value={form.nama || ''} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama lengkap user" />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@bpsdm.acehprov.go.id" />
            </div>
            <div className="space-y-1.5">
              <Label>No. Telepon</Label>
              <Input value={form.noTelp || ''} onChange={(e) => setForm({ ...form, noTelp: e.target.value })} placeholder="08xx-xxxx-xxxx" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role || 'OPERATOR'} onValueChange={(v) => setForm({ ...form, role: v as User['role'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || 'AKTIF'} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_USER.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
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

      {/* Change Password Dialog (Super Admin only) */}
      <Dialog open={!!pwTarget} onOpenChange={(o) => !o && setPwTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              Ganti Password User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                Anda akan mengubah password untuk user:
              </p>
              <p className="text-sm font-semibold text-amber-900 mt-1">
                {pwTarget?.nama} <span className="font-normal text-amber-700">(@{pwTarget?.username})</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Password Baru <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  type={pwForm.showPw ? 'text' : 'password'}
                  value={pwForm.password}
                  onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })}
                  placeholder="Min. 6 karakter"
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setPwForm({ ...pwForm, showPw: !pwForm.showPw })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {pwForm.showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Konfirmasi Password <span className="text-red-500">*</span></Label>
              <Input
                type={pwForm.showPw ? 'text' : 'password'}
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                placeholder="Ulangi password baru"
              />
            </div>
            {pwForm.password && pwForm.confirm && pwForm.password !== pwForm.confirm && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Konfirmasi password tidak cocok
              </p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={pwSaving}><X className="w-4 h-4" /> Batal</Button>
            </DialogClose>
            <Button onClick={handleChangePassword} disabled={pwSaving} className="bg-amber-600 hover:bg-amber-700">
              <Save className="w-4 h-4" /> {pwSaving ? 'Menyimpan...' : 'Ubah Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus User</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus user <span className="font-semibold">{deleteTarget?.nama} (@{deleteTarget?.username})</span>? Tindakan ini tidak dapat dibatalkan.
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
// SUBTAB 2: HAK AKSES (RBAC MATRIX)
// ===========================================================================

const ROLE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; ring: string }> = {
  SUPER_ADMIN: { icon: ShieldCheck, color: 'text-red-700 bg-red-50', ring: 'ring-red-100' },
  ADMIN_BIDANG: { icon: UserCog, color: 'text-amber-700 bg-amber-50', ring: 'ring-amber-100' },
  OPERATOR: { icon: UserCheck, color: 'text-green-700 bg-green-50', ring: 'ring-green-100' },
}

function UserHakAksesView() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Hak Akses Pengguna (RBAC)"
        description="Matriks role-based access control — kewenangan tiap role terhadap modul sistem"
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {Object.entries(RBAC_MATRIX).map(([roleKey, role]) => {
          const meta = ROLE_META[roleKey]
          const RoleIcon = meta.icon
          return (
            <Card key={roleKey} className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ring-4 ${meta.color} ${meta.ring}`}>
                    <RoleIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{role.label}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{role.modules.length} modul diakses</CardDescription>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{role.description}</p>
              </CardHeader>
              <CardContent className="p-4">
                <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {ALL_MODULES.map((mod) => {
                    const allowed = role.modules.includes(mod)
                    return (
                      <li key={mod} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-slate-50">
                        <span className={`text-sm ${allowed ? 'text-slate-700' : 'text-slate-400'}`}>{mod}</span>
                        {allowed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-slate-200 shadow-sm bg-slate-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-[#0F4C81] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-700 mb-1">Catatan Keamanan</p>
            <p className="text-xs leading-relaxed">
              Hak akses diterapkan pada setiap endpoint API menggunakan middleware <code className="text-xs bg-slate-200 px-1 py-0.5 rounded">hasPermission()</code>.
              Super Admin memiliki akses tanpa batasan. Permintaan yang ditolak akan mengembalikan HTTP 403 Forbidden.
              Aktivitas setiap user tercatat di Audit Log untuk keperluan jejak audit.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// SUBTAB 3: USER LOG (Audit Log)
// ===========================================================================

function UserLogView() {
  const { toast } = useToast()

  const [data, setData] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        aksi: filters.aksi || undefined,
        modul: filters.modul || undefined,
      }
      const res = await api.auditLog.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filters, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }))
    setPage(1)
  }

  const filterOptions: FilterOption[] = [
    { key: 'aksi', label: 'Aksi', options: AKSI_OPTIONS },
    { key: 'modul', label: 'Modul', options: MODUL_OPTIONS },
  ]

  const aksiBadgeClass = (aksi: string): string => {
    const map: Record<string, string> = {
      CREATE: 'bg-green-100 text-green-700 border-green-200',
      UPDATE: 'bg-blue-100 text-blue-700 border-blue-200',
      DELETE: 'bg-red-100 text-red-700 border-red-200',
      LOGIN: 'bg-purple-100 text-purple-700 border-purple-200',
      LOGOUT: 'bg-slate-100 text-slate-700 border-slate-200',
      BACKUP: 'bg-amber-100 text-amber-700 border-amber-200',
    }
    return map[aksi] || 'bg-slate-100 text-slate-700 border-slate-200'
  }

  const columns: Column<AuditLog>[] = [
    { key: 'createdAt', header: 'Waktu', render: (r) => <span className="text-xs text-slate-600 font-mono">{formatDateTime(r.createdAt)}</span> },
    { key: 'username', header: 'User', render: (r) => <span className="font-medium text-slate-900 text-sm">{r.username}</span> },
    {
      key: 'aksi', header: 'Aksi', render: (r) => (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${aksiBadgeClass(r.aksi)}`}>
          {r.aksi}
        </span>
      ),
    },
    { key: 'modul', header: 'Modul', render: (r) => <span className="text-slate-600 text-xs">{r.modul}</span> },
    { key: 'deskripsi', header: 'Deskripsi', render: (r) => <span className="text-slate-500 text-xs line-clamp-1 max-w-[280px] inline-block">{r.deskripsi}</span> },
    { key: 'ip', header: 'IP', render: (r) => <span className="font-mono text-xs text-slate-500">{r.ip || '-'}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Log Aktivitas User"
        description="Jejak audit seluruh aktivitas user di sistem (urut: terbaru)"
      />

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari username / deskripsi..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        filters={filterOptions}
        filterValues={filters}
        onFilterChange={handleFilter}
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada aktivitas tercatat"
      />
    </div>
  )
}
