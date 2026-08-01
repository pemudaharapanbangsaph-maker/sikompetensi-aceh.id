'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import type { AuditLog } from '@/lib/types'
import { useNavStore } from '@/store/auth-store'
import { DataTable, PageHeader, type Column, type FilterOption } from '@/components/shared/data-table'
import { formatDateTime } from '@/components/shared/ui-helpers'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Save, Building2, ImageIcon, Shield, ScrollText, GraduationCap, Upload, CheckCircle2, Lock, Clock, RefreshCw, KeyRound, FileCheck } from 'lucide-react'

// ===========================================================================
// ROOT
// ===========================================================================

export function SettingsView() {
  const { activeView } = useNavStore()

  if (activeView === 'settings-logo') return <SettingsLogoView />
  if (activeView === 'settings-login') return <SettingsLoginView />
  if (activeView === 'settings-audit') return <SettingsAuditView />
  return <SettingsProfilView />
}

// ===========================================================================
// SUBTAB 1: PROFIL INSTANSI
// ===========================================================================

const PROFIL_FIELDS = [
  { key: 'nama_instansi', label: 'Nama Instansi', placeholder: 'Badan Pengembangan Sumber Daya Manusia Aceh', type: 'text', required: true },
  { key: 'nama_bidang', label: 'Nama Bidang', placeholder: 'Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti', type: 'text', required: true },
  { key: 'nama_sistem', label: 'Nama Sistem', placeholder: 'Sistem Informasi Kompetensi Teknis BPSDM Aceh', type: 'text', required: true },
  { key: 'alamat', label: 'Alamat', placeholder: 'Jl. T. Iskandar No.1, Banda Aceh', type: 'textarea' },
  { key: 'telepon', label: 'Telepon', placeholder: '(0651) xxxxx', type: 'text' },
  { key: 'email', label: 'Email', placeholder: 'info@bpsdm.acehprov.go.id', type: 'email' },
  { key: 'website', label: 'Website', placeholder: 'https://bpsdm.acehprov.go.id', type: 'text' },
]

function SettingsProfilView() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await api.settings.get()
        if (!cancelled) setSettings(r)
      } catch (e) {
        if (!cancelled) toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [toast])

  const update = (k: string, v: string) => setSettings((prev) => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    for (const f of PROFIL_FIELDS) {
      if (f.required && !settings[f.key]) {
        toast({ title: 'Validasi', description: `${f.label} wajib diisi`, variant: 'destructive' })
        return
      }
    }
    setSaving(true)
    try {
      await api.settings.update(settings)
      toast({ title: 'Berhasil', description: 'Profil instansi disimpan' })
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Profil Instansi" description="Kelola informasi identitas instansi dan sistem" />

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0F4C81]" /> Identitas Instansi
          </CardTitle>
          <CardDescription className="text-xs">
            Informasi ini akan ditampilkan pada header sistem, laporan, dan dokumen resmi
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-24 animate-pulse" />
                  <div className="h-9 bg-slate-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PROFIL_FIELDS.map((f) => (
                  <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}>
                    <Label>
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </Label>
                    {f.type === 'textarea' ? (
                      <Textarea
                        rows={2}
                        value={settings[f.key] || ''}
                        onChange={(e) => update(f.key, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    ) : (
                      <Input
                        type={f.type}
                        value={settings[f.key] || ''}
                        onChange={(e) => update(f.key, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-5 mt-5 border-t border-slate-100">
                <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63] h-10">
                  <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Profil'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// SUBTAB 2: LOGO
// ===========================================================================

function SettingsLogoView() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await api.settings.get()
        if (!cancelled) setSettings(r)
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Gagal', description: 'Ukuran file maksimal 2MB', variant: 'destructive' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSimpan = () => {
    toast({ title: 'Logo diperbarui', description: preview ? 'Logo baru disimpan (mock)' : 'Tidak ada perubahan logo' })
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Logo Sistem" description="Unggah dan kelola logo instansi yang ditampilkan pada sistem" />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#0F4C81]" /> Logo Saat Ini
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
            ) : (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-[#0F4C81] to-[#0a3a63] flex items-center justify-center mb-4 shadow-lg">
                  <GraduationCap className="w-16 h-16 text-white" />
                </div>
                <p className="font-semibold text-slate-900 text-center">
                  {settings.nama_instansi || 'BPSDM Aceh'}
                </p>
                <p className="text-xs text-slate-500 text-center mt-1">
                  {settings.nama_sistem || 'Sistem Informasi Kompetensi Teknis'}
                </p>
                <Badge variant="outline" className="mt-3 text-xs">Logo Default</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#0F4C81]" /> Unggah Logo Baru
            </CardTitle>
            <CardDescription className="text-xs">
              Format: PNG, JPG, atau SVG. Maksimal 2MB. Rekomendasi 256x256 px.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <label
              htmlFor="logo-upload"
              className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0F4C81] hover:bg-slate-50 transition-colors p-6"
            >
              <div className="flex flex-col items-center justify-center text-center">
                {preview ? (
                  <div className="w-24 h-24 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden mb-3">
                    <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <Upload className="w-7 h-7 text-slate-400" />
                  </div>
                )}
                <p className="text-sm font-medium text-slate-700">
                  {preview ? 'Logo dipilih, klik untuk ganti' : 'Klik untuk memilih file'}
                </p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG, atau SVG (maks. 2MB)</p>
              </div>
              <input
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreview(null)} disabled={!preview}>
                Batal
              </Button>
              <Button onClick={handleSimpan} disabled={!preview} className="bg-[#0F4C81] hover:bg-[#0a3a63]">
                <Save className="w-4 h-4" /> Simpan Logo
              </Button>
            </div>

            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
              <strong className="text-slate-700">Catatan:</strong> Fitur upload logo adalah simulasi pada lingkungan ini.
              Pada produksi, file akan disimpan ke storage server dan URL-nya disimpan di tabel pengaturan.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ===========================================================================
// SUBTAB 3: LOGIN SETTINGS
// ===========================================================================

const SECURITY_FEATURES = [
  { label: 'Password Hashing (bcrypt)', icon: Lock, color: 'text-green-700 bg-green-50 border-green-200' },
  { label: 'Session Timeout', icon: Clock, color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { label: 'CSRF Protection', icon: Shield, color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { label: 'Audit Trail', icon: FileCheck, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { label: 'Login Attempt Limit', icon: KeyRound, color: 'text-red-700 bg-red-50 border-red-200' },
  { label: 'HttpOnly Cookies', icon: CheckCircle2, color: 'text-green-700 bg-green-50 border-green-200' },
]

function SettingsLoginView() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await api.settings.get()
        if (!cancelled) {
          setSettings({
            session_timeout: r.session_timeout || '60',
            max_login_attempts: r.max_login_attempts || '5',
          })
        }
      } catch (e) {
        if (!cancelled) toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [toast])

  const update = (k: string, v: string) => setSettings((prev) => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    const timeout = parseInt(settings.session_timeout || '60', 10)
    const attempts = parseInt(settings.max_login_attempts || '5', 10)
    if (timeout < 5 || timeout > 1440) {
      toast({ title: 'Validasi', description: 'Session timeout harus antara 5 - 1440 menit', variant: 'destructive' })
      return
    }
    if (attempts < 3 || attempts > 10) {
      toast({ title: 'Validasi', description: 'Maksimal percobaan login harus antara 3 - 10', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await api.settings.update({
        session_timeout: String(timeout),
        max_login_attempts: String(attempts),
      })
      toast({ title: 'Berhasil', description: 'Pengaturan login disimpan' })
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Pengaturan Login & Keamanan" description="Konfigurasi kebijakan sesi dan keamanan autentikasi" />

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#0F4C81]" /> Kebijakan Sesi & Autentikasi
          </CardTitle>
          <CardDescription className="text-xs">
            Pengaturan ini berlaku untuk seluruh user pada login berikutnya
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-32 animate-pulse" />
                  <div className="h-9 bg-slate-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Session Timeout (menit) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min={5}
                    max={1440}
                    value={settings.session_timeout || ''}
                    onChange={(e) => update('session_timeout', e.target.value)}
                    placeholder="60"
                  />
                  <p className="text-xs text-slate-500">Durasi idle sebelum sesi user otomatis logout (5 - 1440 menit)</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Maksimal Percobaan Login <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min={3}
                    max={10}
                    value={settings.max_login_attempts || ''}
                    onChange={(e) => update('max_login_attempts', e.target.value)}
                    placeholder="5"
                  />
                  <p className="text-xs text-slate-500">Jumlah percobaan gagal sebelum akun terkunci sementara (3 - 10)</p>
                </div>
              </div>
              <div className="flex justify-end pt-5 mt-5 border-t border-slate-100">
                <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63] h-10">
                  <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" /> Fitur Keamanan Aktif
          </CardTitle>
          <CardDescription className="text-xs">
            Fitur keamanan yang telah diterapkan pada sistem ini
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SECURITY_FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.label}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ${f.color}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{f.label}</span>
                  <CheckCircle2 className="w-4 h-4 ml-auto flex-shrink-0" />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// SUBTAB 4: AUDIT LOG (Sistem)
// ===========================================================================

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
  { value: 'PENGATURAN', label: 'Pengaturan' },
  { value: 'ANALISIS', label: 'Analisis' },
]

function SettingsAuditView() {
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
    { key: 'deskripsi', header: 'Deskripsi', render: (r) => <span className="text-slate-500 text-xs line-clamp-1 max-w-[300px] inline-block">{r.deskripsi}</span> },
    { key: 'ip', header: 'IP Address', render: (r) => <span className="font-mono text-xs text-slate-500">{r.ip || '-'}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Sistem"
        description="Jejak audit seluruh aktivitas yang terjadi pada sistem"
      >
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-9">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </PageHeader>

      <Card className="border-slate-200 shadow-sm bg-slate-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <ScrollText className="w-5 h-5 text-[#0F4C81] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 leading-relaxed">
            <p className="font-medium text-slate-700 mb-0.5">Tentang Audit Log</p>
            Setiap operasi <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">CREATE / UPDATE / DELETE</code> serta
            aktivitas <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">LOGIN / LOGOUT / BACKUP</code> tercatat
            otomatis beserta timestamp, username, alamat IP, dan deskripsi. Data diurutkan dari terbaru.
          </div>
        </CardContent>
      </Card>

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari username / deskripsi aktivitas..."
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
