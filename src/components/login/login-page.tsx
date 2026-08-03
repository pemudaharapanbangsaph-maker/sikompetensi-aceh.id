'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Lock, User, Loader2, AlertCircle, ArrowRight, BookOpen, Shield, ArrowLeft, Clock, GraduationCap, Building2, Target, Calendar, BarChart3, LogIn, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogoPancaCita } from '@/components/shared/logo-pancacita'

type ViewMode = 'landing' | 'login' | 'programs'

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
  const { login, loading } = useAuthStore()
  const rememberedUser = typeof window !== 'undefined' ? localStorage.getItem('bpsdm_remembered_user') : null
  const [view, setView] = useState<ViewMode>('landing')
  const [username, setUsername] = useState(rememberedUser || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(!!rememberedUser)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

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
      await login(username.trim(), password, remember)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal')
    }
  }

  const goBack = () => { setView('landing'); setError(''); setInfo('') }

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFEF9]">
      {view === 'programs' ? (
        /* ===== FULL-SCREEN: PROGRAMS ===== */
        <AnimatePresence mode="wait">
          <ProgramsRight onBack={goBack} onLogin={() => setView('login')} />
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
                Membangun ASN Aceh yang profesional dan berintegritas
              </h2>
              <p className="text-white/50 text-xs mt-3 max-w-xs mx-auto leading-relaxed">
                Satu pintu untuk mengelola analisis kebutuhan diklat, pelatihan, dan sertifikasi kompetensi teknis aparatur sipil negara di Aceh.
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
              <LandingRight onEnter={() => setView('login')} onPrograms={() => setView('programs')} />
            )}
            {view === 'login' && (
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
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ==========================================================================
// RIGHT PANEL: LANDING
// ==========================================================================

function LandingRight({ onEnter, onPrograms }: { onEnter: () => void; onPrograms: () => void }) {
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
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-[1.15]">
          Membangun ASN Aceh{' '}
          <span className="text-slate-900">yang kompeten &</span>
          <br />
          <span className="text-[#195737]">berintegritas.</span>
        </h1>
        <p className="text-slate-500 text-sm sm:text-base mt-6 leading-relaxed max-w-lg">
          Sikompetensi Aceh menyatukan pembelajaran formal, sosial, dan berbasis pengalaman
          dalam satu ekosistem. Satu akun untuk seluruh aplikasi pengembangan kompetensi
          ASN Pemerintah Aceh.
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
        </div>
        <div className="lg:hidden mt-6">
          <button
            onClick={onEnter}
            className="w-full flex items-center justify-center gap-2.5 px-8 py-3 bg-[#195737] hover:bg-[#0F4227] text-white font-semibold text-sm rounded-xl transition-colors duration-200"
          >
            <LogIn className="w-5 h-5" />
            Masuk Portal
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
