'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Lock, User, Loader2, AlertCircle, KeyRound } from 'lucide-react'
import { motion } from 'framer-motion'
import { LogoPancaCita } from '@/components/shared/logo-pancacita'

export function LoginPage() {
  const { login, loading } = useAuthStore()
  const rememberedUser = typeof window !== 'undefined' ? localStorage.getItem('bpsdm_remembered_user') : null
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

  const fillDemo = (u: string) => {
    setUsername(u)
    setPassword('admin123')
    setInfo(`Kredensial demo ${u} / admin123 diisi. Klik "Masuk" untuk lanjut.`)
  }

  return (
    <div className="min-h-screen flex">
      {/* ===== Left side - Branding (Dark Forest Green) ===== */}
      <div className="login-bg hidden lg:flex lg:w-1/2 flex-col relative z-10 overflow-hidden">
        {/* Top - BPSDM text */}
        <div className="text-white/80 text-sm font-semibold relative z-10 p-12 pb-0">
          Badan Pengembangan Sumber Daya Manusia Aceh
        </div>

        {/* ASN Illustration - Left side transparent */}
        <svg className="login-asn-illustration" viewBox="0 0 320 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Head */}
          <ellipse cx="160" cy="75" rx="42" ry="50" fill="white" opacity="0.07" />
          {/* Neck */}
          <rect x="148" y="120" width="24" height="20" rx="4" fill="white" opacity="0.06" />
          {/* Body / Suit */}
          <path d="M90 140 C90 140, 100 135, 160 135 C220 135, 230 140, 230 140 L245 300 C245 300, 240 310, 160 310 C80 310, 75 300, 75 300 L90 140 Z" fill="white" opacity="0.06" />
          {/* Collar / Tie */}
          <path d="M140 135 L160 180 L180 135" fill="white" opacity="0.08" />
          {/* Left arm */}
          <path d="M90 140 C70 160, 55 210, 60 260 C62 280, 68 290, 78 285 C88 280, 85 260, 88 240 C90 220, 95 190, 100 170" fill="white" opacity="0.05" />
          {/* Right arm */}
          <path d="M230 140 C250 160, 265 210, 260 260 C258 280, 252 290, 242 285 C232 280, 235 260, 232 240 C230 220, 225 190, 220 170" fill="white" opacity="0.05" />
          {/* Legs */}
          <path d="M110 300 L100 440 C100 445, 95 450, 85 450 L85 455 C85 455, 90 460, 110 460 L130 460 C135 460, 135 455, 135 455 L130 300" fill="white" opacity="0.05" />
          <path d="M190 300 L195 440 C195 445, 200 450, 210 450 L210 455 C210 455, 205 460, 185 460 L165 460 C160 460, 160 455, 160 455 L170 300" fill="white" opacity="0.05" />
          {/* Clipboard in hand */}
          <rect x="45" y="260" width="50" height="65" rx="5" fill="white" opacity="0.08" />
          <rect x="52" y="250" width="36" height="12" rx="3" fill="white" opacity="0.06" />
          <line x1="55" y1="280" x2="85" y2="280" stroke="white" strokeWidth="2" opacity="0.06" />
          <line x1="55" y1="290" x2="80" y2="290" stroke="white" strokeWidth="2" opacity="0.06" />
          <line x1="55" y1="300" x2="75" y2="300" stroke="white" strokeWidth="2" opacity="0.06" />
        </svg>

        {/* Centered Hero Content - Logo + Text */}
        <div className="login-hero-center">
          <LogoPancaCita size={140} className="drop-shadow-2xl" />
          <div className="mt-5 text-center">
            <p className="text-white text-3xl font-extrabold tracking-wide">SIKOMPETENSI ACEH</p>
            <p className="text-sm tracking-[0.35em] text-green-200/80 mt-2 font-medium">CORPORATE UNIVERSITY</p>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute top-20 right-10 w-40 h-40 rounded-full bg-white/[0.03]" />
        <div className="absolute bottom-32 right-20 w-24 h-24 rounded-full bg-white/[0.04]" />
        <div className="absolute top-40 left-8 w-16 h-16 rounded-full bg-white/[0.02]" />
      </div>

      {/* ===== Right side - Login Form (Light Cream) ===== */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-[#FAFAFA]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile branding (only on small screens) */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <LogoPancaCita size={80} className="mb-3 drop-shadow-lg" />
            <h1 className="text-2xl font-extrabold text-[#1B5E20] text-center tracking-wide">SIKOMPETENSI ACEH</h1>
            <p className="text-[11px] text-slate-500 tracking-[0.3em] text-center mt-1.5 font-medium">CORPORATE UNIVERSITY</p>
          </div>

          {/* Form - flat, no card */}
          <div className="px-2">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900">Masuk</h2>
              <p className="text-sm text-slate-500 mt-1.5">Gunakan akun ASN Anda untuk melanjutkan.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold text-slate-700">Username atau Email</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username atau email"
                    className="pl-11 h-12 bg-white border-slate-300 focus:border-[#1B5E20] focus:ring-[#1B5E20]/20 rounded-lg text-sm"
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
                  <button
                    type="button"
                    className="text-xs text-[#1B5E20] hover:text-[#2E7D32] hover:underline font-medium"
                    onClick={() => setInfo('Hubungi Super Admin untuk reset password.')}
                  >
                    Lupa password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="pl-11 pr-11 h-12 bg-white border-slate-300 focus:border-[#1B5E20] focus:ring-[#1B5E20]/20 rounded-lg text-sm"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#1B5E20] focus:ring-[#1B5E20]/20 cursor-pointer"
                />
                <Label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">Ingat aku (7 hari)</Label>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Info */}
              {info && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{info}</span>
                </div>
              )}

              {/* Submit Button - Premium Green Gradient */}
              <Button
                type="submit"
                disabled={loading}
                className="login-btn w-full h-12 bg-gradient-to-r from-green-700 via-green-600 to-emerald-500 hover:from-green-800 hover:via-green-700 hover:to-emerald-600 hover:-translate-y-1 shadow-lg shadow-green-600/30 hover:shadow-xl hover:shadow-green-500/40 text-white font-semibold text-base rounded-xl transition-all duration-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  'Masuk'
                )}
              </Button>

              {/* Registration prompt */}
              <p className="text-center text-sm text-slate-500">
                Belum punya akun?{' '}
                <button
                  type="button"
                  onClick={() => setInfo('Aktivasi akun ASN dilakukan oleh Admin Bidang. Hubungi BPSDM Aceh untuk pengajuan.')}
                  className="text-[#1B5E20] hover:text-[#2E7D32] font-semibold hover:underline"
                >
                  Aktivasi Akun ASN
                </button>
              </p>
            </form>

            {/* Demo credentials */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Akun Demo (klik untuk isi)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { u: 'superadmin', label: 'Super Admin', color: 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200' },
                  { u: 'admin', label: 'Admin Bidang', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' },
                  { u: 'operator', label: 'Operator', color: 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200' },
                ].map((d) => (
                  <button
                    key={d.u}
                    type="button"
                    onClick={() => fillDemo(d.u)}
                    className={`text-xs font-medium px-2 py-2 rounded-lg border transition-colors ${d.color}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 text-center">Password semua akun: admin123</p>
            </div>

            {/* System Notice */}
            <div className="mt-6 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-[11px] text-slate-500 leading-relaxed text-center">
                Sistem internal Pemerintah Aceh untuk aparatur sipil negara.
                Akses tidak sah dilarang. Butuh bantuan? Hubungi <span className="font-semibold text-[#1B5E20]">BPSDM Aceh</span>.
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            © {new Date().getFullYear()} BPSDM Provinsi Aceh — Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti
          </p>
        </motion.div>
      </div>
    </div>
  )
}
