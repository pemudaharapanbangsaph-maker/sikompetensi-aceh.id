'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Lock, User, Loader2, AlertCircle, ArrowRight, BookOpen, Shield, ArrowLeft, Clock, GraduationCap, Building2, Calendar, LogIn, Search, FileText, Upload as UploadIcon, ClipboardList, CheckCircle2, Smartphone, KeyRound, Printer, FileCheck2, XCircle, Hourglass, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogoPancaCita } from '@/components/shared/logo-pancacita'

type ViewMode = 'landing' | 'login' | 'programs' | 'pendaftaran' | 'cek-status'

interface Program {
  id: string
  nama: string
  kategori: string
  jp: number
  metode: string
  prioritas: string
  tahun: number
  targetOutput: string
  outcome: string
  programPrioritasRPJMA: string
}

const KATEGORI_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  TEKNIS: { label: 'Teknis', color: 'text-[#195737]', bg: 'bg-[#195737]/10' },
  MANAJERIAL: { label: 'Manajerial', color: 'text-amber-700', bg: 'bg-amber-50' },
  FUNGSIONAL: { label: 'Fungsional', color: 'text-blue-700', bg: 'bg-blue-50' },
  SOSIAL_KULTURAL: { label: 'Sosial Kultural', color: 'text-purple-700', bg: 'bg-purple-50' },
}

const METODE_LABEL: Record<string, string> = {
  TATAP_MUKA: 'Tatap Muka',
  DARING: 'Daring',
  BLENDED: 'Blended Learning',
}

const METODE_COLORS: Record<string, string> = {
  TATAP_MUKA: 'bg-blue-50 text-blue-700',
  DARING: 'bg-green-50 text-[#195737]',
  BLENDED: 'bg-purple-50 text-purple-700',
}

const PRIORITAS_LABEL: Record<string, string> = {
  TINGGI: 'Tinggi',
  SEDANG: 'Sedang',
  RENDAH: 'Rendah',
}

const PRIORITAS_COLORS: Record<string, string> = {
  TINGGI: 'bg-orange-50 text-orange-700 border-orange-200/60',
  SEDANG: 'bg-slate-50 text-slate-600 border-slate-200/60',
  RENDAH: 'bg-slate-50 text-slate-500 border-slate-200/60',
}

export function LoginPage() {
  const { login, loading, setUser } = useAuthStore()
  const rememberedUser = typeof window !== 'undefined' ? localStorage.getItem('bpsdm_remembered_user') : null
  const [view, setView] = useState<ViewMode>('landing')
  const [username, setUsername] = useState(rememberedUser || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(!!rememberedUser)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  // 2FA state
  const [pending2FA, setPending2FA] = useState<{ tempToken: string; email: string } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [twoFALoading, setTwoFALoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!username.trim() || !password.trim()) {
      setError('Username dan password wajib diisi')
      return
    }
    try {
      if (remember) {
        localStorage.setItem('bpsdm_remembered_user', username)
      } else {
        localStorage.removeItem('bpsdm_remembered_user')
      }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username: username.trim(), password, remember }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login gagal')
        return
      }
      if (data.requires2FA) {
        setPending2FA({ tempToken: data.tempToken, email: data.email })
        return
      }
      if (data.token) {
        const maxAge = remember ? 7 * 24 * 60 * 60 : 30 * 60
        document.cookie = `bpsdm_session=${encodeURIComponent(data.token)}; path=/; max-age=${maxAge}; SameSite=Lax`
      }
      setUser(data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal')
    }
  }

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!pending2FA || totpCode.length !== 6) {
      setError('Masukkan kode 6 digit dari Google Authenticator')
      return
    }
    setTwoFALoading(true)
    try {
      const res = await fetch('/api/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ tempToken: pending2FA.tempToken, code: totpCode, remember }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Verifikasi kode gagal')
        return
      }
      if (data.token) {
        const maxAge = remember ? 7 * 24 * 60 * 60 : 30 * 60
        document.cookie = `bpsdm_session=${encodeURIComponent(data.token)}; path=/; max-age=${maxAge}; SameSite=Lax`
      }
      setPending2FA(null)
      setTotpCode('')
      setUser(data.user)
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setTwoFALoading(false)
    }
  }

  const cancel2FA = () => { setPending2FA(null); setTotpCode(''); setError(''); setPassword('') }
  const goBack = () => { setView('landing'); setError(''); setInfo(''); setPending2FA(null); setTotpCode('') }

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFEF9] w-full overflow-x-hidden">
      {view === 'programs' ? (
        <AnimatePresence mode="wait">
          <ProgramsRight onBack={goBack} onLogin={() => setView('login')} />
        </AnimatePresence>
      ) : view === 'pendaftaran' ? (
        <AnimatePresence mode="wait">
          <PendaftaranRight onBack={goBack} />
        </AnimatePresence>
      ) : view === 'cek-status' ? (
        <AnimatePresence mode="wait">
          <CekStatusRight onBack={goBack} onDaftar={() => setView('pendaftaran')} />
        </AnimatePresence>
      ) : (
        /* ===== SPLIT SCREEN: LANDING / LOGIN ===== */
        <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
          {/* ===== LEFT PANEL (Green Branding) ===== */}
          <div className="login-bg relative z-10 overflow-hidden lg:w-[42%] xl:w-[45%] flex flex-col justify-center">
            <div className="login-bg-pattern absolute inset-0 z-0" />
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 sm:py-12 text-center">
              <LogoPancaCita size={80} className="sm:w-[100px] sm:h-[100px] drop-shadow-2xl" />
              <p className="text-white/80 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-3">Pemerintah Aceh</p>
              <div className="mt-3 sm:mt-5">
                <p className="text-white text-xl sm:text-3xl font-extrabold tracking-wide">SIKOMPETENSI ACEH</p>
                <p className="text-[10px] sm:text-xs tracking-[0.25em] sm:tracking-[0.35em] text-[#86EFAC]/80 mt-1 font-medium">CORPORATE UNIVERSITY</p>
              </div>
              <div className="flex items-center justify-center mt-4 mb-4">
                <div className="h-[1px] w-8 sm:w-12 bg-gradient-to-r from-transparent to-amber-400/60" />
                <div className="h-[2px] w-14 sm:w-20 bg-gradient-to-r from-amber-500/80 via-amber-400 to-amber-500/80" />
                <div className="h-[1px] w-8 sm:w-12 bg-gradient-to-l from-transparent to-amber-400/60" />
              </div>
              <h2 className="text-white text-base sm:text-xl font-bold leading-relaxed max-w-sm mx-auto">
                Mewujudkan ASN Aceh yang Kompeten, Profesional, dan Berintegritas.
              </h2>
              <p className="text-white/60 text-xs mt-2.5 max-w-xs mx-auto leading-relaxed hidden xs:block">
                Satu pintu untuk pengembangan kompetensi, pelatihan, dan sertifikasi ASN Pemerintah Aceh.
              </p>
            </div>
            <AnimatePresence>
              {view === 'login' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 px-4 sm:px-6 pb-6">
                  <div className="bg-white/[0.06] rounded-lg p-3">
                    <p className="text-[10px] text-white/60 leading-relaxed text-center">
                      Sistem internal Pemerintah Aceh untuk aparatur sipil negara. Access restricted. Butuh bantuan? Hubungi{' '}
                      <span className="font-semibold text-white/90">BPSDM Aceh</span>.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-0 hidden lg:block">
              <BookOpen className="w-14 h-14 text-white/[0.04]" />
            </div>
          </div>

          {/* ===== RIGHT PANEL ===== */}
          <AnimatePresence mode="wait">
            {view === 'landing' && (
              <LandingRight onEnter={() => setView('login')} onPrograms={() => setView('programs')} onPendaftaran={() => setView('pendaftaran')} onCekStatus={() => setView('cek-status')} />
            )}
            {view === 'login' && !pending2FA && (
              <LoginRight
                username={username} setUsername={setUsername}
                password={password} setPassword={setPassword}
                showPassword={showPassword} setShowPassword={setShowPassword}
                remember={remember} setRemember={setRemember}
                error={error} setError={setError}
                info={info} setInfo={setInfo}
                loading={loading} onSubmit={handleSubmit}
                onBack={goBack}
              />
            )}
            {view === 'login' && pending2FA && (
              <TwoFARight
                email={pending2FA.email}
                totpCode={totpCode} setTotpCode={setTotpCode}
                error={error} setError={setError}
                loading={twoFALoading}
                onSubmit={handle2FAVerify}
                onCancel={cancel2FA}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ==========================================================================
// RIGHT PANEL: LANDING
// ==========================================================================

function LandingRight({ onEnter, onPrograms, onPendaftaran, onCekStatus }: { onEnter: () => void; onPrograms: () => void; onPendaftaran: () => void; onCekStatus: () => void }) {
  return (
    <motion.div
      key="landing-right"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex-1 relative flex items-center justify-center px-4 sm:px-10 lg:px-16 py-8 sm:py-12 bg-[#FFFEF9] overflow-hidden"
    >
      <div className="relative z-10 max-w-xl w-full">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <div className="w-4 h-px bg-[#195737]/40" />
          <span className="text-xs font-semibold text-[#195737] uppercase tracking-wider">Layanan Publik & Internal</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-[1.2]">
          Mewujudkan ASN Aceh{' '}
          <span className="text-slate-900">yang Kompeten, Profesional &</span>
          <br />
          <span className="text-[#195737]">Berintegritas.</span>
        </h1>
        <p className="text-slate-600 text-xs sm:text-base mt-4 sm:mt-6 leading-relaxed max-w-lg">
          Sikompetensi Aceh mengintegrasikan pembelajaran formal, sosial, dan 
          berbasis pengalaman dalam satu ekosistem pengembangan kompetensi ASN.
        </p>

        {/* Clean Responsive Buttons Stack */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
          <button
            onClick={onEnter}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#195737] hover:bg-[#0F4227] text-white font-semibold text-sm rounded-xl transition-all shadow-sm active:scale-[0.99]"
          >
            <LogIn className="w-4 h-4" />
            Masuk Portal
          </button>

          <button
            onClick={onPrograms}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 border border-slate-300 hover:border-[#195737]/40 hover:text-[#195737] text-slate-700 font-medium text-sm rounded-xl transition-all active:scale-[0.99]"
          >
            <Search className="w-4 h-4" />
            Jelajahi Program
          </button>

          <button
            onClick={onPendaftaran}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 border-2 border-[#195737]/30 hover:bg-[#195737] hover:text-white hover:border-[#195737] text-[#195737] font-bold text-sm rounded-xl transition-all shadow-sm active:scale-[0.99]"
          >
            <ClipboardList className="w-5 h-5" />
            Pendaftaran Pelatihan
          </button>

          <button
            onClick={onCekStatus}
            className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 border-2 border-[#0F4C81]/30 hover:bg-[#0F4C81] hover:text-white hover:border-[#0F4C81] text-[#0F4C81] font-bold text-sm rounded-xl transition-all shadow-sm active:scale-[0.99]"
          >
            <FileCheck2 className="w-5 h-5" />
            Cek Status Pendaftaran
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ==========================================================================
// RIGHT PANEL: PROGRAMS CATALOG
// ==========================================================================

function ProgramsRight({ onBack, onLogin }: { onBack: () => void; onLogin: () => void }) {
  const [programs, setPrograms] = useState<Program[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('SEMUA')

  useEffect(() => {
    fetch('/api/programs/public')
      .then((r) => r.json())
      .then((d) => { setPrograms(d.programs || []); setTotal(d.total || 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'SEMUA' ? programs : programs.filter((p) => p.kategori === filter)
  const categories = ['SEMUA', 'TEKNIS', 'MANAJERIAL', 'FUNGSIONAL', 'SOSIAL_KULTURAL']

  return (
    <motion.div
      key="programs-right"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen flex flex-col bg-[#FFFEF9]"
    >
      {/* Header */}
      <div className="px-4 sm:px-10 pt-4 sm:pt-6 pb-4 border-b border-slate-200/60 bg-white sticky top-0 z-20">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-3xl font-bold text-slate-900">Program Diklat</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Katalog program diklat BPSDM Aceh — <span className="font-semibold text-[#195737]">{total} program</span> tersedia.
            </p>
          </div>
          <button
            onClick={onLogin}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#195737] hover:bg-[#0F4227] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Masuk Portal
          </button>
        </div>
      </div>

      {/* Filter tabs - Horizontal Scroll */}
      <div className="px-4 sm:px-10 py-3 border-b border-slate-100 overflow-x-auto scrollbar-none bg-slate-50/50">
        <div className="flex gap-2 min-w-max">
          {categories.map((cat) => {
            const isAll = cat === 'SEMUA'
            const catInfo = KATEGORI_LABEL[cat]
            const isActive = filter === cat
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#195737] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {isAll ? 'Semua' : catInfo?.label || cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Program cards */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-4 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#195737]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <GraduationCap className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-600 font-semibold text-sm">Belum ada program</p>
            <p className="text-slate-400 text-xs mt-1 max-w-xs">Program diklat akan muncul setelah diinputkan oleh admin.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {filtered.map((p, i) => {
              const catInfo = KATEGORI_LABEL[p.kategori]
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 hover:border-[#195737]/30 hover:shadow-sm transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {catInfo && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${catInfo.color} ${catInfo.bg}`}>
                            {catInfo.label}
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${METODE_COLORS[p.metode] || 'bg-slate-100 text-slate-600'} border-transparent`}>
                          {METODE_LABEL[p.metode] || p.metode}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITAS_COLORS[p.prioritas] || 'bg-slate-50 text-slate-500'}`}>
                          {PRIORITAS_LABEL[p.prioritas] || p.prioritas}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{p.nama}</h3>
                      {p.targetOutput && (
                        <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{p.targetOutput}</p>
                      )}
                    </div>
                    <div className="flex items-center sm:flex-col sm:items-end gap-3 sm:gap-1 text-xs text-slate-500 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-semibold text-slate-700">{p.jp} JP</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{p.tahun}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <div className="px-4 sm:px-10 py-3 border-t border-slate-200/60 bg-white">
        <p className="text-center text-[11px] text-slate-400">© {new Date().getFullYear()} BPSDM Provinsi Aceh</p>
      </div>
    </motion.div>
  )
}

// ==========================================================================
// RIGHT PANEL: LOGIN FORM
// ==========================================================================

function LoginRight({
  username, setUsername, password, setPassword,
  showPassword, setShowPassword, remember, setRemember,
  error, setError, info, setInfo, loading, onSubmit, onBack,
}: LoginRightProps) {
  return (
    <motion.div
      key="login-right"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex items-center justify-center p-4 sm:p-10 bg-[#F5F5F7]"
    >
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6 sm:mb-8">
          <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium mb-3">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </button>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Masuk</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Gunakan akun ASN Anda untuk melanjutkan.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 sm:space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs sm:text-sm font-semibold text-slate-700">Username atau Email</Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
              <Input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Masukkan username/email" className="pl-11 h-11 sm:h-12 bg-white border-slate-300 rounded-lg text-sm" autoComplete="username" disabled={loading} />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs sm:text-sm font-semibold text-slate-700">Password</Label>
              <button type="button" className="text-xs text-[#195737] hover:underline font-medium" onClick={() => setInfo('Hubungi Super Admin untuk reset password.')}>Lupa password?</button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
              <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" className="pl-11 pr-11 h-11 sm:h-12 bg-white border-slate-300 rounded-lg text-sm" autoComplete="current-password" disabled={loading} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#195737] cursor-pointer" />
            <Label htmlFor="remember" className="text-xs sm:text-sm text-slate-600 cursor-pointer">Ingat aku (7 hari)</Label>
          </div>
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
            </div>
          )}
          {info && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-[#86EFAC] text-[#195737] text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{info}</span>
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full h-11 sm:h-12 bg-[#195737] hover:bg-[#0F4227] text-white font-semibold text-sm sm:text-base rounded-lg shadow-sm">
            {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</>) : 'Masuk'}
          </Button>
          <p className="text-center text-xs text-slate-500 pt-2">
            Belum punya akun?{' '}
            <button type="button" onClick={() => setInfo('Aktivasi akun ASN dilakukan oleh Admin Bidang. Hubungi BPSDM Aceh.')} className="text-[#195737] font-semibold hover:underline">Aktivasi Akun ASN</button>
          </p>
        </form>
      </div>
    </motion.div>
  )
}

// ==========================================================================
// RIGHT PANEL: 2FA VERIFICATION
// ==========================================================================

function TwoFARight({ email, totpCode, setTotpCode, error, setError, loading, onSubmit, onCancel }: TwoFARightProps) {
  return (
    <motion.div
      key="twofa-right"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex items-center justify-center p-4 sm:p-10 bg-[#F5F5F7]"
    >
      <div className="w-full max-w-md mx-auto">
        <div className="mb-6">
          <button type="button" onClick={onCancel} className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium mb-4">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Verifikasi 2FA</h2>
              <p className="text-xs text-slate-500">Langkah keamanan tambahan</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
            <p className="text-xs text-blue-700">Masukkan kode 6 digit dari Google Authenticator untuk akun <strong>{email}</strong></p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="totp" className="text-xs sm:text-sm font-semibold text-slate-700">Kode Autentikasi</Label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
              <Input
                id="totp"
                type="text"
                inputMode="numeric"
                value={totpCode}
                onChange={(e) => {
                  setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  setError('')
                }}
                placeholder="000000"
                maxLength={6}
                className="pl-11 pr-4 h-12 bg-white border-slate-300 text-xl font-bold text-center tracking-[0.4em]"
                disabled={loading}
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button type="submit" disabled={totpCode.length !== 6 || loading} className="w-full h-11 bg-[#195737] hover:bg-[#0F4227] text-white font-semibold text-sm rounded-lg">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verifikasi & Masuk'}
          </Button>
        </form>
      </div>
    </motion.div>
  )
}

// ==========================================================================
// FULL-SCREEN: FORM PENDAFTARAN PELATIHAN
// ==========================================================================

const DOKUMEN_WAJIB = [
  { tipe: 'KTP', label: 'KTP', desc: 'Kartu Tanda Penduduk' },
  { tipe: 'NPWP', label: 'NPWP', desc: 'Kartu Nomor Pokok Wajib Pajak' },
  { tipe: 'REK_BANK', label: 'REK Bank Aceh', desc: 'Bukti rekening Bank Aceh' },
]

const DOKUMEN_OPSIONAL = [
  { tipe: 'SURAT_TUGAS', label: 'Surat Tugas', desc: 'Surat tugas dari instansi (opsional)' },
]

const ALL_DOKUMEN = [...DOKUMEN_WAJIB, ...DOKUMEN_OPSIONAL]

interface PelatihanOption { id: string; nama: string; kode: string; kategori?: string; jp?: number; metode?: string; prioritas?: string; tahun?: number }

function PendaftaranRight({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false)
  const [pelatihanList, setPelatihanList] = useState<PelatihanOption[]>([])
  const [form, setForm] = useState({
    nama: '', nip: '', jenisKelamin: '', pangkatGolongan: '', tempatLahir: '', tanggalLahir: '',
    jabatan: '', unitKerja: '', instansi: '', nomorHP: '', email: '', nomorRekening: '', npwp: '', pelatihanId: '',
  })
  const [files, setFiles] = useState<Record<string, File>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ nama: string; id?: string } | null>(null)
  const [step, setStep] = useState<'form' | 'uploading' | 'done'>('form')
  const [uploadProgress, setUploadProgress] = useState('')

  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    fetch('/api/portal/pelatihan-list').then((r) => r.json()).then(setPelatihanList).catch(() => {})
  }, [])

  const handleChange = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleBlur = (k: string) => () => setTouched((p) => ({ ...p, [k]: true }))

  const fieldErrors: Record<string, string> = {}
  const showErr = (k: string) => touched[k] || attempted

  const requiredFields: Record<string, string> = {
    nama: 'Nama lengkap wajib diisi',
    jenisKelamin: 'Jenis Kelamin wajib dipilih',
    pangkatGolongan: 'Pangkat/Golongan wajib diisi',
    tempatLahir: 'Tempat lahir wajib diisi',
    tanggalLahir: 'Tanggal lahir wajib diisi',
    jabatan: 'Jabatan wajib diisi',
    unitKerja: 'Unit kerja wajib diisi',
    instansi: 'Instansi wajib diisi',
    nomorHP: 'No. HP wajib diisi',
    email: 'Email wajib diisi',
    nomorRekening: 'Nomor rekening wajib diisi',
    npwp: 'NPWP wajib diisi',
    pelatihanId: 'Pilih pelatihan yang diikuti',
  }

  for (const [k, msg] of Object.entries(requiredFields)) {
    if (showErr(k) && !form[k as keyof typeof form].trim()) fieldErrors[k] = msg
  }

  if (showErr('nip')) {
    if (!form.nip.trim()) fieldErrors.nip = 'NIP wajib diisi'
    else if (!/^\d+$/.test(form.nip.trim())) fieldErrors.nip = 'NIP hanya boleh berisi angka'
    else if (form.nip.trim().length !== 18) fieldErrors.nip = `NIP harus 18 digit (saat ini ${form.nip.trim().length} digit)`
  }

  const errorCount = Object.keys(fieldErrors).length
  const docsMissing = DOKUMEN_WAJIB.filter((d) => !files[d.tipe]).length

  const formComplete = Object.keys(requiredFields).every((k) => form[k as keyof typeof form].trim() !== '') && /^\d{18}$/.test(form.nip.trim())
  const docsComplete = DOKUMEN_WAJIB.every((d) => files[d.tipe])
  const canSubmit = formComplete && docsComplete

  const handleFileSelect = (tipe: string, file: File | undefined) => {
    if (file && file.type !== 'application/pdf') { setError('Hanya file PDF yang diperbolehkan'); return }
    if (file && file.size > 5 * 1024 * 1024) { setError('Ukuran file maksimal 5MB'); return }
    setFiles((p) => { const n = { ...p }; if (file) n[tipe] = file; else delete n[tipe]; return n })
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (!canSubmit) return
    setError(''); setLoading(true); setStep('uploading')
    try {
      setUploadProgress('Mengirim data pendaftaran...')
      const res = await fetch('/api/portal/pendaftaran', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) {
        if (data.alreadyRegistered) setError(`NIP sudah terdaftar atas nama "${data.nama}" (Status: ${data.status}).`)
        else setError(data.error || 'Gagal mendaftar')
        setStep('form'); setLoading(false); return
      }
      const regId = data.id
      const uploadToken = data.uploadToken
      const docsToUpload = ALL_DOKUMEN.filter((d) => files[d.tipe])
      for (let i = 0; i < docsToUpload.length; i++) {
        const d = docsToUpload[i]; const file = files[d.tipe]; if (!file) continue
        setUploadProgress(`Mengupload ${d.label}... (${i + 1}/${docsToUpload.length})`)
        const fd = new FormData(); fd.append('pendaftaranId', regId); fd.append('tipe', d.tipe); fd.append('file', file); fd.append('uploadToken', uploadToken)
        const ures = await fetch('/api/portal/pendaftaran/upload-dokumen', { method: 'POST', body: fd })
        if (!ures.ok) { const udata = await ures.json().catch(() => ({})); setError(`Gagal upload ${d.label}: ${udata.error || 'error'}`); setStep('form'); setLoading(false); return }
      }
      setStep('done'); setSuccess({ nama: data.nama, id: regId })
    } catch { setError('Terjadi kesalahan jaringan'); setStep('form') } finally { setLoading(false) }
  }

  const req = <span className="text-red-500 font-bold">*</span>

  const renderField = (k: string, label: string, opts?: { type?: string; placeholder?: string; maxLength?: number; colSpan?: boolean }) => {
    const err = showErr(k) && fieldErrors[k]
    return (
      <div className={`space-y-1.5 ${opts?.colSpan ? 'sm:col-span-2' : ''}`}>
        <Label className={`text-xs font-semibold ${err ? 'text-red-600' : 'text-slate-600'}`}>{label} {req}</Label>
        <Input
          type={opts?.type || 'text'}
          value={form[k as keyof typeof form]}
          onChange={handleChange(k)}
          onBlur={handleBlur(k)}
          placeholder={opts?.placeholder}
          maxLength={opts?.maxLength}
          className={`h-10 sm:h-11 bg-white text-sm ${err ? 'border-red-400 focus:border-red-500' : 'border-slate-300'}`}
        />
        {err && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {fieldErrors[k]}</p>}
      </div>
    )
  }

  return (
    <motion.div key="pendaftaran-right" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="min-h-screen flex flex-col bg-[#FFFEF9]">
      <div className="px-4 sm:px-10 pt-4 sm:pt-6 pb-4 border-b border-slate-200/60 bg-white sticky top-0 z-20">
        <button type="button" onClick={onBack} disabled={loading} className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium mb-3"><ArrowLeft className="w-4 h-4" /> Kembali</button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#195737]/10 flex items-center justify-center flex-shrink-0"><ClipboardList className="w-5 h-5 text-[#195737]" /></div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Form Pendaftaran Pelatihan</h2>
            <p className="text-xs sm:text-sm text-slate-500">Lengkapi data dan upload dokumen PDF yang diperlukan</p>
          </div>
        </div>
      </div>

      {success ? (
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-green-600" /></div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">Pendaftaran Berhasil! 🎉</h3>
            <p className="text-xs sm:text-sm text-slate-600">Terima kasih <strong>{success.nama}</strong>, pendaftaran Anda telah tersimpan.</p>
            <div className="flex flex-col gap-2 pt-2">
              {success.id && (
                <a href={`/api/portal/pendaftaran/${success.id}/cetak-bukti`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#0F4C81] text-white font-bold text-sm rounded-xl">
                  <Printer className="w-4 h-4" /> Cetak Bukti Pendaftaran
                </a>
              )}
              <button onClick={onBack} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#195737] text-white font-bold text-sm rounded-xl"><ArrowLeft className="w-4 h-4" /> Kembali ke Beranda</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 sm:p-10">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-5" noValidate>
            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

            {/* Section 1 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-3.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2"><User className="w-4 h-4 text-[#195737]" /> Data Pribadi</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {renderField('nama', 'Nama Lengkap', { placeholder: 'Nama beserta gelar' })}
                {renderField('nip', 'NIP', { placeholder: '18 digit NIP', maxLength: 18 })}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Jenis Kelamin {req}</Label>
                  <select value={form.jenisKelamin} onChange={handleChange('jenisKelamin')} className="w-full h-10 sm:h-11 bg-white border border-slate-300 rounded-lg text-sm px-3">
                    <option value="">-- Pilih --</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                {renderField('pangkatGolongan', 'Pangkat/Golongan', { placeholder: 'III/c' })}
                {renderField('tempatLahir', 'Tempat Lahir', { placeholder: 'Kota/Kab' })}
                {renderField('tanggalLahir', 'Tanggal Lahir', { type: 'date' })}
                {renderField('jabatan', 'Jabatan', { placeholder: 'Jabatan saat ini' })}
              </div>
            </div>

            {/* Section 2 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-3.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2"><Building2 className="w-4 h-4 text-[#195737]" /> Instansi & Kontak</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {renderField('unitKerja', 'Unit Kerja', { placeholder: 'Nama unit kerja/OPD' })}
                {renderField('instansi', 'Instansi', { placeholder: 'Nama instansi/pemerintah', colSpan: true })}
                {renderField('nomorHP', 'No. HP', { placeholder: '08xxxxxxxxxx' })}
                {renderField('npwp', 'NPWP', { placeholder: 'Nomor NPWP' })}
                {renderField('email', 'Email', { type: 'email', placeholder: 'nama@email.com', colSpan: true })}
                {renderField('nomorRekening', 'Nomor REK Bank Aceh', { placeholder: 'Nomor rekening Bank Aceh', colSpan: true })}
              </div>
            </div>

            {/* Section 3 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-3.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-[#195737]" /> Pilih Pelatihan</h3>
              <div className="space-y-1.5">
                <select value={form.pelatihanId} onChange={handleChange('pelatihanId')} className="w-full h-10 sm:h-11 bg-white border border-slate-300 rounded-lg text-sm px-3">
                  <option value="">-- Pilih Pelatihan --</option>
                  {pelatihanList.map((p) => (
                    <option key={p.id} value={p.id}>{p.nama}{p.jp ? ` (${p.jp} JP)` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 4: Dokumen */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-3.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2"><UploadIcon className="w-4 h-4 text-[#195737]" /> Upload Dokumen (PDF)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DOKUMEN_WAJIB.map((d) => {
                  const hasFile = !!files[d.tipe]
                  return (
                    <div key={d.tipe} className={`rounded-xl border p-3.5 space-y-2 ${hasFile ? 'border-green-300 bg-green-50/50' : 'border-amber-200 bg-amber-50/30'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{d.label} {req}</span>
                        {hasFile && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      </div>
                      <label className="flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-dashed border-[#195737]/40 text-xs font-medium cursor-pointer bg-white">
                        <UploadIcon className="w-3.5 h-3.5 text-[#195737]" />
                        <span className="truncate max-w-[140px]">{hasFile ? files[d.tipe].name : 'Pilih PDF'}</span>
                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => handleFileSelect(d.tipe, e.target.files?.[0])} />
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pt-2 pb-6">
              <button type="submit" disabled={loading} className={`w-full flex items-center justify-center gap-2 py-3.5 sm:py-4 text-base sm:text-lg font-bold rounded-xl shadow-md transition-all ${canSubmit && !loading ? 'bg-[#195737] hover:bg-[#0F4227] text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                DAFTAR SEKARANG
              </button>
            </div>
          </form>
        </div>
      )}
    </motion.div>
  )
}

// ==========================================================================
// FULL-SCREEN: CEK STATUS PENDAFTARAN
// ==========================================================================

function CekStatusRight({ onBack, onDaftar }: { onBack: () => void; onDaftar: () => void }) {
  const [nip, setNip] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  const handleCek = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)
    const nipVal = nip.trim()
    if (!nipVal || !/^\d{18}$/.test(nipVal)) { setError('Format NIP harus 18 digit angka'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/portal/pendaftaran?nip=${encodeURIComponent(nipVal)}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Gagal mengecek status'); return }
      setResult(data)
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div key="cek-status-right" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="min-h-screen flex flex-col bg-[#FFFEF9]">
      <div className="px-4 sm:px-10 pt-4 sm:pt-6 pb-4 border-b border-slate-200/60 bg-white sticky top-0 z-20">
        <button type="button" onClick={onBack} disabled={loading} className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium mb-3"><ArrowLeft className="w-4 h-4" /> Kembali</button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0F4C81]/10 flex items-center justify-center flex-shrink-0"><FileCheck2 className="w-5 h-5 text-[#0F4C81]" /></div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Cek Status Pendaftaran</h2>
            <p className="text-xs sm:text-sm text-slate-500">Masukkan NIP Anda untuk melihat hasil verifikasi</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-10">
        <div className="max-w-2xl mx-auto space-y-5">
          <form onSubmit={handleCek} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Nomor Induk Pegawai (NIP)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={nip}
                  onChange={(e) => { setNip(e.target.value.replace(/\D/g, '').slice(0, 18)); setError(''); setResult(null) }}
                  placeholder="18 digit NIP"
                  maxLength={18}
                  className="h-11 bg-white text-sm font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={loading || nip.trim().length !== 18}
                className="w-full sm:w-auto h-11 px-6 bg-[#0F4C81] hover:bg-[#0d3d6b] text-white font-semibold text-sm rounded-lg transition-all disabled:bg-slate-200 disabled:text-slate-400"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Cek Status'}
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          </form>

          {result && !result.found && (
            <div className="bg-white rounded-xl border p-6 text-center space-y-3">
              <Info className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">NIP Tidak Ditemukan</h3>
              <p className="text-xs text-slate-500">NIP {nip} belum terdaftar dalam sistem pendaftaran pelatihan.</p>
              <button onClick={onDaftar} className="px-5 py-2.5 bg-[#195737] text-white font-bold text-xs rounded-xl">Daftar Sekarang</button>
            </div>
          )}

          {result && result.found && (
            <div className="bg-white rounded-xl border p-4 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h3 className="text-base font-bold text-slate-900">Status: {result.status}</h3>
              </div>
              <div className="text-xs space-y-1 text-slate-600">
                <p><strong>Nama:</strong> {result.nama}</p>
                <p><strong>NIP:</strong> {result.nip}</p>
                {result.pelatihan && <p><strong>Pelatihan:</strong> {result.pelatihan.nama}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
