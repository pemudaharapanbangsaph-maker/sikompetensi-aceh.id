'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Lock, User, Loader2, AlertCircle, ArrowRight, BookOpen, Shield, ArrowLeft, Clock, GraduationCap, Building2, Target, Calendar, BarChart3, LogIn, Search, FileText, Upload as UploadIcon, ClipboardList, CheckCircle2, Smartphone, KeyRound, Printer, FileCheck2, XCircle, Hourglass, Info } from 'lucide-react'
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
      // Call API directly to detect 2FA
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
      // Check if 2FA is required
      if (data.requires2FA) {
        setPending2FA({ tempToken: data.tempToken, email: data.email })
        return
      }
      // Normal login - set cookie backup and user
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
    <div className="min-h-screen flex flex-col bg-[#FFFEF9]">
      {view === 'programs' ? (
        /* ===== FULL-SCREEN: PROGRAMS ===== */
        <AnimatePresence mode="wait">
          <ProgramsRight onBack={goBack} onLogin={() => setView('login')} />
        </AnimatePresence>
      ) : view === 'pendaftaran' ? (
        /* ===== FULL-SCREEN: PENDAFTARAN ===== */
        <AnimatePresence mode="wait">
          <PendaftaranRight onBack={goBack} />
        </AnimatePresence>
      ) : view === 'cek-status' ? (
        /* ===== FULL-SCREEN: CEK STATUS ===== */
        <AnimatePresence mode="wait">
          <CekStatusRight onBack={goBack} onDaftar={() => setView('pendaftaran')} />
        </AnimatePresence>
      ) : (
        /* ===== SPLIT SCREEN: LANDING / LOGIN ===== */
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* ===== LEFT PANEL (Green Branding) ===== */}
          <div className="login-bg relative z-10 overflow-hidden lg:w-[45%] flex flex-col">
            <div className="login-bg-pattern absolute inset-0 z-0" />
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 py-10 text-center">
              <LogoPancaCita size={100} className="drop-shadow-2xl" />
              <p className="text-white/80 text-xs font-bold uppercase tracking-[0.2em] mt-3">Pemerintah Aceh</p>
              <div className="mt-5">
                <p className="text-white text-2xl sm:text-3xl font-extrabold tracking-wide">SIKOMPETENSI ACEH</p>
                <p className="text-xs tracking-[0.35em] text-[#86EFAC]/80 mt-1.5 font-medium">CORPORATE UNIVERSITY</p>
              </div>
              <div className="flex items-center justify-center mt-5 mb-5">
                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-amber-400/60" />
                <div className="h-[2px] w-20 bg-gradient-to-r from-amber-500/80 via-amber-400 to-amber-500/80" />
                <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-amber-400/60" />
              </div>
              <p className="text-amber-300/90 text-[10px] font-semibold uppercase tracking-[0.3em]">Pemerintah Aceh</p>
              <h2 className="text-white text-lg sm:text-xl font-bold mt-3 leading-relaxed max-w-sm mx-auto">
                Mewujudkan ASN Aceh yang Kompeten, Profesional, dan Berintegritas.
              </h2>
              <p className="text-white/50 text-xs mt-3 max-w-xs mx-auto leading-relaxed">
                Satu pintu untuk pengembangan kompetensi, pelatihan, dan sertifikasi ASN Pemerintah Aceh.
              </p>
            </div>
            <AnimatePresence>
              {view === 'login' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 px-6 pb-6">
                  <div className="bg-white/[0.06] rounded-lg p-3.5">
                    <p className="text-[10px] text-white/50 leading-relaxed text-center">
                      Sistem internal Pemerintah Aceh untuk aparatur sipil negara.
                      Akses tidak sah dilarang. Butuh bantuan? Hubungi{' '}
                      <span className="font-semibold text-white/80">BPSDM Aceh</span>.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-0">
              <BookOpen className="w-14 h-14 text-white/[0.04]" />
            </div>
            <div className="absolute top-16 right-8 w-32 h-32 rounded-full bg-white/[0.03]" />
            <div className="absolute bottom-28 right-16 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="absolute top-32 left-6 w-12 h-12 rounded-full bg-white/[0.02]" />
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
      transition={{ duration: 0.4 }}
      className="flex-1 lg:flex-1 relative flex items-center px-6 sm:px-12 lg:px-16 py-12 bg-[#FFFEF9] overflow-hidden"
    >
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2/3 h-2/3 opacity-[0.04] pointer-events-none hidden lg:block">
        <svg viewBox="0 0 400 500" fill="none" className="w-full h-full text-amber-800">
          <path d="M200 20L20 180h360L200 20z" stroke="currentColor" strokeWidth="1" fill="none" />
          <path d="M60 180v260h280V180" stroke="currentColor" strokeWidth="1" fill="none" />
          <path d="M200 20v-10m0 490v-20M20 180h-10m380 0h10" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="200" cy="100" r="30" stroke="currentColor" strokeWidth="0.8" fill="none" />
          <path d="M200 130v50m-20 0h40" stroke="currentColor" strokeWidth="0.8" />
          <rect x="140" y="220" width="120" height="80" rx="4" stroke="currentColor" strokeWidth="0.8" fill="none" />
          <path d="M140 260h120m-60-40v80" stroke="currentColor" strokeWidth="0.5" />
          <path d="M80 180v120m240-120v120" stroke="currentColor" strokeWidth="0.5" />
          <path d="M100 300l100 120 100-120" stroke="currentColor" strokeWidth="0.8" fill="none" />
        </svg>
      </div>
      <div className="relative z-10 max-w-xl w-full">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-4 h-px bg-[#195737]/40" />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-[1.15]">
          Mewujudkan ASN Aceh{' '}
          <span className="text-slate-900">yang Kompeten, Profesional &</span>
          <br />
          <span className="text-[#195737]">Berintegritas.</span>
        </h1>
        <p className="text-slate-500 text-sm sm:text-base mt-6 leading-relaxed max-w-lg">
          Sikompetensi Aceh mengintegrasikan pembelajaran formal, sosial, dan 
          berbasis pengalaman dalam satu ekosistem pengembangan kompetensi ASN.
        </p>
        <div className="flex flex-wrap gap-3 mt-10">
          <button
            onClick={onEnter}
            className="flex items-center gap-2.5 px-8 py-3 bg-[#195737] hover:bg-[#0F4227] text-white font-semibold text-sm rounded-xl transition-colors duration-200"
          >
            <LogIn className="w-5 h-5" />
            Masuk Portal
          </button>
          <button
            onClick={onPrograms}
            className="flex items-center gap-2.5 px-8 py-3 border border-slate-300 hover:border-[#195737]/40 hover:text-[#195737] text-slate-700 font-medium text-sm rounded-xl transition-colors duration-200"
          >
            <Search className="w-5 h-5" />
            Jelajahi Program
          </button>
          <button
            onClick={onPendaftaran}
            className="flex items-center justify-center gap-3 px-10 py-4 border-2 border-[#195737]/40 hover:bg-[#195737] hover:text-white hover:border-[#195737] text-[#195737] font-bold text-base rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <ClipboardList className="w-6 h-6" />
            Pendaftaran Pelatihan
          </button>
          <button
            onClick={onCekStatus}
            className="flex items-center justify-center gap-3 px-10 py-4 border-2 border-[#0F4C81]/40 hover:bg-[#0F4C81] hover:text-white hover:border-[#0F4C81] text-[#0F4C81] font-bold text-base rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <FileCheck2 className="w-6 h-6" />
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
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col bg-[#FFFEF9] overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 sm:px-10 pt-6 pb-4 border-b border-slate-200/60">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Program Diklat</h2>
            <p className="text-sm text-slate-500 mt-1">
              Katalog program diklat BPSDM Aceh berdasarkan analisis kebutuhan —{' '}
              <span className="font-semibold text-[#195737]">{total} program</span> tersedia.
            </p>
          </div>
          <button
            onClick={onLogin}
            className="flex items-center gap-2.5 px-8 py-3 bg-[#195737] hover:bg-[#0F4227] text-white text-sm font-semibold rounded-xl transition-colors duration-200"
          >
            <LogIn className="w-5 h-5" />
            Masuk Portal
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-6 sm:px-10 py-3 border-b border-slate-100 overflow-x-auto">
        <div className="flex gap-2">
          {categories.map((cat) => {
            const isAll = cat === 'SEMUA'
            const catInfo = KATEGORI_LABEL[cat]
            const isActive = filter === cat
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-[#195737] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isAll ? 'Semua' : catInfo?.label || cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Program cards */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#195737]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <GraduationCap className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-semibold">Belum ada program</p>
            <p className="text-slate-400 text-sm mt-1 max-w-xs">
              Program diklat akan ditampilkan setelah data dimasukkan melalui menu Input Analisis Diklat oleh admin.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((p, i) => {
              const catInfo = KATEGORI_LABEL[p.kategori]
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="group bg-white border border-slate-200/80 rounded-xl p-5 hover:border-[#195737]/20 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {catInfo && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${catInfo.color} ${catInfo.bg}`}>
                            {catInfo.label}
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${METODE_COLORS[p.metode] || 'bg-slate-100 text-slate-600'} ${METODE_COLORS[p.metode] ? 'border-transparent' : 'border-slate-200'}`}>
                          {METODE_LABEL[p.metode] || p.metode}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITAS_COLORS[p.prioritas] || 'bg-slate-50 text-slate-500 border-slate-200/60'}`}>
                          {PRIORITAS_LABEL[p.prioritas] || p.prioritas}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{p.nama}</h3>
                      {p.targetOutput && (
                        <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{p.targetOutput}</p>
                      )}
                      {p.programPrioritasRPJMA && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">RPJMA: {p.programPrioritasRPJMA}</p>
                      )}
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-2 sm:text-right flex-shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-semibold text-slate-700">{p.jp} JP</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{p.tahun}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] text-slate-400">Badan Pengembangan Sumber Daya Manusia Aceh</span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 sm:px-10 py-4 border-t border-slate-200/60">
        <p className="text-center text-xs text-slate-400">
          © {new Date().getFullYear()} BPSDM Provinsi Aceh — Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti
        </p>
      </div>
    </motion.div>
  )
}

// ==========================================================================
// RIGHT PANEL: LOGIN FORM
// ==========================================================================

interface LoginRightProps {
  username: string
  setUsername: (v: string) => void
  password: string
  setPassword: (v: string) => void
  showPassword: boolean
  setShowPassword: (v: boolean) => void
  remember: boolean
  setRemember: (v: boolean) => void
  error: string
  setError: (v: string) => void
  info: string
  setInfo: (v: string) => void
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
  onBack: () => void
}

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
      transition={{ duration: 0.4 }}
      className="flex-1 lg:flex-1 flex items-center justify-center p-6 sm:p-10 bg-[#F5F5F7]"
    >
      <div className="w-full max-w-md">
        <div className="mb-8">
          <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium mb-4">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </button>
          <h2 className="text-3xl font-bold text-slate-900">Masuk</h2>
          <p className="text-sm text-slate-500 mt-1.5">Gunakan akun ASN Anda untuk melanjutkan.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm font-semibold text-slate-700">Username atau Email</Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
              <Input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Masukkan username atau email" className="pl-11 h-12 bg-white border-slate-300 focus:border-[#195737] focus:ring-[#195737]/20 rounded-lg text-sm" autoComplete="username" disabled={loading} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
              <button type="button" className="text-xs text-[#195737] hover:text-[#0F4227] hover:underline font-medium" onClick={() => setInfo('Hubungi Super Admin untuk reset password.')}>Lupa password?</button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
              <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" className="pl-11 pr-11 h-12 bg-white border-slate-300 focus:border-[#195737] focus:ring-[#195737]/20 rounded-lg text-sm" autoComplete="current-password" disabled={loading} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#195737] focus:ring-[#195737]/20 cursor-pointer" />
            <Label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">Ingat aku (7 hari)</Label>
          </div>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
            </motion.div>
          )}
          {info && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-[#86EFAC] text-[#195737] text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{info}</span>
            </div>
          )}
          <Button type="submit" disabled={loading} className="login-btn w-full h-12 bg-[#195737] hover:bg-[#0F4227] text-white font-semibold text-base rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</>) : 'Masuk'}
          </Button>
          <p className="text-center text-sm text-slate-500">
            Belum punya akun?{' '}
            <button type="button" onClick={() => setInfo('Aktivasi akun ASN dilakukan oleh Admin Bidang. Hubungi BPSDM Aceh untuk pengajuan.')} className="text-[#195737] hover:text-[#0F4227] font-semibold hover:underline">Aktivasi Akun ASN</button>
          </p>
        </form>
        <p className="text-center text-xs text-slate-400 mt-10">
          © {new Date().getFullYear()} BPSDM Provinsi Aceh — Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti
        </p>
      </div>
    </motion.div>
  )
}

// ==========================================================================
// RIGHT PANEL: 2FA VERIFICATION
// ==========================================================================

interface TwoFARightProps {
  email: string
  totpCode: string
  setTotpCode: (v: string) => void
  error: string
  setError: (v: string) => void
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

function TwoFARight({ email, totpCode, setTotpCode, error, setError, loading, onSubmit, onCancel }: TwoFARightProps) {
  return (
    <motion.div
      key="twofa-right"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4 }}
      className="flex-1 lg:flex-1 flex items-center justify-center p-6 sm:p-10 bg-[#F5F5F7]"
    >
      <div className="w-full max-w-md">
        <div className="mb-8">
          <button type="button" onClick={onCancel} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium mb-4">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Verifikasi 2FA</h2>
              <p className="text-sm text-slate-500">Langkah keamanan tambahan</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Buka Google Authenticator</p>
                <p className="text-xs text-blue-600 mt-1">Masukkan kode 6 digit yang ditampilkan di aplikasi Google Authenticator untuk akun <strong>{email}</strong></p>
              </div>
            </div>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="totp" className="text-sm font-semibold text-slate-700">Kode Autentikasi</Label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
              <Input
                id="totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setTotpCode(val)
                  setError('')
                }}
                placeholder="Masukkan 6 digit kode"
                maxLength={6}
                className="pl-11 pr-4 h-14 bg-white border-slate-300 focus:border-[#195737] focus:ring-[#195737]/20 rounded-lg text-2xl font-bold text-center tracking-[0.5em]"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-slate-400">Kode berubah setiap 30 detik</p>
          </div>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
            </motion.div>
          )}
          <Button type="submit" disabled={totpCode.length !== 6 || loading} className="login-btn w-full h-12 bg-[#195737] hover:bg-[#0F4227] text-white font-semibold text-base rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memverifikasi...</>) : 'Verifikasi & Masuk'}
          </Button>
        </form>
        <p className="text-center text-xs text-slate-400 mt-10">
          © {new Date().getFullYear()} BPSDM Provinsi Aceh — Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti
        </p>
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

  // === VALIDATION STATE ===
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    fetch('/api/portal/pelatihan-list').then((r) => r.json()).then(setPelatihanList).catch(() => {})
  }, [])

  const handleChange = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleBlur = (k: string) => () => setTouched((p) => ({ ...p, [k]: true }))

  // === PER-FIELD VALIDATION ===
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

  // NIP khusus
  if (showErr('nip')) {
    if (!form.nip.trim()) fieldErrors.nip = 'NIP wajib diisi'
    else if (!/^\d+$/.test(form.nip.trim())) fieldErrors.nip = 'NIP hanya boleh berisi angka'
    else if (form.nip.trim().length !== 18) fieldErrors.nip = `NIP harus 18 digit (saat ini ${form.nip.trim().length} digit)`
  }

  // No HP format
  if (showErr('nomorHP') && form.nomorHP.trim() && !/^0\d{8,13}$/.test(form.nomorHP.trim())) {
    fieldErrors.nomorHP = 'Format No. HP tidak valid (contoh: 081234567890)'
  }

  // Email format
  if (showErr('email') && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    fieldErrors.email = 'Format email tidak valid (contoh: nama@email.com)'
  }

  const errorCount = Object.keys(fieldErrors).length
  const docsMissing = DOKUMEN_WAJIB.filter((d) => !files[d.tipe]).length

  // Cek semua field form terisi (tanpa perlu touched)
  const formComplete = Object.keys(requiredFields).every((k) => {
    if (k === 'jenisKelamin') return !!form.jenisKelamin
    return form[k as keyof typeof form].trim() !== ''
  }) && /^\d{18}$/.test(form.nip.trim())
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
      // Upload dokumen wajib + opsional yang sudah dipilih
      const docsToUpload = ALL_DOKUMEN.filter((d) => files[d.tipe])
      for (let i = 0; i < docsToUpload.length; i++) {
      const d = docsToUpload[i]; const file = files[d.tipe]; if (!file) continue
      setUploadProgress(`Mengupload ${d.label}... (${i + 1}/${docsToUpload.length})`)
      const fd = new FormData(); fd.append('pendaftaranId', regId); fd.append('tipe', d.tipe); fd.append('file', file); fd.append('uploadToken', uploadToken)
      const ures = await fetch('/api/portal/pendaftaran/upload-dokumen', { method: 'POST', body: fd })
        if (!ures.ok) { const udata = await ures.json().catch(() => ({})); setError(`Gagal upload ${d.label}: ${udata.error || 'unknown error'}`); setStep('form'); setLoading(false); return }
      }
      setStep('done'); setSuccess({ nama: data.nama, id: regId })
    } catch { setError('Terjadi kesalahan jaringan'); setStep('form') } finally { setLoading(false) }
  }

  const inputCls = (fieldName: string) =>
    `w-full h-11 bg-white rounded-lg text-sm transition-colors ${
      showErr(fieldName) && fieldErrors[fieldName]
        ? 'border-2 border-red-400 focus:border-red-500 focus:ring-red-500/20'
        : 'border-slate-300 focus:border-[#195737] focus:ring-[#195737]/20'
    }`

  const req = <span className="text-red-500 font-bold"> *</span>
  const filledCount = ALL_DOKUMEN.filter((d) => files[d.tipe]).length

  // Helper: render field with label, input, and error
  const renderField = (k: string, label: string, opts?: { type?: string; placeholder?: string; maxLength?: number; extraCls?: string; colSpan?: boolean }) => {
    const err = showErr(k) && fieldErrors[k]
    return (
      <div className={`space-y-1.5 ${opts?.colSpan ? 'sm:col-span-2' : ''}`}>
        <Label className={`text-xs font-semibold transition-colors ${err ? 'text-red-600' : 'text-slate-600'}`}>
          {label}{req}
        </Label>
        <Input
          type={opts?.type || 'text'}
          value={form[k as keyof typeof form]}
          onChange={handleChange(k)}
          onBlur={handleBlur(k)}
          placeholder={opts?.placeholder}
          maxLength={opts?.maxLength}
          className={`${inputCls(k)} ${opts?.extraCls || ''}`}
        />
        {err && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" /> {fieldErrors[k]}
          </motion.p>
        )}
      </div>
    )
  }

  return (
    <motion.div key="pendaftaran-right" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4 }} className="min-h-screen flex flex-col bg-[#FFFEF9]">
      {/* Header */}
      <div className="px-6 sm:px-10 pt-6 pb-4 border-b border-slate-200/60">
        <button type="button" onClick={onBack} disabled={loading} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium mb-4"><ArrowLeft className="w-4 h-4" /> Kembali</button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#195737]/10 flex items-center justify-center"><ClipboardList className="w-5 h-5 text-[#195737]" /></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Form Pendaftaran Pelatihan</h2>
            <p className="text-sm text-slate-500 mt-0.5">Lengkapi semua data dan upload dokumen wajib untuk mendaftar</p>
          </div>
        </div>
      </div>

      {success ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-5">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }} className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto"><CheckCircle2 className="w-10 h-10 text-green-600" /></motion.div>
            <h3 className="text-2xl font-bold text-slate-900">Pendaftaran Berhasil! 🎉</h3>
            <p className="text-sm text-slate-600">Terima kasih <strong>{success.nama}</strong>, data dan dokumen Anda telah tersimpan. Admin akan memverifikasi pendaftaran Anda.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {success.id && (
                <a
                  href={`/api/portal/pendaftaran/${success.id}/cetak-bukti`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#0F4C81] hover:bg-[#0d3d6b] text-white font-bold text-base rounded-xl transition-colors"
                >
                  <Printer className="w-5 h-5" /> Cetak Bukti Pendaftaran
                </a>
              )}
              <button onClick={onBack} className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#195737] hover:bg-[#0F4227] text-white font-bold text-base rounded-xl transition-colors"><ArrowLeft className="w-5 h-5" /> Kembali ke Beranda</button>
            </div>
            {success.id && (
              <p className="text-xs text-slate-400 mt-1">Klik tombol <strong>Cetak Bukti</strong> untuk membuka/mencetak PDF bukti pendaftaran Anda</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 sm:p-10">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6" noValidate>

            {/* === ERROR SUMMARY === */}
            {attempted && (errorCount > 0 || docsMissing > 0) && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-red-50 border-2 border-red-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-red-700">
                      {errorCount > 0 && docsMissing > 0
                        ? `${errorCount} data belum diisi & ${docsMissing} dokumen belum diupload`
                        : errorCount > 0
                          ? `${errorCount} data form belum diisi dengan benar`
                          : `${docsMissing} dokumen belum diupload`}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-red-600">
                      {errorCount > 0 && (
                        <li className="flex items-start gap-1.5">
                          <span className="mt-0.5">•</span>
                          <span>Periksa kolom yang ditandai <strong className="underline">merah</strong> di bawah dan lengkapi datanya</span>
                        </li>
                      )}
                      {docsMissing > 0 && (
                        <li className="flex items-start gap-1.5">
                          <span className="mt-0.5">•</span>
                          <span>Upload {docsMissing} dokumen yang belum dipilih (bagian Upload Dokumen)</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {error && !attempted && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"><AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" /><span>{error}</span></motion.div>}

            {step === 'uploading' && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700"><Loader2 className="w-5 h-5 animate-spin flex-shrink-0" /><span className="text-sm font-medium">{uploadProgress}</span></motion.div>
            )}

            {/* === SECTION 1: Data Pribadi === */}
            <div className={`bg-white rounded-xl border-2 p-5 sm:p-6 space-y-4 transition-colors ${attempted && (fieldErrors.nama || fieldErrors.nip || fieldErrors.pangkatGolongan || fieldErrors.tempatLahir || fieldErrors.tanggalLahir || fieldErrors.jabatan) ? 'border-red-200 bg-red-50/30' : 'border-slate-200/80'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><User className="w-4 h-4 text-[#195737]" /> Data Pribadi <span className="text-xs font-normal text-slate-400">(wajib diisi semua)</span></h3>
                {attempted && !(fieldErrors.nama || fieldErrors.nip || fieldErrors.jenisKelamin || fieldErrors.pangkatGolongan || fieldErrors.tempatLahir || fieldErrors.tanggalLahir || fieldErrors.jabatan) && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {renderField('nama', 'Nama Lengkap', { placeholder: 'Masukkan nama lengkap beserta gelar' })}
                {renderField('nip', 'NIP', { placeholder: '18 digit NIP', maxLength: 18, extraCls: 'font-mono' })}
                <div className="space-y-1.5">
                  <Label className={`text-xs font-semibold transition-colors ${showErr('jenisKelamin') && fieldErrors.jenisKelamin ? 'text-red-600' : 'text-slate-600'}`}>
                    Jenis Kelamin{req}
                  </Label>
                  <select
                    value={form.jenisKelamin}
                    onChange={handleChange('jenisKelamin')}
                    onBlur={handleBlur('jenisKelamin')}
                    className={`w-full h-11 bg-white rounded-lg text-sm px-3 transition-colors ${
                      showErr('jenisKelamin') && fieldErrors.jenisKelamin
                        ? 'border-2 border-red-400 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-slate-300 focus:border-[#195737] focus:ring-[#195737]/20'
                    } ${!form.jenisKelamin ? 'text-slate-400' : 'text-slate-900'}`}
                  >
                    <option value="">-- Pilih --</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                  {showErr('jenisKelamin') && fieldErrors.jenisKelamin && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" /> {fieldErrors.jenisKelamin}
                    </motion.p>
                  )}
                </div>
                {renderField('pangkatGolongan', 'Pangkat/Golongan', { placeholder: 'Contoh: III/c' })}
                {renderField('tempatLahir', 'Tempat Lahir', { placeholder: 'Kota/Kabupaten' })}
                {renderField('tanggalLahir', 'Tanggal Lahir', { type: 'date' })}
                {renderField('jabatan', 'Jabatan', { placeholder: 'Jabatan saat ini' })}
              </div>
            </div>

            {/* === SECTION 2: Instansi & Kontak === */}
            <div className={`bg-white rounded-xl border-2 p-5 sm:p-6 space-y-4 transition-colors ${attempted && (fieldErrors.unitKerja || fieldErrors.instansi || fieldErrors.nomorHP || fieldErrors.email || fieldErrors.nomorRekening || fieldErrors.npwp) ? 'border-red-200 bg-red-50/30' : 'border-slate-200/80'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Building2 className="w-4 h-4 text-[#195737]" /> Instansi & Kontak <span className="text-xs font-normal text-slate-400">(wajib diisi semua)</span></h3>
                {attempted && !(fieldErrors.unitKerja || fieldErrors.instansi || fieldErrors.nomorHP || fieldErrors.email || fieldErrors.nomorRekening || fieldErrors.npwp) && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {renderField('unitKerja', 'Unit Kerja', { placeholder: 'Nama unit kerja/OPD' })}
                {renderField('instansi', 'Instansi', { placeholder: 'Nama instansi/pemerintah', colSpan: true })}
                {renderField('nomorHP', 'No. HP', { placeholder: '08xxxxxxxxxx' })}
                {renderField('npwp', 'NPWP', { placeholder: 'Nomor NPWP' })}
                {renderField('email', 'Email', { type: 'email', placeholder: 'nama@email.com', maxLength: 191, colSpan: true })}
                {renderField('nomorRekening', 'Nomor REK Bank Aceh', { placeholder: 'Nomor rekening Bank Aceh', colSpan: true })}
              </div>
            </div>

            {/* === SECTION 3: Pilih Pelatihan === */}
            <div className={`bg-white rounded-xl border-2 p-5 sm:p-6 space-y-4 transition-colors ${attempted && fieldErrors.pelatihanId ? 'border-red-200 bg-red-50/30' : 'border-slate-200/80'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-[#195737]" /> Pilih Pelatihan</h3>
                {attempted && !fieldErrors.pelatihanId && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              </div>
              <div className="space-y-1.5">
                <Label className={`text-xs font-semibold transition-colors ${showErr('pelatihanId') && fieldErrors.pelatihanId ? 'text-red-600' : 'text-slate-600'}`}>
                  Pelatihan yang Diikuti{req}
                </Label>
                {pelatihanList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg">Belum ada pelatihan tersedia. Pelatihan akan muncul setelah admin menginput data melalui menu Analisis Diklat.</p>
                ) : (
                  <select
                    value={form.pelatihanId}
                    onChange={handleChange('pelatihanId')}
                    onBlur={handleBlur('pelatihanId')}
                    className={`w-full h-11 bg-white rounded-lg text-sm px-3 transition-colors ${
                      showErr('pelatihanId') && fieldErrors.pelatihanId
                        ? 'border-2 border-red-400 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-slate-300 focus:border-[#195737] focus:ring-[#195737]/20'
                    } ${!form.pelatihanId ? 'text-slate-400' : 'text-slate-900'}`}
                  >
                    <option value="">-- Pilih Pelatihan --</option>
                    {pelatihanList.map((p) => (
                      <option key={p.id} value={p.id}>{p.nama}{p.jp ? ` (${p.jp} JP)` : ''}{p.metode ? ` — ${METODE_LABEL[p.metode] || p.metode}` : ''}{p.tahun ? ` — ${p.tahun}` : ''}</option>
                    ))}
                  </select>
                )}
                {showErr('pelatihanId') && fieldErrors.pelatihanId && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" /> {fieldErrors.pelatihanId}
                  </motion.p>
                )}
              </div>
            </div>

            {/* === SECTION 4: Upload Dokumen === */}
            <div className={`bg-white rounded-xl border-2 p-5 sm:p-6 space-y-4 transition-colors ${attempted && docsMissing > 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200/80'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><UploadIcon className="w-4 h-4 text-[#195737]" /> Upload Dokumen <span className="text-xs font-normal text-slate-400">({DOKUMEN_WAJIB.length} wajib + {DOKUMEN_OPSIONAL.length} opsional)</span></h3>
                {attempted && docsMissing === 0 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                <strong>Petunjuk:</strong> Upload dokumen dalam format <strong>PDF</strong> (maks. 5MB per file). Dokumen bertanda <span className="text-red-500 font-bold">*</span> wajib diupload.
              </div>
              {/* Dokumen Wajib */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {DOKUMEN_WAJIB.map((d) => {
                  const hasFile = !!files[d.tipe]
                  const isMissing = attempted && !hasFile
                  return (
                    <div key={d.tipe} className={`rounded-xl border-2 p-4 space-y-2 transition-all ${hasFile ? 'border-green-300 bg-green-50/50' : isMissing ? 'border-red-300 bg-red-50/50' : 'border-amber-200 bg-amber-50/30'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className={`text-sm font-bold ${isMissing ? 'text-red-700' : 'text-slate-800'}`}>{d.label}<span className="text-red-500 font-bold"> *</span></h4>
                          <p className="text-xs text-slate-500 mt-0.5">{d.desc}</p>
                        </div>
                        {hasFile ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : isMissing ? <AlertCircle className="w-5 h-5 text-red-400" /> : null}
                      </div>
                      <label className={`flex items-center justify-center gap-2 w-full h-11 rounded-lg border-2 border-dashed text-sm font-medium cursor-pointer transition-colors ${hasFile ? 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100' : isMissing ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-[#195737]/30 text-[#195737] hover:bg-[#195737]/5 hover:border-[#195737]/60'}`}>
                        <UploadIcon className="w-4 h-4" />
                        {hasFile ? files[d.tipe].name : 'Pilih File PDF'}
                        <input type="file" accept=".pdf" disabled={loading} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; handleFileSelect(d.tipe, f) }} />
                      </label>
                      {isMissing && <p className="text-xs text-red-500">Dokumen wajib diupload</p>}
                    </div>
                  )
                })}
              </div>
              {/* Dokumen Opsional */}
              <div className="pt-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Dokumen Opsional</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {DOKUMEN_OPSIONAL.map((d) => {
                    const hasFile = !!files[d.tipe]
                    return (
                      <div key={d.tipe} className={`rounded-xl border-2 p-4 space-y-2 transition-all ${hasFile ? 'border-green-300 bg-green-50/50' : 'border-slate-200 bg-slate-50/30'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">{d.label} <span className="text-slate-400 font-normal">(opsional)</span></h4>
                            <p className="text-xs text-slate-500 mt-0.5">{d.desc}</p>
                          </div>
                          {hasFile && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                        </div>
                        <label className={`flex items-center justify-center gap-2 w-full h-11 rounded-lg border-2 border-dashed text-sm font-medium cursor-pointer transition-colors ${hasFile ? 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100' : 'border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400'}`}>
                          <UploadIcon className="w-4 h-4" />
                          {hasFile ? files[d.tipe].name : 'Pilih File PDF (opsional)'}
                          <input type="file" accept=".pdf" disabled={loading} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; handleFileSelect(d.tipe, f) }} />
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>
              <p className={`text-xs text-center ${attempted && docsMissing > 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>Dokumen terupload: {filledCount}/{ALL_DOKUMEN.length} (wajib: {DOKUMEN_WAJIB.filter((d) => files[d.tipe]).length}/{DOKUMEN_WAJIB.length})</p>
            </div>

            {/* === TOMBOL DAFTAR === */}
            <div className="pt-4 pb-6">
              <button type="submit" disabled={loading} className={`w-full flex items-center justify-center gap-3 py-6 text-xl font-bold rounded-2xl transition-all shadow-lg ${canSubmit && !loading ? 'bg-[#195737] hover:bg-[#0F4227] hover:shadow-xl hover:scale-[1.02] text-white cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}>
                {loading ? (
                  <><Loader2 className="w-7 h-7 animate-spin" /> {uploadProgress || 'Memproses...'}</>
                ) : attempted && !formComplete ? (
                  <><AlertCircle className="w-7 h-7" /> Lengkapi {errorCount} Data yang Belum Diisi</>
                ) : attempted && !docsComplete ? (
                  <><AlertCircle className="w-7 h-7" /> Upload {docsMissing} Dokumen yang Belum Dipilih</>
                ) : attempted ? (
                  <><ArrowRight className="w-7 h-7" /> DAFTAR SEKARANG</>
                ) : (
                  <><ArrowRight className="w-7 h-7" /> DAFTAR SEKARANG</>
                )}
              </button>
              {!canSubmit && !attempted && (
                <p className="text-center text-xs text-slate-400 mt-3">Pastikan semua data form terisi dan {DOKUMEN_WAJIB.length} dokumen wajib PDF sudah diupload</p>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="px-6 sm:px-10 py-4 border-t border-slate-200/60"><p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} BPSDM Provinsi Aceh</p></div>
    </motion.div>
  )
}

// ==========================================================================
// FULL-SCREEN: CEK STATUS PENDAFTARAN
// ==========================================================================

const TIPE_DOK_LABEL: Record<string, string> = {
  KTP: 'KTP',
  SURAT_TUGAS: 'Surat Tugas',
  NPWP: 'NPWP',
  REK_BANK: 'Rekening Bank',
}

function CekStatusRight({ onBack, onDaftar }: { onBack: () => void; onDaftar: () => void }) {
  const [nip, setNip] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    found: boolean
    id?: string
    nama?: string
    nip?: string
    status?: string
    catatanAdmin?: string | null
    pelatihan?: { id: string; nama: string } | null
    dokumen?: { tipe: string; namaFile: string; createdAt: string }[]
    createdAt?: string
  } | null>(null)

  const handleCek = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)
    const nipVal = nip.trim()
    if (!nipVal) { setError('NIP wajib diisi'); return }
    if (!/^\d{18}$/.test(nipVal)) { setError('Format NIP tidak valid (harus 18 digit angka)'); return }
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

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return d }
  }

  const statusConfig: Record<string, { label: string; bg: string; border: string; text: string; icon: React.ReactNode; desc: string }> = {
    MENUNGGU: {
      label: 'Menunggu Verifikasi',
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      text: 'text-amber-800',
      icon: <Hourglass className="w-8 h-8 text-amber-600" />,
      desc: 'Pendaftaran Anda sedang dalam proses verifikasi oleh admin. Silakan cek kembali secara berkala.',
    },
    DITERIMA: {
      label: 'Diterima',
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-800',
      icon: <CheckCircle2 className="w-8 h-8 text-green-600" />,
      desc: 'Selamat! Pendaftaran Anda telah disetujui. Anda dapat mencetak bukti pendaftaran.',
    },
    DITOLAK: {
      label: 'Ditolak',
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-800',
      icon: <XCircle className="w-8 h-8 text-red-600" />,
      desc: 'Maaf, pendaftaran Anda ditolak. Silakan perhatikan catatan admin di bawah.',
    },
  }

  const status = result?.status || ''
  const cfg = statusConfig[status]

  return (
    <motion.div
      key="cek-status-right"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col bg-[#FFFEF9]"
    >
      {/* Header */}
      <div className="px-6 sm:px-10 pt-6 pb-4 border-b border-slate-200/60">
        <button type="button" onClick={onBack} disabled={loading} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium mb-4">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0F4C81]/10 flex items-center justify-center">
            <FileCheck2 className="w-5 h-5 text-[#0F4C81]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Cek Status Pendaftaran</h2>
            <p className="text-sm text-slate-500 mt-0.5">Masukkan NIP untuk melihat status pendaftaran pelatihan Anda</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 sm:p-10">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Form Cari */}
          <form onSubmit={handleCek} className="bg-white rounded-xl border-2 border-slate-200/80 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Nomor Induk Pegawai (NIP)</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={nip}
                    onChange={(e) => { setNip(e.target.value.replace(/\D/g, '').slice(0, 18)); setError(''); setResult(null) }}
                    placeholder="Masukkan 18 digit NIP"
                    maxLength={18}
                    className="pl-11 h-12 bg-white border-slate-300 focus:border-[#0F4C81] focus:ring-[#0F4C81]/20 rounded-lg text-sm font-mono"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading || nip.trim().length !== 18}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 h-12 font-semibold text-sm rounded-lg transition-all ${nip.trim().length === 18 && !loading ? 'bg-[#0F4C81] hover:bg-[#0d3d6b] text-white shadow-sm hover:shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Mencari...</> : <><Search className="w-4 h-4" /> Cek Status</>}
                </button>
              </div>
            </div>
            {nip.trim().length > 0 && nip.trim().length < 18 && (
              <p className="text-xs text-slate-400 mt-2">NIP harus 18 digit (saat ini: {nip.trim().length} digit)</p>
            )}
          </form>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" /><span>{error}</span>
            </motion.div>
          )}

          {/* Result: NIP Tidak Ditemukan */}
          {result && !result.found && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl border-2 border-slate-200 p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                <Info className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">NIP Tidak Ditemukan</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                NIP <span className="font-mono font-semibold text-slate-700">{nip.trim()}</span> belum terdaftar dalam sistem pendaftaran pelatihan.
              </p>
              <button
                onClick={onDaftar}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#195737] hover:bg-[#0F4227] text-white font-bold text-sm rounded-xl transition-colors"
              >
                <ClipboardList className="w-4 h-4" /> Daftar Sekarang
              </button>
            </motion.div>
          )}

          {/* Result: Status Ditemukan */}
          {result && result.found && cfg && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

              {/* Status Card */}
              <div className={`rounded-xl border-2 ${cfg.bg} ${cfg.border} p-6 sm:p-8`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex-shrink-0">{cfg.icon}</div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold ${cfg.text}`}>{cfg.label}</h3>
                    <p className="text-sm text-slate-600 mt-1">{cfg.desc}</p>
                  </div>
                </div>
              </div>

              {/* Data Peserta */}
              <div className="bg-white rounded-xl border-2 border-slate-200/80 p-5 sm:p-6 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#0F4C81]" /> Data Pendaftar
                </h4>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="text-xs text-slate-400 font-medium">Nama Lengkap</p>
                    <p className="font-semibold text-slate-800">{result.nama}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-slate-400 font-medium">NIP</p>
                    <p className="font-semibold text-slate-800 font-mono">{result.nip}</p>
                  </div>
                  {result.pelatihan && (
                    <div className="space-y-0.5 sm:col-span-2">
                      <p className="text-xs text-slate-400 font-medium">Pelatihan yang Dipilih</p>
                      <p className="font-semibold text-slate-800">{result.pelatihan.nama}</p>
                    </div>
                  )}
                  {result.createdAt && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-slate-400 font-medium">Waktu Pendaftaran</p>
                      <p className="font-semibold text-slate-800">{formatDate(result.createdAt)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Dokumen */}
              {result.dokumen && result.dokumen.length > 0 && (
                <div className="bg-white rounded-xl border-2 border-slate-200/80 p-5 sm:p-6 space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0F4C81]" /> Dokumen yang Diunggah
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {result.dokumen.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm text-slate-700 font-medium">{TIPE_DOK_LABEL[d.tipe] || d.tipe}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catatan Admin */}
              {result.catatanAdmin && (
                <div className="bg-amber-50 rounded-xl border-2 border-amber-200 p-5 sm:p-6 space-y-2">
                  <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Catatan dari Admin
                  </h4>
                  <p className="text-sm text-amber-900 bg-white/70 rounded-lg p-3 border border-amber-200">{result.catatanAdmin}</p>
                </div>
              )}

              {/* Aksi: Cetak Bukti (hanya DITERIMA) */}
              {status === 'DITERIMA' && result.id && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center gap-3">
                  <a
                    href={`/api/portal/pendaftaran/${result.id}/cetak-bukti`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-[#0F4C81] hover:bg-[#0d3d6b] text-white font-bold text-base rounded-xl transition-colors shadow-md hover:shadow-lg"
                  >
                    <Printer className="w-5 h-5" /> Cetak Bukti Pendaftaran
                  </a>
                  <p className="text-xs text-slate-400">Klik untuk membuka PDF bukti pendaftaran</p>
                </motion.div>
              )}

              {/* Aksi: Saran untuk DITOLAK */}
              {status === 'DITOLAK' && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-center text-sm text-slate-500">
                  Jika ada pertanyaan, silakan hubungi <strong>Admin BPSDM Aceh</strong> untuk informasi lebih lanjut.
                </div>
              )}

              {/* Tombol Cek Ulang */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleCek}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#0F4C81] hover:bg-[#0F4C81]/5 rounded-lg transition-colors"
                >
                  <Search className="w-4 h-4" /> {loading ? 'Memperbarui...' : 'Perbarui Status'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="px-6 sm:px-10 py-4 border-t border-slate-200/60"><p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} BPSDM Provinsi Aceh</p></div>
    </motion.div>
  )
}
