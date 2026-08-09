'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuthStore, useNavStore } from '@/store/auth-store'
import { PageHeader } from '@/components/shared/data-table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Save, User, ShieldCheck, Eye, EyeOff, CalendarDays, Mail, Phone, MapPin, Building2, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react'
import { formatDateTime } from '@/components/shared/ui-helpers'

// ===========================================================================
// ROOT
// ===========================================================================

export function UserAccountView() {
  const { activeView } = useNavStore()
  if (activeView === 'account-keamanan') return <AccountKeamananView />
  return <AccountProfilView />
}

// ===========================================================================
// PROFIL SAYA
// ===========================================================================

function AccountProfilView() {
  const { toast } = useToast()
  const { user, setUser } = useAuthStore()
  const [form, setForm] = useState({
    nama: '',
    email: '',
    noTelp: '',
    tempatLahir: '',
    tanggalLahir: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await api.getProfile()
        if (!cancelled) {
          const u = res.user
          setForm({
            nama: u.nama || '',
            email: u.email || '',
            noTelp: u.noTelp || '',
            tempatLahir: u.tempatLahir || '',
            tanggalLahir: u.tanggalLahir ? u.tanggalLahir.slice(0, 10) : '',
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

  const handleSave = async () => {
    if (!form.nama || form.nama.trim().length < 2) {
      toast({ title: 'Validasi', description: 'Nama minimal 2 karakter', variant: 'destructive' })
      return
    }
    if (!form.email || !form.email.includes('@')) {
      toast({ title: 'Validasi', description: 'Email tidak valid', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await api.updateProfile(form)
      // Update auth store
      if (user) {
        setUser({ ...user, nama: res.user.nama, email: res.user.email, noTelp: res.user.noTelp, tempatLahir: res.user.tempatLahir, tanggalLahir: res.user.tanggalLahir })
      }
      toast({ title: 'Berhasil', description: 'Profil berhasil diperbarui' })
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const initials = user?.nama?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() || 'U'

  const formatTglLahir = (tgl: string) => {
    if (!tgl) return '-'
    const d = new Date(tgl)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Profil Saya" description="Kelola informasi pribadi akun Anda" />

      {/* Info Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-[#0F4C81]" /> Informasi Akun
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center gap-5 animate-pulse">
              <div className="w-20 h-20 rounded-2xl bg-slate-100" />
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-slate-100 rounded w-48" />
                <div className="h-4 bg-slate-100 rounded w-32" />
                <div className="h-3 bg-slate-100 rounded w-24" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-[#0F4C81] text-white flex items-center justify-center text-2xl font-bold shadow-md">
                {initials}
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">{user?.nama}</h3>
                <p className="text-sm text-slate-500">@{user?.username}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#0F4C81]/10 text-[#0F4C81] border border-[#0F4C81]/20">
                    {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : user?.role === 'ADMIN_BIDANG' ? 'Admin Bidang' : 'Operator'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-[#195737] border border-[#86EFAC]">
                    <CheckCircle2 className="w-3 h-3" /> Aktif
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0F4C81]" /> Data Pribadi
          </CardTitle>
          <CardDescription className="text-xs">Perbarui informasi pribadi akun Anda</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-28 animate-pulse" />
                  <div className="h-9 bg-slate-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nama Lengkap <span className="text-red-500">*</span></Label>
                  <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Masukkan nama lengkap" />
                </div>
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input value={user?.username || ''} disabled className="bg-slate-50 text-slate-500" />
                  <p className="text-xs text-slate-400">Username tidak dapat diubah</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Email <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input className="pl-9" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@contoh.com" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Nomor HP</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input className="pl-9" type="tel" value={form.noTelp} onChange={(e) => setForm({ ...form, noTelp: e.target.value })} placeholder="08xxxxxxxxxx" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Tempat Lahir</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input className="pl-9" value={form.tempatLahir} onChange={(e) => setForm({ ...form, tempatLahir: e.target.value })} placeholder="Contoh: Banda Aceh" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Tanggal Lahir</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input className="pl-9" type="date" value={form.tanggalLahir} onChange={(e) => setForm({ ...form, tanggalLahir: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Info ringkasan */}
              {form.tanggalLahir && form.tempatLahir && (
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">TTL:</span> {form.tempatLahir}, {formatTglLahir(form.tanggalLahir)}
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-5 mt-5 border-t border-slate-100">
                <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63] h-10">
                  <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Profil'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Login Info */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#0F4C81]" /> Informasi Login
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Terakhir Login</p>
              <p className="font-medium text-slate-900">{user?.lastLogin ? formatDateTime(user.lastLogin) : '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Akun Dibuat</p>
              <p className="font-medium text-slate-900">{user?.createdAt ? formatDateTime(user.createdAt) : '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// KEAMANAN (GANTI PASSWORD)
// ===========================================================================

function AccountKeamananView() {
  const { toast } = useToast()
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [saving, setSaving] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleChangePassword = async () => {
    if (!form.currentPassword) {
      toast({ title: 'Validasi', description: 'Password lama wajib diisi', variant: 'destructive' })
      return
    }
    if (form.newPassword.length < 6) {
      toast({ title: 'Validasi', description: 'Password baru minimal 6 karakter', variant: 'destructive' })
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      toast({ title: 'Validasi', description: 'Konfirmasi password tidak cocok', variant: 'destructive' })
      return
    }
    if (form.currentPassword === form.newPassword) {
      toast({ title: 'Validasi', description: 'Password baru harus berbeda dari password lama', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await api.changePassword(form.currentPassword, form.newPassword)
      toast({ title: 'Berhasil', description: 'Password berhasil diubah' })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const strength = (() => {
    const p = form.newPassword
    if (!p) return { label: '', color: '', pct: 0 }
    let score = 0
    if (p.length >= 6) score++
    if (p.length >= 8) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    if (score <= 2) return { label: 'Lemah', color: 'bg-red-500', pct: 33 }
    if (score <= 3) return { label: 'Sedang', color: 'bg-amber-500', pct: 66 }
    return { label: 'Kuat', color: 'bg-[#195737]', pct: 100 }
  })()

  return (
    <div className="space-y-4">
      <PageHeader title="Keamanan Akun" description="Kelola keamanan dan kata sandi akun Anda" />

      {/* Password Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0F4C81]" /> Ubah Password
          </CardTitle>
          <CardDescription className="text-xs">Pastikan password baru Anda kuat dan tidak mudah ditebak</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Setelah mengubah password, sesi login Anda tetap aktif. Logout dan login ulang untuk memastikan perubahan berlaku.
            </p>
          </div>

          {/* Current Password */}
          <div className="space-y-1.5">
            <Label>Password Saat Ini <span className="text-red-500">*</span></Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9 pr-10"
                type={showCurrent ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                placeholder="Masukkan password saat ini"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowCurrent(!showCurrent)}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <Label>Password Baru <span className="text-red-500">*</span></Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9 pr-10"
                type={showNew ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                placeholder="Masukkan password baru (min. 6 karakter)"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowNew(!showNew)}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.newPassword && (
              <div className="space-y-1.5 mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: `${strength.pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-slate-600">{strength.label}</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label>Konfirmasi Password Baru <span className="text-red-500">*</span></Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9 pr-10"
                type={showConfirm ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Ulangi password baru"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.confirmPassword && form.newPassword !== form.confirmPassword && (
              <p className="text-xs text-red-600 mt-1">Password tidak cocok</p>
            )}
            {form.confirmPassword && form.newPassword === form.confirmPassword && form.confirmPassword.length > 0 && (
              <p className="text-xs text-[#195737] mt-1">Password cocok</p>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button onClick={handleChangePassword} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63] h-10">
              <ShieldCheck className="w-4 h-4" /> {saving ? 'Mengubah...' : 'Ubah Password'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#15803D]" /> Tips Keamanan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              'Gunakan minimal 6 karakter',
              'Kombinasikan huruf besar & kecil',
              'Tambahkan angka dan simbol',
              'Jangan gunakan password yang sama di layanan lain',
            ].map((tip) => (
              <div key={tip} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-[#195737] flex-shrink-0 mt-0.5" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
